import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  FISH_COLOR_HEX,
  TARGET_GLOW_HEX,
  errorKindFor,
  movementModeFor,
  selectDistractors,
  type FishColor,
  type FishShape,
  type FishType,
  type MovementMode,
} from '../fx/FishTypes';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease, type TweenHandle } from '../engine/AnimationSystem';
import { softGlowTexture, sparkTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';

const SESSION_ROUNDS = 3; /* DDA rounds — the golden finale comes after */
const INTRA_ROUND_RAMP = 0.06;
const HIT_RADIUS = 44;
const ROUND_GAP_MS = 1100;

const GOLDEN_AT_MS = 900; /* spawns shortly into rounds 2+ — pacing fits catch rhythm */
const GOLDEN_LIFETIME_MS = 5200;
const GOLDEN_POINTS = 50;

const CURRENT_LEVEL = 0.5;
const NIGHT_LEVEL = 0.7;
const JELLY_LEVEL = 0.35;

const COLOR_NAMES: Record<FishColor, string> = {
  coral: 'אַלְמוֹן',
  gold: 'זָהוֹב',
  violet: 'סָגוֹל',
  mint: 'נַעֲנָה',
  blue: 'כָּחֹל',
  pink: 'וָרוֹד',
};
const SHAPE_NAMES: Record<FishShape, string> = {
  round: 'עָגוֹל',
  long: 'אָרֹךְ',
  flat: 'שָׁטוּחַ',
  angular: 'זָוִי',
};

interface Fish {
  kind: FishType;
  isTarget: boolean;
  view: Container;
  body: Container;
  tail: Graphics;
  ax: number;
  ay: number;
  rx: number;
  ry: number;
  phase: number;
  speed: number;
  facing: number;
  wag: number;
  caught: boolean;
  enterTween?: TweenHandle;
}

interface Jelly {
  view: Container;
  x: number;
  y: number;
  vy: number;
  phase: number;
  enterTween?: TweenHandle;
}

interface Golden {
  view: Container;
  x: number;
  y: number;
  vx: number;
  bornAt: number;
}

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((hex & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * GlowFish v3 — "מְסִיקַת הָאוֹר" (Arena commercial rebuild).
 *
 * The DDA level (one number, untouched core) still owns the pond:
 * similarity band, pond size, movement mode and the visible hint
 * ladder. On top, the Arena layer adds the commercial game:
 * living schools with tail-wag motion, the wish bubble, catch-chain
 * combos, a golden bonus fish, jellyfish hazards, currents, night
 * rounds, a golden finale and the results ceremony.
 */
export class GlowFishScene extends GameScene {
  private round = 0;
  private found = 0;
  private toFind = 2;
  private wrongThisRound = 0;
  private targetKind: FishType | null = null;
  private fishes: Fish[] = [];
  private jellies: Jelly[] = [];
  private golden: Golden | null = null;
  private goldenAt = 0;
  private pond = new Container();
  private wishBubble: Container | null = null;
  private wishLabel: Text | null = null;
  private nightVeil = new Container();
  private lastHint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private transitioning = false;
  private finale = false;
  private currentAnnounced = false;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.root.addChild(this.pond);
    this.buildNightVeil();
    this.wishLabel = this.buildWishBubble();
    audio.startMusic();
    this.build();
  }

  protected build(): void {
    const intro = this.ctx.spec?.narrative.intro ?? ['הַדָּגִים שָׂחִים בַּנְחָל. בּוֹאִי נְמַצְאִי אֶת הַדָּג הַמְבֻקָּשׁ!'];
    this.say(intro);
    this.startRound();
  }

  /* ---------------- wish bubble ---------------- */

  private buildWishBubble(): Text {
    const g = new Graphics();
    const bw = 210;
    g.roundRect(-bw / 2, -24, bw, 48, 24).fill({ color: 0x101632, alpha: 0.88 }).stroke({ color: COLORS.glow, width: 1.5, alpha: 0.7 });
    g.moveTo(-8, 24).lineTo(8, 24).lineTo(0, 36).fill({ color: 0x101632, alpha: 0.88 });
    const title = new Text({
      text: 'מְבֻקָּשׁ',
      style: { fontFamily: 'Heebo, sans-serif', fontSize: 13, fontWeight: '700', fill: 0x9aa3c7 },
    });
    title.anchor.set(0.5);
    title.y = -13;
    title.resolution = 2;
    const label = new Text({
      text: '',
      style: { fontFamily: 'Heebo, sans-serif', fontSize: 19, fontWeight: '800', fill: COLORS.cream },
    });
    label.anchor.set(0.5);
    label.y = 6;
    label.resolution = 2;
    const bubble = new Container();
    bubble.addChild(g, title, label);
    bubble.eventMode = 'none';
    this.wishBubble = bubble;
    this.repositionWish();
    this.root.addChild(bubble);
    return label;
  }

  private repositionWish(): void {
    if (!this.wishBubble) return;
    this.wishBubble.x = this.w / 2;
    this.wishBubble.y = 78;
  }

  private buildNightVeil(): void {
    const g = new Graphics().rect(-2000, -2000, 6000, 6000).fill({ color: 0x02030a, alpha: 0.5 });
    g.eventMode = 'none';
    g.alpha = 0;
    this.nightVeil.addChild(g);
    this.root.addChildAt(this.nightVeil, 1); /* above backdrop, below pond */
  }

  protected override layout(): void {
    /* may fire from the base constructor before derived fields exist */
    this.repositionWish();
  }

  /* ---------------- level -> pond plan (DDA mapping preserved) ---------------- */

  private effectiveLevel(): number {
    const base = this.dda.level();
    return Math.min(1, Math.max(0, base + (Math.min(this.round, SESSION_ROUNDS) - 1) * INTRA_ROUND_RAMP));
  }

  private clearPond(): void {
    for (const f of this.fishes) {
      f.enterTween?.kill();
      if (!f.view.destroyed) f.view.destroy({ children: true });
    }
    this.fishes = [];
    for (const j of this.jellies) {
      j.enterTween?.kill();
      if (!j.view.destroyed) j.view.destroy({ children: true });
    }
    this.jellies = [];
    if (this.golden && !this.golden.view.destroyed) this.golden.view.destroy({ children: true });
    this.golden = null;
  }

  private startRound(): void {
    this.round++;
    this.found = 0;
    this.wrongThisRound = 0;
    this.transitioning = false;
    this.lastHint = 'none';
    this.goldenAt = this.t + GOLDEN_AT_MS;
    this.finale = this.round > SESSION_ROUNDS;

    const level = this.finale ? 0.15 : this.effectiveLevel();
    this.toFind = this.finale ? 4 : level < 0.5 ? 2 : 3;
    const mode: MovementMode = this.finale ? 'active' : movementModeFor(level);

    const shapes: FishShape[] = ['round', 'long', 'flat', 'angular'];
    const colors: FishColor[] = ['coral', 'gold', 'violet', 'mint', 'blue', 'pink'];
    this.targetKind = {
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
    };

    const wishText = this.finale
      ? 'דָּגֵי זָהָב — סִיּוּם מְנַצֵּחַ!'
      : `דָּג ${COLOR_NAMES[this.targetKind.color]} · ${SHAPE_NAMES[this.targetKind.shape]}`;
    if (this.wishLabel) this.wishLabel.text = wishText;
    this.ctx.hud.mission?.(this.finale ? 'הַסִּיּוּם הַמְנַצֵּחַ!' : wishText);
    this.ctx.hud.ringCounts(0, this.toFind);

    const itemCount = this.ctx.spec?.params.itemCount ?? 5 + Math.floor(level * 6);
    const distractorKinds = selectDistractors(this.targetKind, Math.max(3, itemCount - this.toFind), level);

    this.clearPond();

    const bandTop = this.h * 0.24;
    const bandBottom = this.h * 0.82;
    const spawnCount = this.toFind + distractorKinds.length;
    for (let i = 0; i < spawnCount; i++) {
      const isTarget = i < this.toFind;
      const kind = isTarget ? this.targetKind : distractorKinds[(i - this.toFind) % distractorKinds.length];
      this.spawnFish(kind, isTarget, mode, bandTop, bandBottom);
    }

    /* jellyfish hazard at higher levels (from round 2) */
    if (!this.finale && level >= JELLY_LEVEL && this.round >= 2) {
      const count = 1 + (level >= 0.7 ? 1 : 0);
      for (let i = 0; i < count; i++) this.spawnJelly();
    }

    /* currents announcement (once the level unlocks them) */
    if (!this.finale && level >= CURRENT_LEVEL && !this.currentAnnounced) {
      this.currentAnnounced = true;
      this.fx.announce('זֶרֶם חָדָשׁ!', { y: this.h * 0.4, w: this.w, sub: 'הַדָּגִים שָׂטִים עִם הַמַּיִם' });
    }

    this.pond.alpha = 0;
    this.anim.to(this.pond, { alpha: 1 }, { durationMs: 420, ease: ease.outCubic });
  }

  /* ---------------- actors ---------------- */

  private spawnFish(kind: FishType, isTarget: boolean, mode: MovementMode, bandTop: number, bandBottom: number): void {
    const view = new Container();
    const body = new Container();
    const hex = isTarget ? TARGET_GLOW_HEX : FISH_COLOR_HEX[kind.color];

    const aura = new Sprite(softGlowTexture());
    aura.anchor.set(0.5);
    aura.tint = hex;
    aura.blendMode = 'add';
    aura.alpha = isTarget ? 0.85 : 0.3;
    aura.width = isTarget ? 92 : 64;
    aura.height = isTarget ? 66 : 46;
    body.addChild(aura);

    const g = new Graphics();
    switch (kind.shape) {
      case 'round': g.ellipse(0, 0, 22, 17); break;
      case 'long': g.ellipse(0, 0, 28, 12); break;
      case 'flat': g.ellipse(0, 0, 20, 15); break;
      case 'angular': g.roundRect(-20, -13, 40, 26, 6); break;
    }
    g.fill({ color: hex, alpha: isTarget ? 0.95 : 0.8 });
    g.stroke({ color: shade(hex, 1.35), width: 1.5, alpha: 0.9 });
    g.ellipse(-2, 5, 14, 6).fill({ color: 0xffffff, alpha: 0.22 });
    body.addChild(g);

    const tail = new Graphics();
    tail.moveTo(14, 0).lineTo(30, -9).lineTo(30, 9).closePath();
    tail.fill({ color: shade(hex, 0.8), alpha: 0.95 });
    body.addChild(tail);

    const eye = new Graphics();
    eye.circle(-10, -4, 3.4).fill({ color: 0x0b0726 });
    eye.circle(-9, -5, 1.1).fill({ color: 0xffffff });
    body.addChild(eye);

    if (isTarget) {
      const crown = new Sprite(sparkTexture());
      crown.anchor.set(0.5);
      crown.tint = 0xffffff;
      crown.alpha = 0.9;
      crown.width = 14;
      crown.height = 14;
      crown.y = -20;
      body.addChild(crown);
    }

    view.addChild(body);
    view.scale.set(0);
    this.pond.addChild(view);

    const fish: Fish = {
      kind,
      isTarget,
      view,
      body,
      tail,
      ax: 60 + Math.random() * (this.w - 120),
      ay: bandTop + Math.random() * (bandBottom - bandTop),
      rx: 14 + Math.random() * 30,
      ry: 10 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
      speed: mode === 'static' ? 0.5 : mode === 'drift' ? 0.9 : 1.6,
      facing: Math.random() < 0.5 ? 1 : -1,
      wag: Math.random() * Math.PI * 2,
      caught: false,
    };
    this.fishes.push(fish);

    fish.enterTween = this.anim.to(view, { scale: 1 }, { durationMs: 460, delayMs: Math.round(Math.random() * 400), ease: ease.outBack });
  }

  private spawnJelly(): void {
    const view = new Container();
    const g = new Graphics();
    g.ellipse(0, 0, 17, 20).fill({ color: 0x2a2140, alpha: 0.92 });
    g.ellipse(0, 0, 17, 20).stroke({ color: 0x8a76c9, width: 1.6, alpha: 0.8 });
    for (let i = -2; i <= 2; i++) {
      g.moveTo(i * 6, 16).quadraticCurveTo(i * 6 + 3, 26, i * 6, 34);
      g.stroke({ color: 0x8a76c9, width: 1.4, alpha: 0.6 });
    }
    const aura = new Sprite(softGlowTexture());
    aura.anchor.set(0.5);
    aura.tint = 0x8a76c9;
    aura.blendMode = 'add';
    aura.alpha = 0.4;
    aura.width = 70;
    aura.height = 70;
    view.addChild(aura, g);
    this.pond.addChild(view);

    const jelly: Jelly = {
      view,
      x: 50 + Math.random() * (this.w - 100),
      y: this.h * (0.6 + Math.random() * 0.3),
      vy: -(0.35 + Math.random() * 0.3),
      phase: Math.random() * Math.PI * 2,
    };
    view.x = jelly.x;
    view.y = jelly.y;
    view.scale.set(0);
    this.jellies.push(jelly);
    jelly.enterTween = this.anim.to(view, { scale: 1 }, { durationMs: 520, ease: ease.outBack });
  }

  private spawnGolden(): void {
    if (this.golden) return;
    const view = new Container();
    const aura = new Sprite(softGlowTexture());
    aura.anchor.set(0.5);
    aura.tint = COLORS.glow;
    aura.blendMode = 'add';
    aura.alpha = 0.95;
    aura.width = 120;
    aura.height = 90;
    const g = new Graphics();
    g.ellipse(0, 0, 22, 15).fill({ color: 0xffd76a });
    g.ellipse(-2, 4, 13, 5).fill({ color: 0xffffff, alpha: 0.35 });
    g.moveTo(16, 0).lineTo(32, -10).lineTo(32, 10).closePath().fill({ color: 0xe0a83c });
    g.circle(-10, -4, 3.2).fill({ color: 0x0b0726 });
    const crown = new Sprite(sparkTexture());
    crown.anchor.set(0.5);
    crown.width = 20;
    crown.height = 20;
    crown.y = -22;
    view.addChild(aura, g, crown);
    /* Stage 5: the golden fish earns the real glow filter */
    this.glowOn(view, 0xffd76a, 2.4);
    this.pond.addChild(view);

    const fromLeft = Math.random() < 0.5;
    const golden: Golden = {
      view,
      x: fromLeft ? -40 : this.w + 40,
      y: this.h * (0.3 + Math.random() * 0.4),
      vx: (fromLeft ? 1 : -1) * (0.09 + Math.random() * 0.04),
      bornAt: this.t,
    };
    view.x = golden.x;
    view.y = golden.y;
    this.golden = golden;
    audio.play('chime', 4);
    this.fx.announce('דָּג זָהָב!', { y: this.h * 0.34, w: this.w, durMs: 1100 });
  }

  /* ---------------- input ---------------- */

  override onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.transitioning) return false;

    /* golden fish first — it is the most exciting thing on screen */
    if (this.golden && !this.golden.view.destroyed) {
      const g = this.golden;
      if (Math.hypot(x - g.view.x, y - g.view.y) < HIT_RADIUS + 12) {
        this.catchGolden(g);
        return true;
      }
    }

    /* jellyfish — gentle chain-breaker */
    for (const j of this.jellies) {
      if (!j.view.destroyed && Math.hypot(x - j.view.x, y - j.view.y) < HIT_RADIUS) {
        this.hitJelly(j, x, y);
        return true;
      }
    }

    /* fish: nearest within radius */
    let best: Fish | null = null;
    let bestD = Infinity;
    for (const f of this.fishes) {
      if (f.caught || f.view.destroyed) continue;
      const d = Math.hypot(x - f.view.x, y - f.view.y);
      if (d < HIT_RADIUS && d < bestD) {
        best = f;
        bestD = d;
      }
    }

    if (best) {
      if (best.isTarget && best.kind.shape === this.targetKind?.shape && best.kind.color === this.targetKind?.color) {
        this.catchFish(best);
      } else {
        this.missFish(best);
      }
      return true;
    }

    /* empty tap — a soft ripple keeps the pond responsive */
    this.ripple(x, y);
    return false;
  }

  /* ---------------- outcomes ---------------- */

  private catchFish(fish: Fish): void {
    fish.caught = true;
    fish.enterTween?.kill();
    this.found++;
    const px = fish.view.x;
    const py = fish.view.y;
    this.score.hit(this.finale ? 15 : 10, { x: px, y: py });
    this.sparkle(px, py, [TARGET_GLOW_HEX, COLORS.glowSoft, 0xffffff]);
    this.bloom(px, py);
    this.fx.shake(this.root, 0, 0, 2.5, 160);
    this.ctx.hud.ringCounts(this.found, this.toFind);
    this.anim.to(fish.view, { scale: 1.35, alpha: 0 }, { durationMs: 300, ease: ease.outCubic, onDone: () => {
      if (!fish.view.destroyed) fish.view.destroy({ children: true });
    } });
    this.signals.attempt('attention.visual', true);

    if (this.found >= this.toFind) this.endRound(true);
    else if (this.found === this.toFind - 1) this.say(['עוֹד אֶחָד!']);
  }

  private missFish(fish: Fish): void {
    const px = fish.view.x;
    const py = fish.view.y;
    this.wrongThisRound++;
    this.score.miss({ x: px, y: py });
    this.fx.flash(COLORS.coral, 180, 0.16);
    this.signals.attempt('attention.visual', false);
    void errorKindFor(this.targetKind!, fish.kind); /* taxonomy kept for analytics parity */
    /* visible hint ladder — identical thresholds to the DDA contract */
    this.lastHint = this.suggestHint(this.wrongThisRound);
    this.showHintAt(px, py);
    /* the tapped fish scoots away — honest feedback, no dead click */
    this.anim.to(fish.body, { x: fish.facing * -18 }, { durationMs: 260, ease: ease.outCubic, onDone: () => {
      if (!fish.body.destroyed) fish.body.x = 0;
    } });
  }

  private showHintAt(x: number, y: number): void {
    if (this.lastHint === 'gentle') {
      this.ripple(x, y, COLORS.hint);
    } else if (this.lastHint === 'clear') {
      for (const f of this.fishes) {
        if (f.isTarget && !f.caught && !f.view.destroyed) this.ripple(f.view.x, f.view.y, COLORS.hint);
      }
    } else if (this.lastHint === 'show') {
      for (const f of this.fishes) {
        if (f.isTarget && !f.caught && !f.view.destroyed) {
          const halo = this.glowSprite(TARGET_GLOW_HEX, 120, 0.9);
          halo.x = f.view.x;
          halo.y = f.view.y;
          this.pond.addChild(halo);
          this.anim.to(halo, { width: 170, height: 130, alpha: 0 }, { durationMs: 900, ease: ease.outCubic, onDone: () => halo.destroy() });
        }
      }
    }
  }

  private catchGolden(g: Golden): void {
    const px = g.view.x;
    const py = g.view.y;
    this.golden = null;
    this.score.hit(GOLDEN_POINTS, { x: px, y: py }, 'דָּג זָהָב!');
    this.sparkle(px, py, [COLORS.glow, 0xffffff, COLORS.glowSoft]);
    bursts.confetti(this.particles, px, py);
    this.fx.slowmo(0.4, 420);
    this.fx.shake(this.root, 0, 0, 3, 200);
    this.anim.to(g.view, { scale: 1.6, alpha: 0 }, { durationMs: 380, ease: ease.outCubic, onDone: () => {
      if (!g.view.destroyed) g.view.destroy({ children: true });
    } });
  }

  private hitJelly(j: Jelly, x: number, y: number): void {
    j.enterTween?.kill();
    this.score.miss({ x, y });
    this.fx.flash(0x8a76c9, 260, 0.22);
    this.say(['אוּפּס — מְדוּזָה! רַק לְהִזָּהֵר בַּפַּעַם הַבָּאָה.']);
    this.jellies = this.jellies.filter((q) => q !== j);
    this.anim.to(j.view, { y: j.view.y + 160, alpha: 0 }, { durationMs: 600, ease: ease.inOutCubic, onDone: () => {
      if (!j.view.destroyed) j.view.destroy({ children: true });
    } });
  }

  private endRound(completed: boolean): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.golden = null;

    /* one DDA round = one named-pond completion (untouched core contract) */
    if (completed && !this.finale) {
      this.dda.outcome(true, Math.max(0.3, 1 - this.wrongThisRound * 0.15));
      audio.play('chime', this.round % 4);
    }

    if (this.finale) {
      this.fx.slowmo(0.45, 700);
      this.finishWithCeremony({ title: 'הָאוֹר נֶאֱסַף!' });
      return;
    }

    const lastRound = this.round >= SESSION_ROUNDS;
    this.anim.after(ROUND_GAP_MS, () => {
      if (this.tornDown || this.isFinished()) return;
      if (lastRound) {
        this.startRound(); /* round 4 = golden finale */
      } else {
        this.startRound();
      }
    });
  }

  /* ---------------- tick ---------------- */

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    const dt = dtMs / 1000;

    /* Stage 5: gravity well — pond motes drift toward the golden fish
       (or the wish bubble while it sleeps). Food draws the school. */
    if (!this.golden && !this.wishBubble?.destroyed) {
      this.particles.setWells([
        { x: this.wishBubble?.x ?? this.w / 2, y: this.wishBubble?.y ?? 78, strength: 26, radius: 260 },
      ]);
    }

    const level = this.effectiveLevel();
    const mode = movementModeFor(level);
    const currentAmp = level >= CURRENT_LEVEL ? 26 : 0;

    for (const f of this.fishes) {
      if (f.caught || f.view.destroyed) continue;
      f.wag += dt * (7 + f.speed * 3);
      f.tail.scale.y = 0.7 + 0.5 * Math.sin(f.wag);
      f.phase += dt * f.speed;
      const drift = mode === 'active' ? Math.sin(f.phase * 0.9) * 10 : 0;
      const current = Math.sin((this.t / 1000) * 0.7 + f.ay * 0.01) * currentAmp;
      f.view.x = f.ax + Math.cos(f.phase * 1.2) * f.rx + drift + current;
      f.view.y = f.ay + Math.sin(f.phase) * f.ry;
      const wantFacing = Math.cos(f.phase * 1.2 + Math.PI / 2) > 0 ? 1 : -1;
      if (wantFacing !== f.facing) {
        f.facing = wantFacing;
        f.body.scale.x = wantFacing;
      }
      f.body.y = Math.sin(this.t / 260 + f.phase) * 2;
    }

    for (const j of this.jellies) {
      if (j.view.destroyed) continue;
      j.phase += dt;
      j.y += j.vy * dtMs * 0.06;
      j.view.x = j.x + Math.sin(j.phase * 1.4) * 10;
      j.view.y = j.y + Math.sin(j.phase * 3) * 3;
      if (j.y < this.h * 0.2) {
        j.y = this.h * 0.92;
        j.x = 50 + Math.random() * (this.w - 100);
      }
    }

    /* golden fish */
    if (this.round >= 2 && !this.golden && !this.transitioning && this.t >= this.goldenAt) {
      this.spawnGolden();
      this.goldenAt = this.t + GOLDEN_AT_MS + GOLDEN_LIFETIME_MS + 4000;
    }
    if (this.golden) {
      const g = this.golden;
      g.x += g.vx * dtMs;
      g.view.x = g.x;
      /* Stage 5: while the golden fish swims, the pond is drawn to it */
      if (!g.view.destroyed) {
        this.particles.setWells([{ x: g.x, y: g.view.y, strength: 42, radius: 320 }]);
      }
      g.view.y = g.y + Math.sin(this.t / 240) * 8;
      g.view.rotation = Math.sin(this.t / 240) * 0.08;
      if (g.x < -60 || g.x > this.w + 60 || this.t - g.bornAt > GOLDEN_LIFETIME_MS) {
        this.golden = null;
        this.anim.to(g.view, { alpha: 0 }, { durationMs: 240, onDone: () => {
          if (!g.view.destroyed) g.view.destroy({ children: true });
        } });
      }
    }

    /* night rounds: the water darkens, glows carry the scene */
    const wantNight = level >= NIGHT_LEVEL ? 1 : 0;
    const veil = this.nightVeil.children[0] as Graphics | undefined;
    if (veil && Math.abs(veil.alpha - wantNight) > 0.02) {
      veil.alpha += (wantNight - veil.alpha) * Math.min(1, dt * 2);
    }
  }

  /* ---------------- bridge ---------------- */

  override debugState(): Record<string, unknown> {
    const leader = this.fishes.find((f) => f.isTarget && !f.caught && !f.view.destroyed);
    return {
      kind: 'glow-fish',
      round: this.round,
      found: this.found,
      toFind: this.toFind,
      hint: this.lastHint,
      done: this.isFinished(),
      finale: this.finale,
      leader: leader ? { x: Math.round(leader.view.x), y: Math.round(leader.view.y) } : null,
      fishCount: this.fishes.filter((f) => !f.caught && !f.view.destroyed).length,
      fishes: this.fishes
        .filter((f) => !f.caught && !f.view.destroyed)
        .map((f) => ({
          x: Math.round(f.view.x),
          y: Math.round(f.view.y),
          target: f.isTarget && f.kind.shape === this.targetKind?.shape && f.kind.color === this.targetKind?.color,
        })),
      golden: this.golden ? { x: Math.round(this.golden.view.x), y: Math.round(this.golden.view.y) } : null,
      jellies: this.jellies.length,
      timer: Math.round(this.t),
    };
  }

  destroy(): void {
    audio.stopMusic();
    super.destroy();
  }
}
