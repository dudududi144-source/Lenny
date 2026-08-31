import { Container, Graphics, Sprite } from 'pixi.js';
import {
  colorFor,
  errorKindFor,
  exposureFor,
  selectPairTypes,
  type CardType,
  type Exposure,
} from '../fx/CardTypes';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture, ringTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';

const FACE_HEX = 0xfff9f0;
const EDGE_HEX = 0xe8d9c8;
const BACK_HEX = 0x7c4dff;
const BACK_EDGE_HEX = 0x9b74ff;
const AURA_HEX = 0xff8ad9;
const PEEK_SETTLE_MS = 400;
const FLIP_MS = 160; /* each half of a flip */
const LOCK_PAD_MS = 80;
const MATCH_LOCK_MS = 500;
const MISS_LOCK_MS = 800;
const AURA_MS = 1200;
const AREA = { x: 0.08, y: 0.22, w: 0.84, h: 0.5 };
const GAP = 10;

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
  dim: Graphics | null;
}

function layoutFor(pairs: number): { rows: number; cols: number } {
  if (pairs <= 3) return { rows: 2, cols: 3 };
  if (pairs === 4) return { rows: 2, cols: 4 };
  return { rows: 3, cols: 4 };
}

/**
 * MemoryPairs — pair matching (memory-hill).
 * Ported 1:1 from the Phaser level generator: similarity deck via
 * selectPairTypes, exposure ladder (none/peek/peek-plus with dim aid),
 * vector card fronts, verbatim taxonomy feedback, visible hint ladder.
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

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.build();
  }

  protected build(): void {
    const level = this.dda.level();
    const exposure = exposureFor(level);
    const spec = this.ctx.spec;

    const specPairs = spec?.params.itemCount ? Math.min(spec.params.itemCount, 6) : null;
    this.totalPairs = specPairs ?? [3, 4, 6, 6][this.dda.tier()];
    const { rows, cols } = layoutFor(this.totalPairs);

    const kinds = selectPairTypes(this.totalPairs, level);
    const deck = [...kinds, ...kinds];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const areaX = this.w * AREA.x;
    const areaY = this.h * AREA.y;
    const areaW = this.w * AREA.w;
    const areaH = this.h * AREA.h;
    const slotW = (areaW - GAP * (cols - 1)) / cols;
    const slotH = (areaH - GAP * (rows - 1)) / rows;

    deck.forEach((kind, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = areaX + col * (slotW + GAP) + slotW / 2;
      const y = areaY + row * (slotH + GAP) + slotH / 2;
      const slot = this.buildSlot(index, x, y, slotW, slotH, kind);
      this.slots.push(slot);
      this.root.addChild(slot.view);
    });

    const intro = spec?.narrative.intro ?? ['הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ.', 'בּוֹא נִמְצָא אֶת הַזּוּגוֹת!'];
    this.say(intro);
    this.ctx.hud.ringCounts(this.pairsFound, this.totalPairs);

    if (exposure.mode !== 'none') this.schedulePeek(exposure);
  }

  /* ---------- card construction ---------- */

  private buildSlot(index: number, x: number, y: number, w: number, h: number, kind: CardType): SlotView {
    const view = new Container();
    view.x = x;
    view.y = y;

    const back = new Container();
    const backShape = new Graphics();
    backShape.roundRect(-w / 2, -h / 2, w, h, 12);
    backShape.fill({ color: BACK_HEX });
    backShape.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 10);
    backShape.stroke({ color: BACK_EDGE_HEX, width: 2, alpha: 0.9 });
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
    const star = new Graphics();
    star.circle(0, 0, w * 0.09).fill({ color: COLORS.glowSoft, alpha: 0.95 });
    back.addChild(star);

    const front = new Container();
    const face = new Graphics();
    face.roundRect(-w / 2, -h / 2, w, h, 12);
    face.fill({ color: FACE_HEX });
    face.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 10);
    face.stroke({ color: EDGE_HEX, width: 2 });
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
    dim.roundRect(-w / 2, -h / 2, w, h, 12);
    dim.fill({ color: 0x0b0726, alpha: 0.38 });
    dim.visible = false;
    back.addChild(dim);

    return { index, x, y, w, h, kind, state: 'down', matched: false, failed: false, view, back, front, dim };
  }

  private drawSuit(kind: CardType, u: number): Graphics {
    const g = new Graphics();
    const color = colorFor(kind);
    const dark = colorFor(kind);

    if (kind.suit === 'flower') {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = Math.cos(angle) * u * 0.62;
        const py = Math.sin(angle) * u * 0.62;
        g.ellipse(px, py, u * 0.26, u * 0.15);
        g.fill({ color, alpha: 0.85 });
      }
      g.circle(0, 0, u * 0.24).fill({ color: dark });
    } else if (kind.suit === 'bug') {
      g.ellipse(0, -u * 0.05, u * 0.5, u * 0.4).fill({ color });
      for (let i = 0; i < 3; i++) {
        const lx = -u * 0.32 + i * u * 0.32;
        g.moveTo(lx, u * 0.28);
        g.lineTo(lx - u * 0.1, u * 0.52 + i * u * 0.02);
        g.stroke({ color, width: Math.max(1.6, u * 0.05), alpha: 0.9 });
        g.moveTo(lx + u * 0.06, u * 0.28);
        g.lineTo(lx + u * 0.16, u * 0.52 + i * u * 0.02);
        g.stroke({ color, width: Math.max(1.6, u * 0.05), alpha: 0.9 });
      }
      g.moveTo(-u * 0.12, -u * 0.38);
      g.lineTo(-u * 0.24, -u * 0.58);
      g.stroke({ color, width: Math.max(1.4, u * 0.045) });
      g.moveTo(u * 0.12, -u * 0.38);
      g.lineTo(u * 0.24, -u * 0.58);
      g.stroke({ color, width: Math.max(1.4, u * 0.045) });
      g.circle(-u * 0.16, -u * 0.14, u * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(u * 0.16, -u * 0.14, u * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
    } else if (kind.suit === 'fish') {
      g.moveTo(-u * 0.62, -u * 0.3);
      g.lineTo(-u * 0.3, 0);
      g.lineTo(-u * 0.62, u * 0.3);
      g.closePath();
      g.fill({ color, alpha: 0.92 });
      g.ellipse(u * 0.12, 0, u * 0.5, u * 0.3).fill({ color });
      g.circle(u * 0.34, -u * 0.08, u * 0.05).fill({ color: 0x1c1430 });
    } else {
      /* tree */
      g.circle(-u * 0.2, -u * 0.22, u * 0.28).fill({ color });
      g.circle(u * 0.2, -u * 0.22, u * 0.28).fill({ color });
      g.circle(0, -u * 0.42, u * 0.3).fill({ color });
      g.roundRect(-u * 0.09, u * 0.05, u * 0.18, u * 0.42, 3).fill({ color: 0x8a5a3b });
    }
    return g;
  }

  /* ---------- flipping ---------- */

  private flipTo(slot: SlotView, up: boolean, onSettled?: () => void): void {
    if (slot.state === 'flipping' || slot.state === (up ? 'up' : 'down')) {
      onSettled?.();
      return;
    }
    slot.state = 'flipping';
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
      this.peekSeen = true;
      this.slots.forEach((slot, i) => {
        this.anim.after(i * 55, () => this.flipTo(slot, true));
      });
      const upDone = PEEK_SETTLE_MS + this.slots.length * 55 + FLIP_MS * 2 + 60;
      this.anim.after(upDone + exposure.peekMs, () => {
        for (const slot of this.slots) this.flipTo(slot, false);
        this.anim.after(FLIP_MS * 2 + LOCK_PAD_MS, () => {
          this.transitioning = false;
        });
      });
    });
  }

  /* ---------- gameplay ---------- */

  private isLocked(): boolean {
    return this.transitioning || this.t < this.lockUntil;
  }

  private slotAt(x: number, y: number): SlotView | null {
    return (
      this.slots.find(
        (s) => Math.abs(x - s.x) <= s.w / 2 + 4 && Math.abs(y - s.y) <= s.h / 2 + 4,
      ) ?? null
    );
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.isLocked()) return false;
    const slot = this.slotAt(x, y);
    if (!slot || slot.matched) return false;
    if (slot.state !== 'down') return true; /* held/flipping card: ignore */
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
    this.anim.after(FLIP_MS * 2 + 20, () => {
      a.matched = true;
      b.matched = true;
    });
    this.signals.attempt('memory.pairs', true);
    this.sparkle(b.x, b.y, [COLORS.glow, COLORS.glowSoft, 0xffffff]);
    this.say(['וָאו! זוּג!']);
    this.pairsFound++;
    this.ctx.hud.ringCounts(this.pairsFound, this.totalPairs);
    if (this.pairsFound >= this.totalPairs) this.win();
  }

  private onMiss(a: SlotView, b: SlotView): void {
    this.mistakes++;
    this.consecutiveMiss++;
    a.failed = true;
    b.failed = true;
    this.lockUntil = this.t + MISS_LOCK_MS;

    this.signals.attempt('memory.pairs', false);
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
    this.aura?.sprite.destroy();
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
      sprite.alpha = 0.55 + 0.3 * Math.sin(this.t / 180);
    });
    this.aura = { sprite, cancel };
    this.anim.after(AURA_MS, () => {
      cancel();
      sprite.destroy();
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
    this.finish(2600);
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
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
      slots: this.slots.map((s) => ({
        index: s.index,
        x: Math.round(s.x),
        y: Math.round(s.y),
        w: Math.round(s.w),
        h: Math.round(s.h),
        kind: s.kind,
        state: s.state,
        matched: s.matched,
      })),
    };
  }
}
