/* ============================================================
 * GlowFishScene — Stage 2: a LEVEL GENERATOR for visual
 * attention training. Lives in Attention Stream
 * (zone: attention-stream, find-target template).
 *
 * What Stage 2 changed (the template-validation pattern):
 *  - Every fish is a (shape, color) KIND (24 kinds, FishTypes).
 *  - The DDA's continuous level no longer only picks a distractor
 *    COUNT — it picks HOW SIMILAR distractors look to the target:
 *        wanted similarity = 0.2 + level * 0.6
 *  - Movement is a difficulty axis too: static -> drift -> active.
 *  - A session is 3 rounds of 2-3 targets each; the effective
 *    level ramps +0.06 per round inside the session.
 *  - Wrong taps are classified (near-miss-very-similar /
 *    near-miss-same-color / near-miss-same-shape / far-tap) and
 *    answered with Lenny's specific Hebrew feedback plus a
 *    VISIBLE hint ladder: gentle (1 miss) -> clear (2) -> show (3+).
 *
 * Gate B contract preserved:
 *  - outcome() fires ONLY at the round boundary (a round completes
 *    when every target of that round was found);
 *    score = 1 - wrongTaps * 0.15 (floor 0.3).
 *  - outcome(false) is NEVER called; wrong taps feed LearningSignals
 *    and the hint ladder instead (no fail state for age 4-7).
 *  - Open-water taps are motor noise, not cognitive errors: a soft
 *    ripple only, no signals, no counters.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';
import { LearningSignals } from '../games/core/LearningSignals';
import { GameSpec } from '../games/builder/GameSpec';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst, confettiBurst } from '../games/fx/ParticleBurst';
import {
  FishType,
  MovementMode,
  TARGET_GLOW_HEX,
  FISH_COLOR_HEX,
  selectDistractors,
  errorKindFor,
  movementModeFor,
} from '../games/fx/FishTypes';

interface FishBody {
  kind: FishType;
  isTarget: boolean;   /* member of the round's target kind */
  x: number;
  y: number;
  facing: 1 | -1;
  phase: number;       /* tail-wag phase */
  alive: boolean;

  /* movement state (drift / active) */
  angle: number;
  speed: number;       /* px/sec, 0 while static */
  turnTimer: number;   /* seconds until the next direction change */

  /* feedback state */
  shakeUntil: number;  /* game-time ms */
  dimUntil: number;
  fadeStart: number;   /* ms when the fade-out began; 0 = not fading */
}

/* tuning constants (kept in one place for review) */
const SESSION_ROUNDS = 3;
const INTRA_ROUND_RAMP = 0.06;
const RADIUS = 20;
const HIT_RADIUS = 34;
const FADE_MS = 350;
const SHAKE_MS = 400;
const DIM_MS = 600;
const GENTLE_MS = 1200;
const SHOW_MS = 1000;
const ROUND_GAP_MS = 900;
const WIN_GAP_MS = 2800;
/* the error ripple: a red used NOWHERE else in this scene, so an
   open-water ripple is pixel-locatable by the e2e suite */
const RIPPLE_HEX = 0xff3b3b;

export class GlowFishScene extends Phaser.Scene {
  private fishG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  private fishes: FishBody[] = [];

  private spec: GameSpec | null = null;
  private done = false;

  /* round/session state */
  private round = 1;
  private baseLevel = 0.35;
  private targetType: FishType = { shape: 'round', color: 'gold' };
  private targetsToFind = 2;
  private found = 0;
  private movement: MovementMode = 'static';

  /* cognitive core (unchanged wiring from Stage 0-1 + Gate B) */
  private dda = new AdaptiveDifficulty('attention-stream');
  private signals = new LearningSignals();
  private wrongThisRound = 0;
  private sessionStart = 0;

  /* hint-ladder visual windows (game-time ms; 0 = inactive) */
  private gentleUntil = 0;
  private showAuraUntil = 0;

  constructor() { super('glow-fish'); }

  init(data: { spec?: GameSpec }): void {
    this.spec = (data && data.spec) ? data.spec : null;
  }

  preload(): void {
    showLoader(this);
    this.load.image('fish', 'art/fish.png');
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    this.done = false;
    this.found = 0;
    this.round = 1;
    this.wrongThisRound = 0;
    this.sessionStart = this.time.now;
    this.gentleUntil = 0;
    this.showAuraUntil = 0;
    this.baseLevel = this.dda.level();
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background + mascot (unchanged) */
    const bg = this.add.image(w / 2, h / 2, 'garden-bg');
    bg.setDisplaySize(w, h).setAlpha(0.5);
    const fish = this.add.image(w * 0.15, h * 0.12, 'fish');
    fish.setDisplaySize(70, 70);
    this.tweens.add({ targets: fish, y: fish.y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.rectangle(w / 2, h / 2, w, h, 0x10243e, 0.45);
    this.fishG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* progress ring: tracks the CURRENT round's targets */
    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.9, width: w * 0.85 });
    const intro = (this.spec && this.spec.narrative.intro.length > 0)
      ? this.spec.narrative.intro
      : ['הַדָּגִים מְחַפְּשִׂים אֶת הַמַּנְגִינָה.', 'מִצְאוּ אֶת הַדָּג הַזּוֹהֵר!'];
    this.dialogue.say(intro);

    this.startRound(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  /* ==========================================================
   * Round generation — the "level generator" heart (Stage 2)
   * ========================================================== */

  private effectiveLevel(round: number): number {
    return Math.max(0, Math.min(1, this.baseLevel + (round - 1) * INTRA_ROUND_RAMP));
  }

  private startRound(round: number): void {
    const level = this.effectiveLevel(round);
    const w = this.scale.width, h = this.scale.height;

    /* one number -> four knobs */
    this.targetsToFind = level < 0.5 ? 2 : 3;
    this.movement = movementModeFor(level);
    const distractorCount = (this.spec && this.spec.params.itemCount)
      ? Math.max(3, this.spec.params.itemCount - this.targetsToFind)
      : 3 + Math.floor(level * 6);

    /* fresh target kind + similarity-matched distractor kinds */
    const kinds = this.randomKind();
    this.targetType = kinds;
    const distractorKinds = selectDistractors(this.targetType, distractorCount, level);

    this.found = 0;
    this.wrongThisRound = 0;
    this.ring.setCounts(0, this.targetsToFind);
    this.spawnField(distractorKinds, w, h);
  }

  private randomKind(): FishType {
    const shapes: FishType['shape'][] = ['round', 'long', 'flat', 'angular'];
    const colors: FishType['color'][] = ['coral', 'gold', 'violet', 'mint', 'blue', 'pink'];
    return {
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  private spawnField(distractorKinds: FishType[], w: number, h: number): void {
    this.fishes = [];

    /* kinds for every fish on screen: the targets all share the
       target kind; distractors cycle the similarity-matched list */
    const kinds: Array<{ kind: FishType; isTarget: boolean }> = [];
    for (let i = 0; i < this.targetsToFind; i++) kinds.push({ kind: { ...this.targetType }, isTarget: true });
    for (let i = 0; i < distractorKinds.length; i++) {
      kinds.push({ kind: distractorKinds[i], isTarget: false });
    }

    /* jittered-grid placement: no overlaps at spawn, ever */
    const y0 = h * 0.30, y1 = h * 0.76;
    const total = kinds.length;
    const cols = Math.max(2, Math.ceil(Math.sqrt(total * (w / (y1 - y0)))));
    const rows = Math.ceil(total / cols);
    const cw = w / cols, ch = (y1 - y0) / rows;
    const cells: Array<{ cx: number; cy: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push({ cx: c * cw + cw / 2, cy: y0 + r * ch + ch / 2 });
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
    }

    kinds.forEach((entry, i) => {
      const cell = cells[i % cells.length];
      this.fishes.push({
        kind: entry.kind,
        isTarget: entry.isTarget,
        x: Phaser.Math.Clamp(cell.cx + (Math.random() - 0.5) * cw * 0.4, 34, w - 34),
        y: Phaser.Math.Clamp(cell.cy + (Math.random() - 0.5) * ch * 0.4, y0, y1),
        facing: Math.random() < 0.5 ? -1 : 1,
        phase: Math.random() * Math.PI * 2,
        alive: true,
        angle: Math.random() * Math.PI * 2,
        speed: this.startSpeed(),
        turnTimer: this.turnDelay(),
        shakeUntil: 0,
        dimUntil: 0,
        fadeStart: 0,
      });
    });
  }

  private startSpeed(): number {
    if (this.movement === 'drift') return 15 + Math.random() * 10;
    if (this.movement === 'active') return 35 + Math.random() * 20;
    return 0;
  }

  private turnDelay(): number {
    return this.movement === 'active' ? 0.8 + Math.random() * 0.8 : 1.5 + Math.random() * 1.5;
  }

  /* ==========================================================
   * Input
   * ========================================================== */

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    this.dialogue.skip();
    const hit = this.hitTest(p.x, p.y);

    if (hit === null) {
      /* open water = motor noise: a soft ripple, nothing recorded */
      this.ripple(p.x, p.y);
      return;
    }

    const fish = hit;
    if (fish.isTarget) {
      this.onFind(fish);
    } else {
      this.onWrong(fish, p);
    }
  }

  private hitTest(px: number, py: number): FishBody | null {
    /* the glowing leader is drawn last, so it is tested first */
    const leader = this.leader();
    if (leader && this.within(leader, px, py)) return leader;
    for (const f of this.fishes) {
      if (f.alive && !this.isFading(f) && this.within(f, px, py)) return f;
    }
    return null;
  }

  private within(f: FishBody, px: number, py: number): boolean {
    return Math.hypot(px - f.x, py - f.y) < HIT_RADIUS;
  }

  private onFind(fish: FishBody): void {
    fish.fadeStart = this.time.now;
    this.found++;
    this.ring.setCounts(this.found, this.targetsToFind);
    this.burst.emit(sparkleBurst(fish.x, fish.y));
    /* every find is a LearningSignals attempt (fine-grained) */
    this.signals.attempt('attention.visual', true);
    if (this.found >= this.targetsToFind) {
      this.completeRound();
    } else {
      this.dialogue.say(['וָאו! מָצָאתָ אוֹתוֹ!']);
    }
  }

  private onWrong(fish: FishBody, p: Phaser.Input.Pointer): void {
    this.wrongThisRound++;
    const kind = errorKindFor(this.targetType, fish.kind);
    /* a wrong tap is NOT a round loss (there is no fail state).
       It feeds LearningSignals + the hint ladder, never outcome(). */
    this.signals.attempt('attention.visual', false);
    this.signals.errorKind('attention.visual', kind);
    this.ripple(p.x, p.y);
    fish.shakeUntil = this.time.now + SHAKE_MS;
    fish.dimUntil = this.time.now + DIM_MS;

    /* visible, escalating help: gentle -> clear -> show */
    const hint = this.dda.suggestHint(this.wrongThisRound);
    if (hint !== 'none') this.signals.hintUsed('attention.visual');
    if (hint === 'gentle') this.gentleUntil = this.time.now + GENTLE_MS;
    if (hint === 'show') this.showAuraUntil = this.time.now + SHOW_MS;
    if (hint === 'clear' || hint === 'show') {
      this.dialogue.say([hint === 'show'
        ? 'הָאוֹר הַזָּהוֹב מְנַצְנֵץ סְבִיב הַדָּג — הַקִּישׁוּ עָלָיו'
        : 'חִפְּשׂוּ אֶת הָאוֹר הַזָּהוֹב סְבִיב הַדָּגִים']);
    } else {
      this.dialogue.say([kind === 'near-miss-same-color'
        ? 'כַּמְעַט! זֶה אוֹתוֹ צֶבַע, אֲבָל לֹא הַדָּג הַזּוֹהֵר'
        : kind === 'near-miss-same-shape'
          ? 'כַּמְעַט! זוֹ אוֹתָהּ צוּרָה, אֲבָל לֹא הַדָּג הַזּוֹהֵר'
          : 'חַפְּשִׂי אֶת הַדָּג שֶׁזּוֹהֵר!']);
    }
    if (hint === 'clear') {
      const leader = this.leader();
      if (leader) this.burst.emit(sparkleBurst(leader.x, leader.y));
    }
  }

  private ripple(x: number, y: number): void {
    this.burst.emit({
      x, y, count: 14,
      colors: [RIPPLE_HEX],
      speedMin: 15, speedMax: 60,
      sizeMin: 1, sizeMax: 2.5,
      lifeMin: 0.25, lifeMax: 0.35,
      gravity: 0, friction: 0.96,
    });
  }

  /* ==========================================================
   * Round / session boundaries (the ONLY place outcome() fires)
   * ========================================================== */

  private completeRound(): void {
    /* Gate B: one outcome per ROUND, cleanliness score per spec */
    const score = Math.max(0.3, 1 - this.wrongThisRound * 0.15);
    this.dda.outcome(true, score);
    this.dialogue.say(['מְעוּלֶה! כָּל הַדָּגִים נִמְצְאוּ!']);
    this.burst.emit(confettiBurst(this.scale.width / 2, this.scale.height * 0.4));

    if (this.round >= SESSION_ROUNDS) {
      this.win();
      return;
    }
    this.time.delayedCall(ROUND_GAP_MS, () => {
      if (this.done) return;
      this.round++;
      this.startRound(this.round);
      this.dialogue.say(['סִבּוּב נוֹסָף! חִפְּשׂוּ אֶת הַדָּג הַזּוֹהֵר!']);
    });
  }

  private win(): void {
    this.done = true;
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַדָּגִים מָצְאוּ אֶת הַמַּנְגִינָה!']);
    const secs = (this.time.now - this.sessionStart) / 1000;
    /* real elapsed seconds feed the PlayerModel tempo signal */
    recordZoneFinish('attention-stream', secs);
    this.time.delayedCall(WIN_GAP_MS, () => this.scene.start('portal'));
  }

  /* ==========================================================
   * Frame update: movement + drawing
   * ========================================================== */

  private leader(): FishBody | null {
    for (const f of this.fishes) {
      if (f.isTarget && f.alive && !this.isFading(f)) return f;
    }
    return null;
  }

  private isFading(f: FishBody): boolean {
    return f.fadeStart > 0;
  }

  private fadeAlpha(f: FishBody, now: number): number {
    if (!this.isFading(f)) return 1;
    return Math.max(0, 1 - (now - f.fadeStart) / FADE_MS);
  }

  update(time: number, delta: number): void {
    const t = time * 0.001;
    const dt = delta / 1000;
    const w = this.scale.width, h = this.scale.height;
    const now = this.time.now;
    const g = this.fishG;
    g.clear();

    this.burst.update(dt);
    this.ring.update(dt);
    this.dialogue.update(dt);

    /* bubbles rising (ambient) */
    for (let i = 0; i < 10; i++) {
      const bx = ((i * 73 + t * 10) % w);
      const by = h - ((i * 97 + t * 30) % h);
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(bx, by, 3 + (i % 3));
    }

    /* movement (drift / active only) */
    if (this.movement !== 'static') {
      const y0 = h * 0.28, y1 = h * 0.78;
      for (const f of this.fishes) {
        if (!f.alive || this.isFading(f)) continue;
        f.turnTimer -= dt;
        if (f.turnTimer <= 0) {
          f.angle += (Math.random() - 0.5) * 2.4;
          f.turnTimer = this.turnDelay();
        }
        f.x += Math.cos(f.angle) * f.speed * dt;
        f.y += Math.sin(f.angle) * f.speed * dt;
        if (f.x < 34 || f.x > w - 34) {
          f.angle = Math.PI - f.angle;
          f.x = Phaser.Math.Clamp(f.x, 34, w - 34);
        }
        if (f.y < y0 || f.y > y1) {
          f.angle = -f.angle;
          f.y = Phaser.Math.Clamp(f.y, y0, y1);
        }
        if (Math.cos(f.angle) !== 0) f.facing = Math.cos(f.angle) >= 0 ? 1 : -1;
      }
    }

    /* cleanup faded fish */
    for (const f of this.fishes) {
      if (f.alive && this.isFading(f) && now - f.fadeStart >= FADE_MS) f.alive = false;
    }

    /* draw everything normally, the glowing leader LAST (fairness:
       the target can never be covered by a passing distractor) */
    const leader = this.leader();
    for (const f of this.fishes) {
      if (f.alive && f !== leader) this.drawFish(g, f, t, now);
    }
    if (leader) this.drawFish(g, leader, t, now);
  }

  private drawFish(
    g: Phaser.GameObjects.Graphics,
    f: FishBody,
    t: number,
    now: number,
  ): void {
    const r = RADIUS;
    const leader = f === this.leader();
    const fade = this.fadeAlpha(f, now);
    if (fade <= 0) return;
    const dim = f.dimUntil > now ? 0.45 : 1;
    const alpha = fade * dim;
    const shake = f.shakeUntil > now ? Math.sin(now * 0.06) * 3 : 0;
    const x = f.x + shake;
    const y = f.y;

    if (leader) {
      /* hint ladder visuals: gentle boost / full show aura.
         The target carries the light: only the leader is gold. */
      const hintShow = this.showAuraUntil > now;
      const hintGentle = this.gentleUntil > now;
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      if (hintShow) {
        g.fillStyle(TARGET_GLOW_HEX, 0.85);
        g.fillCircle(x, y, r * 3.2);
        g.fillStyle(TARGET_GLOW_HEX, 0.95);
        g.fillCircle(x, y, r * 2.4);
      } else {
        const a = 0.18 * pulse * (hintGentle ? 1.7 : 1);
        g.fillStyle(TARGET_GLOW_HEX, Math.min(0.5, a));
        g.fillCircle(x, y, r * 2.4);
        g.fillStyle(TARGET_GLOW_HEX, 0.3 * pulse);
        g.fillCircle(x, y, r * 1.6);
      }
      this.drawShape(g, x, y, f.kind, TARGET_GLOW_HEX, alpha, f.facing, t, f.phase);
      return;
    }

    this.drawShape(g, x, y, f.kind, FISH_COLOR_HEX[f.kind.color], alpha, f.facing, t, f.phase);
  }

  /* one shared body renderer for every fish (target kind included);
     only the leader gets the gold light drawn around it */
  private drawShape(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    kind: FishType,
    hex: number,
    alpha: number,
    facing: 1 | -1,
    t: number,
    phase: number,
  ): void {
    const r = RADIUS;
    const wag = Math.sin(t * 6 + phase) * 4;
    g.fillStyle(hex, alpha);

    switch (kind.shape) {
      case 'round':
        g.fillEllipse(x, y, r * 2, r * 1.5);
        break;
      case 'long':
        g.fillEllipse(x, y, r * 2.6, r * 1.1);
        break;
      case 'flat':
        g.fillEllipse(x, y, r * 2.2, r * 1.6);
        g.fillTriangle(x - r * 0.2, y - r * 0.6, x + r * 0.4, y - r * 0.6, x + r * 0.1, y - r * 1.35);
        g.fillTriangle(x - r * 0.2, y + r * 0.6, x + r * 0.4, y + r * 0.6, x + r * 0.1, y + r * 1.35);
        break;
      case 'angular':
        g.fillPoints([
          { x: x - r, y: y - 4 },
          { x: x - r * 0.4, y: y - r * 0.9 },
          { x: x + r * 0.4, y: y - r * 0.9 },
          { x: x + r, y: y - 4 },
          { x: x + r * 0.5, y: y + r * 0.85 },
          { x: x - r * 0.5, y: y + r * 0.85 },
        ], true);
        break;
    }

    /* tail swims opposite the nose */
    g.fillTriangle(
      x - facing * r * 0.9, y,
      x - facing * r * 1.6, y - 8 + wag,
      x - facing * r * 1.6, y + 8 + wag,
    );

    /* eye near the nose */
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(x + facing * r * 0.5, y - 3, 4);
    g.fillStyle(0x0a0416, alpha);
    g.fillCircle(x + facing * r * 0.55, y - 3, 2);
  }
}
