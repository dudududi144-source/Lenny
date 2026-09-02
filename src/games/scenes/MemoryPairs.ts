import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  colorFor,
  errorKindFor,
  exposureFor,
  selectPairTypes,
  type CardType,
  type Exposure,
} from '../fx/CardTypes';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease, type TweenHandle } from '../engine/AnimationSystem';
import { softGlowTexture, sparkTexture, ringTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';

const FLIP_MS = 210;
const PEEK_SETTLE_MS = 900;
const MATCH_LOCK_MS = 620;
const MISS_LOCK_MS = 1050;
const LOCK_PAD_MS = 60;
const AURA_MS = 3600;
const GAP = 14;
const AREA = { x: 0.06, y: 0.26, w: 0.88, h: 0.56 };

const BACK_HEX = 0x232a4d;
const BACK_EDGE_HEX = 0x4a5578;
const FACE_HEX = 0xf4ede2;
const EDGE_HEX = 0xc9b89a;
const AURA_HEX = 0xffd76a;

/* constellation chime per suit — the garden sings when pairs match */
const SUIT_CHIME: Record<string, number> = { flower: 0, bug: 1, fish: 2, tree: 3 };

const SUIT_NAMES: Record<string, string> = {
  flower: 'פֶּרַח',
  bug: 'חָרָק',
  fish: 'דָּג',
  tree: 'עֵץ',
};

interface SlotView {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: CardType;
  state: 'down' | 'flipping' | 'up';
  matched: boolean;
  failed: boolean;
  view: Container;
  back: Container;
  front: Container;
  dim: Graphics;
  bobPhase: number;
  enterTween?: TweenHandle;
}

/**
 * MemoryPairs v3 — "מַסָּע הַזִּכָּרוֹן" (Arena commercial rebuild).
 *
 * The DDA level (untouched core) still owns everything cognitive:
 * deck similarity via selectPairTypes, the exposure ladder
 * (none/peek/peek-plus dim aid), the visible hint ladder, one
 * dda.outcome per completed board. The Arena layer adds:
 *
 * - a living board: every stone bobs on its own gentle wave
 * - the constellation: each matched pair flies up and joins a
 *   glowing constellation row — the board tells its story
 * - suit chimes: every match sings its family tone (procedural)
 * - catch chains: consecutive matches build combo multipliers
 * - streak celebration: 3+ in a row lights a sparkle rain
 * - flip feel: whoosh SFX, 3D-style flip, mismatch insight lines
 * - results ceremony with stars/record and auto-advance
 */
export class MemoryPairsScene extends GameScene {
  private slots: SlotView[] = [];
  private totalPairs = 4;
  private pairsFound = 0;
  private mistakes = 0;
  private consecutiveMiss = 0;
  private held: number | null = null;
  private lockUntil = 0;
  private transitioning = false;
  private peekSeen = false;
  private lastHint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private aura: { sprite: Sprite; cancel: () => void } | null = null;
  private constellation = new Container();
  private constellationTitle: Text | null = null;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.root.addChild(this.constellation);
    audio.startMusic();
    this.build();
  }

  protected build(): void {
    const level = this.dda.level();
    const exposure = exposureFor(level);
    const spec = this.ctx.spec;

    const specPairs = spec?.params.itemCount ? Math.min(spec.params.itemCount, 8) : null;
    this.totalPairs = specPairs ?? [3, 4, 6, 6][this.dda.tier()];
    const { rows, cols } = layoutFor(this.totalPairs);

    const kinds = selectPairTypes(this.totalPairs, level);
    const deck = [...kinds, ...kinds];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const areaY = this.h * AREA.y;
    const areaW = this.w * AREA.w;
    const areaH = this.h * AREA.h;
    const slotW = Math.min((areaW - GAP * (cols - 1)) / cols, 96);
    const slotH = Math.min((areaH - GAP * (rows - 1)) / rows, 108);

    deck.forEach((kind, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rowW = Math.min(cols, Math.ceil(deck.length / rows)) * (slotW + GAP) - GAP;
      const x = this.w / 2 - rowW / 2 + col * (slotW + GAP) + slotW / 2;
      const y = areaY + row * (slotH + GAP) + slotH / 2;
      const slot = this.buildSlot(index, x, y, slotW, slotH, kind);
      this.slots.push(slot);
      this.root.addChild(slot.view);
    });

    const intro = spec?.narrative.intro ?? ['הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ.', 'בּוֹא נִמְצָא אֶת הַזּוּגוֹת!'];
    this.say(intro);
    this.ctx.hud.mission?.(`מְצְאִי אֶת כָּל ${this.totalPairs} הַזּוּגוֹת`);
    this.ctx.hud.ringCounts(this.pairsFound, this.totalPairs);

    if (exposure.mode !== 'none') this.schedulePeek(exposure);
  }

  protected override layout(): void {
    /* constellation row re-centers */
    this.layoutConstellation();
  }

  /* ---------------- board construction ---------------- */

  private buildSlot(index: number, x: number, y: number, w: number, h: number, kind: CardType): SlotView {
    const view = new Container();
    view.x = x;
    view.y = y;

    const back = new Container();
    const backShape = new Graphics();
    backShape.roundRect(-w / 2, -h / 2, w, h, 13).fill({ color: BACK_HEX });
    backShape.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 11).stroke({ color: BACK_EDGE_HEX, width: 2, alpha: 0.9 });
    back.addChild(backShape);
    const sheen = new Sprite(softGlowTexture());
    sheen.anchor.set(0.5);
    sheen.tint = 0xffffff;
    sheen.alpha = 0.2;
    sheen.blendMode = 'add';
    sheen.width = w * 0.9;
    sheen.height = h * 0.5;
    sheen.y = -h * 0.22;
    back.addChild(sheen);
    const star = new Sprite(sparkTexture());
    star.anchor.set(0.5);
    star.tint = COLORS.glowSoft;
    star.alpha = 0.9;
    star.width = w * 0.2;
    star.height = w * 0.2;
    back.addChild(star);

    const front = new Container();
    const face = new Graphics();
    face.roundRect(-w / 2, -h / 2, w, h, 13).fill({ color: FACE_HEX });
    face.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 11).stroke({ color: EDGE_HEX, width: 2 });
    front.addChild(face);
    const faceLight = new Sprite(softGlowTexture());
    faceLight.anchor.set(0.5);
    faceLight.tint = 0xffffff;
    faceLight.alpha = 0.3;
    faceLight.width = w * 0.9;
    faceLight.height = h * 0.55;
    faceLight.y = -h * 0.24;
    front.addChild(faceLight);
    front.addChild(this.drawSuit(kind, Math.min(w, h) * 0.44));

    front.visible = false;
    view.addChild(back, front);

    const dim = new Graphics();
    dim.roundRect(-w / 2, -h / 2, w, h, 13).fill({ color: 0x0b0726, alpha: 0.38 });
    dim.visible = false;
    back.addChild(dim);

    view.scale.set(0);
    const slot: SlotView = {
      index, x, y, w, h, kind,
      state: 'down', matched: false, failed: false,
      view, back, front, dim,
      bobPhase: Math.random() * Math.PI * 2,
    };
    slot.enterTween = this.anim.to(view, { scale: 1 }, { durationMs: 480, delayMs: index * 55, ease: ease.outBack });
    return slot;
  }

  private drawSuit(kind: CardType, u: number): Graphics {
    const g = new Graphics();
    const color = colorFor(kind);

    if (kind.suit === 'flower') {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        g.ellipse(Math.cos(angle) * u * 0.62, Math.sin(angle) * u * 0.62, u * 0.26, u * 0.15).fill({ color, alpha: 0.85 });
      }
      g.circle(0, 0, u * 0.24).fill({ color: 0xf7c948 });
    } else if (kind.suit === 'bug') {
      g.ellipse(0, -u * 0.05, u * 0.5, u * 0.4).fill({ color });
      for (let i = 0; i < 3; i++) {
        const lx = -u * 0.32 + i * u * 0.32;
        g.moveTo(lx, u * 0.28).lineTo(lx - u * 0.1, u * 0.52 + i * u * 0.02).stroke({ color, width: Math.max(1.6, u * 0.05), alpha: 0.9 });
        g.moveTo(lx + u * 0.06, u * 0.28).lineTo(lx + u * 0.16, u * 0.52 + i * u * 0.02).stroke({ color, width: Math.max(1.6, u * 0.05), alpha: 0.9 });
      }
      g.moveTo(-u * 0.12, -u * 0.38).lineTo(-u * 0.24, -u * 0.58).stroke({ color, width: Math.max(1.4, u * 0.045) });
      g.moveTo(u * 0.12, -u * 0.38).lineTo(u * 0.24, -u * 0.58).stroke({ color, width: Math.max(1.4, u * 0.045) });
      g.circle(-u * 0.16, -u * 0.14, u * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(u * 0.16, -u * 0.14, u * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
    } else if (kind.suit === 'fish') {
      g.moveTo(-u * 0.62, -u * 0.3).lineTo(-u * 0.3, 0).lineTo(-u * 0.62, u * 0.3).closePath().fill({ color, alpha: 0.92 });
      g.ellipse(u * 0.12, 0, u * 0.5, u * 0.3).fill({ color });
      g.circle(u * 0.34, -u * 0.08, u * 0.05).fill({ color: 0x1c1430 });
    } else {
      g.circle(-u * 0.2, -u * 0.22, u * 0.28).fill({ color });
      g.circle(u * 0.2, -u * 0.22, u * 0.28).fill({ color });
      g.circle(0, -u * 0.42, u * 0.3).fill({ color });
      g.roundRect(-u * 0.09, u * 0.05, u * 0.18, u * 0.42, 3).fill({ color: 0x8a5a3b });
    }
    return g;
  }

  /* ---------------- constellation ---------------- */

  private layoutConstellation(): void {
    if (!this.constellationTitle) return;
    this.constellationTitle.x = this.w / 2;
    this.constellationTitle.y = this.h * 0.16;
  }

  private addToConstellation(kind: CardType, fromX: number, fromY: number): void {
    if (!this.constellationTitle) {
      this.constellationTitle = new Text({
        text: '✦ קְוַת הַזִּכָּרוֹן ✦',
        style: { fontFamily: 'Heebo, sans-serif', fontSize: 17, fontWeight: '800', fill: COLORS.glowSoft },
      });
      this.constellationTitle.anchor.set(0.5);
      this.constellationTitle.resolution = 2;
      this.layoutConstellation();
      this.constellation.addChild(this.constellationTitle);
    }

    const idx = this.pairsFound - 1;
    const count = this.totalPairs;
    const spacing = Math.min(64, (this.w - 80) / Math.max(1, count));
    const startX = this.w / 2 - ((count - 1) * spacing) / 2;
    const cx = startX + idx * spacing;
    const cy = this.h * 0.215;

    const star = new Sprite(sparkTexture());
    star.anchor.set(0.5);
    star.tint = colorFor(kind);
    star.blendMode = 'add';
    star.width = 30;
    star.height = 30;
    star.x = fromX;
    star.y = fromY;
    star.scale.set(0.4);
    this.constellation.addChild(star);
    this.anim.to(star, { x: cx, y: cy, scale: 1 }, { durationMs: 640, ease: ease.outBack, onDone: () => {
      this.sparkle(cx, cy, [colorFor(kind), COLORS.glow]);
    } });
  }

  /* ---------------- flipping ---------------- */

  private flipTo(slot: SlotView, up: boolean, onSettled?: () => void): void {
    if (slot.state === 'flipping' || slot.state === (up ? 'up' : 'down')) {
      onSettled?.();
      return;
    }
    slot.state = 'flipping';
    audio.play('whoosh');
    const mid = () => {
      slot.back.visible = !up;
      slot.front.visible = up;
    };
    this.anim.to(slot.view.scale, { x: 0 }, { durationMs: FLIP_MS, ease: ease.inQuad, onDone: () => {
      mid();
      this.anim.to(slot.view.scale, { x: 1 }, { durationMs: FLIP_MS, ease: ease.outQuad, onDone: () => {
        slot.state = up ? 'up' : 'down';
        onSettled?.();
      } });
    } });
  }

  private schedulePeek(exposure: Exposure): void {
    this.transitioning = true;
    this.anim.after(PEEK_SETTLE_MS, () => {
      if (this.tornDown) return;
      this.peekSeen = true;
      this.fx.announce('הַצְצָה!', { y: this.h * 0.13, w: this.w, durMs: 1200, sub: 'זְכְרִי אֵיפֹה הַכֹּל' });
      audio.play('unlock');
      this.slots.forEach((slot, i) => {
        this.anim.after(i * 55, () => this.flipTo(slot, true));
      });
      const upDone = PEEK_SETTLE_MS + this.slots.length * 55 + FLIP_MS * 2 + 60;
      this.anim.after(upDone + exposure.peekMs, () => {
        if (this.tornDown) return;
        for (const slot of this.slots) this.flipTo(slot, false);
        this.anim.after(FLIP_MS * 2 + LOCK_PAD_MS, () => {
          this.transitioning = false;
        });
      });
    });
  }

  /* ---------------- gameplay ---------------- */

  private isLocked(): boolean {
    return this.transitioning || this.t < this.lockUntil;
  }

  private slotAt(x: number, y: number): SlotView | null {
    return (
      this.slots.find(
        (s) => Math.abs(x - s.x) <= s.w / 2 + 12 && Math.abs(y - s.y) <= s.h / 2 + 12,
      ) ?? null
    );
  }

  override onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.isLocked()) return false;
    const slot = this.slotAt(x, y);
    if (!slot || slot.matched) return false;
    if (slot.state !== 'down') return true;
    if (this.held === slot.index) return true;

    this.flipTo(slot, true);

    if (this.held === null) {
      this.held = slot.index;
      return true;
    }

    const first = this.slots[this.held];
    this.held = null;
    const same = first.kind.suit === slot.kind.suit && first.kind.tone === slot.kind.tone;
    if (same) this.onMatch(first, slot);
    else this.onMiss(first, slot);
    return true;
  }

  private onMatch(a: SlotView, b: SlotView): void {
    this.consecutiveMiss = 0;
    this.lockUntil = this.t + MATCH_LOCK_MS;
    this.signals.attempt('memory.pairs', true);
    this.pairsFound++;
    this.score.hit(20, { x: b.x, y: b.y }, SUIT_NAMES[a.kind.suit]);
    audio.play('chime', SUIT_CHIME[a.kind.suit] ?? 0);
    this.sparkle(b.x, b.y, [COLORS.glow, COLORS.glowSoft, 0xffffff]);
    this.ctx.hud.ringCounts(this.pairsFound, this.totalPairs);
    this.ctx.hud.mission?.(
      this.pairsFound >= this.totalPairs
        ? 'כָּל הַזּוּגוֹת נִמְצְאוּ!'
        : `נִמְצְאוּ ${this.pairsFound} מִתּוֹךְ ${this.totalPairs}`,
    );

    this.anim.after(FLIP_MS * 2 + 20, () => {
      a.matched = true;
      b.matched = true;
      /* fly to the constellation */
      for (const s of [a, b]) {
        this.anim.to(s.view, { y: s.view.y - this.h * 0.06, alpha: 0 }, { durationMs: 520, delayMs: 120, ease: ease.inOutCubic, onDone: () => {
          if (!s.view.destroyed) s.view.destroy({ children: true });
        } });
      }
      this.addToConstellation(a.kind, b.x, b.y);
    });

    /* streak celebration */
    if (this.score.multiplier() >= 2 && this.pairsFound < this.totalPairs) {
      this.fx.announce(`רֶצֶף x${this.score.multiplier()}!`, { y: this.h * 0.13, w: this.w, durMs: 1000 });
      this.fx.sparkleRain(this.particles, this.w);
    }

    if (this.pairsFound >= this.totalPairs) this.win();
  }

  private onMiss(a: SlotView, b: SlotView): void {
    this.mistakes++;
    this.consecutiveMiss++;
    a.failed = true;
    b.failed = true;
    this.lockUntil = this.t + MISS_LOCK_MS;

    this.signals.attempt('memory.pairs', false);
    this.score.miss({ x: b.x, y: b.y });
    const errorKind = errorKindFor(a.kind, b.kind);
    this.signals.errorKind('memory.pairs', errorKind);
    this.say([this.lineFor(errorKind)]);

    /* flip both back down after a beat */
    this.anim.after(FLIP_MS * 2 + 80, () => {
      this.flipTo(a, false);
      this.flipTo(b, false);
    });

    const hint = this.suggestHint(this.consecutiveMiss);
    this.lastHint = hint;
    if (hint !== 'none') this.signals.hintUsed('memory.pairs');
    if (hint === 'gentle') {
      this.say(['נַסּוּ לִזְכֹּר אֵיפֹה הָיָה הַקֶּלֶף הָרִאשׁוֹן']);
    } else if (hint === 'clear') {
      const twin = this.twinOf(a);
      if (twin) this.sparkle(twin.x, twin.y, [COLORS.glow, 0xffffff]);
    } else if (hint === 'show') {
      const twin = this.twinOf(a);
      if (twin) this.showAura(twin);
    }

    /* peek-plus dim aid after repeated misses */
    const exposure = exposureFor(this.dda.level());
    if (exposure.mode === 'peek-plus' && this.mistakes >= exposure.dimAfterMisses) {
      for (const slot of this.slots) {
        if (slot.failed && !slot.matched && slot.dim) slot.dim.visible = true;
      }
    }
  }

  private twinOf(slot: SlotView): SlotView | null {
    return (
      this.slots.find(
        (s) => s !== slot && s.kind.suit === slot.kind.suit && s.kind.tone === slot.kind.tone,
      ) ?? null
    );
  }

  private showAura(target: SlotView): void {
    this.aura?.cancel();
    if (this.aura && !this.aura.sprite.destroyed) this.aura.sprite.destroy();
    const sprite = new Sprite(ringTexture());
    sprite.anchor.set(0.5);
    sprite.tint = AURA_HEX;
    sprite.blendMode = 'add';
    sprite.width = target.w * 1.2;
    sprite.height = target.h * 1.2;
    sprite.x = target.x;
    sprite.y = target.y;
    this.root.addChild(sprite);
    const cancel = this.anim.loop(() => {
      if (!sprite.destroyed) sprite.alpha = 0.55 + 0.3 * Math.sin(this.t / 180);
    });
    this.aura = { sprite, cancel };
    this.anim.after(AURA_MS, () => {
      cancel();
      if (!sprite.destroyed) sprite.destroy();
      if (this.aura?.sprite === sprite) this.aura = null;
    });
  }

  private lineFor(errorKind: string): string {
    if (errorKind === 'near-miss-same-suit-diff-tone') return 'כַּמְעַט! אוֹתָהּ מִשְׁפָּחָה — שִׂימִי לֵב לַגַּוָּן';
    if (errorKind === 'near-miss-same-suit') return 'אוֹתָהּ מִשְׁפָּחָה, גַּם אוֹתוֹ גַּוָּן — אֲבָל לֹא אוֹתוֹ כֶּרְטִיס!';
    if (errorKind === 'near-miss-same-tone') return 'כַּמְעַט! אוֹתוֹ גַּוָּן — אֲבָל מִשְׁפָּחָה אַחֶרֶת';
    return 'אֵלּוּ שְׁנֵי כֶּרְטִיסִים שׁוֹנִים מְאֹד';
  }

  private win(): void {
    this.dda.outcome(true, Math.max(0.3, 1 - this.mistakes * 0.2));
    this.say(['וָאו, כָּל הַכָּבוֹד!', 'הַפַּרְפַּר נִזְכַּר בַּכֹּל!']);
    audio.play('fanfare');
    this.fx.slowmo(0.5, 700);
    this.finishWithCeremony({ title: 'הַזִּכָּרוֹן מְלָא!' });
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    /* living board: gentle bob per stone */
    for (const slot of this.slots) {
      if (slot.matched || slot.view.destroyed) continue;
      slot.view.y = slot.y + Math.sin(this.t / 560 + slot.bobPhase) * 2.4;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'memory-pairs',
      pairsFound: this.pairsFound,
      totalPairs: this.totalPairs,
      mistakes: this.mistakes,
      hint: this.lastHint,
      peekSeen: this.peekSeen,
      locked: this.isLocked(),
      done: this.isFinished(),
      held: this.held,
      slots: this.slots.map((slot) => ({
        index: slot.index,
        /* matched stones fly away — their view may already be destroyed */
        x: Math.round(slot.view.destroyed ? slot.x : slot.view.x),
        y: Math.round(slot.view.destroyed ? slot.y : slot.view.y),
        kind: { suit: slot.kind.suit, tone: slot.kind.tone },
        state: slot.state,
        matched: slot.matched,
      })),
    };
  }

  destroy(): void {
    super.destroy();
  }
}

function layoutFor(pairs: number): { rows: number; cols: number } {
  if (pairs <= 3) return { rows: 2, cols: 3 };
  if (pairs <= 4) return { rows: 2, cols: 4 };
  if (pairs <= 6) return { rows: 3, cols: 4 };
  return { rows: 4, cols: 4 }; /* 7-8 pairs: a 4×4 field, slot sizes shrink */
}
