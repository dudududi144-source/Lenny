import { Container, Graphics, Sprite } from 'pixi.js';
import {
  FISH_COLOR_HEX,
  TARGET_GLOW_HEX,
  errorKindFor,
  movementModeFor,
  selectDistractors,
  type FishType,
  type MovementMode,
} from '../fx/FishTypes';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { discTexture, softGlowTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import type { LearningSignals } from '../core/LearningSignals';

const SESSION_ROUNDS = 3;
const INTRA_ROUND_RAMP = 0.06;
const RADIUS = 20;
const HIT_RADIUS = 34;
const FADE_MS = 350;
const SPAWN_MS = 300;
const ROUND_GAP_MS = 900;
const GENTLE_MS = 1200;
const SHOW_MS = 1000;

/* Play band — identical proportions to the old Phaser scene */
const BAND_TOP = 0.3;
const BAND_BOTTOM = 0.76;

interface Fish {
  view: Container;
  kind: FishType;
  isTarget: boolean;
  cellIndex: number;
  vx: number;
  vy: number;
  turnDelayMs: number;
  turnAt: number;
  bobPhase: number;
  mode: MovementMode;
  leaving: boolean;
}

interface Cell {
  x: number;
  y: number;
  taken: boolean;
}

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((hex & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * GlowFish — "find the glowing fish" (attention-stream).
 * Ported 1:1 from the Phaser level generator: similarity-driven pond,
 * exactly ONE live target-kind fish, intra-session ramp, visible hint
 * ladder. Rendering is now PixiJS with baked gradient glows.
 */
export class GlowFishScene extends GameScene {
  private round = 0;
  private found = 0;
  private toFind = 2;
  private wrongThisRound = 0;
  private targetKind: FishType | null = null;
  private fishes: Fish[] = [];
  private cells: Cell[] = [];
  private pond = new Container();
  private gentleUntil = 0;
  private showUntil = 0;
  private lastHint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private transitioning = false;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.root.addChild(this.pond);
    this.build();
  }

  protected build(): void {
    const spec = this.ctx.spec;
    const intro = spec?.narrative.intro ?? ['הַדָּגִים מְחַפְּשִׂים אֶת הַמַּנְגִינָה. בּוֹא נַקְשִׁיב יַחַד!'];
    this.say(intro);
    this.startRound();
  }

  /* ---------- level → pond plan (same DDA mapping as the original) ---------- */

  private effectiveLevel(): number {
    const base = this.dda.level();
    return Math.min(1, Math.max(0, base + (this.round - 1) * INTRA_ROUND_RAMP));
  }

  private startRound(): void {
    this.round++;
    const level = this.effectiveLevel();
    this.found = 0;
    this.wrongThisRound = 0;
    this.transitioning = false;
    this.lastHint = 'none';
    this.gentleUntil = 0;
    this.showUntil = 0;

    this.toFind = level < 0.5 ? 2 : 3;
    const mode = movementModeFor(level);
    const distractorCount = this.ctx.spec?.params.itemCount
      ? Math.max(3, this.ctx.spec.params.itemCount - this.toFind)
      : 3 + Math.floor(level * 6);

    /* random target kind from the 4x6 matrix */
    const shapes = ['round', 'long', 'flat', 'angular'] as const;
    const colors = ['coral', 'gold', 'violet', 'mint', 'blue', 'pink'] as const;
    this.targetKind = {
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
    };

    this.clearFish();
    this.layoutCells(distractorCount + 1);

    const distractorKinds = selectDistractors(this.targetKind, distractorCount, level);
    for (const kind of distractorKinds) this.spawnFish(kind, false, mode, level);
    this.spawnLeader(mode);

    this.ctx.hud.ringCounts(this.found, this.toFind);
  }

  private layoutCells(count: number): void {
    const cols = 4;
    const rows = Math.max(2, Math.ceil(count / cols));
    const left = 44;
    const right = this.w - 44;
    const top = this.h * BAND_TOP + 10;
    const bottom = this.h * BAND_BOTTOM - 10;
    const cellW = (right - left) / cols;
    const cellH = (bottom - top) / rows;
    this.cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.cells.push({
          x: left + cellW * (c + 0.5) + (Math.random() - 0.5) * cellW * 0.24,
          y: top + cellH * (r + 0.5) + (Math.random() - 0.5) * cellH * 0.24,
          taken: false,
        });
      }
    }
  }

  private freeCell(): Cell | null {
    const free = this.cells.filter((c) => !c.taken);
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  /* ---------- fish rendering (gradients + shape variants) ---------- */

  private buildFishView(kind: FishType, isTarget: boolean): { view: Container; glow: Sprite } {
    const hex = FISH_COLOR_HEX[kind.color];
    const view = new Container();

    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = isTarget ? TARGET_GLOW_HEX : hex;
    glow.blendMode = 'add';
    glow.alpha = isTarget ? 0.5 : 0.14;
    glow.width = isTarget ? 108 : 62;
    glow.height = isTarget ? 108 : 62;
    view.addChild(glow);

    const tail = new Graphics();
    const tailColor = shade(hex, 0.72);
    tail.moveTo(-RADIUS * 0.7, 0);
    tail.lineTo(-RADIUS * 1.55, -RADIUS * 0.62);
    tail.lineTo(-RADIUS * 1.55, RADIUS * 0.62);
    tail.closePath();
    tail.fill({ color: tailColor, alpha: 0.95 });
    view.addChild(tail);

    const body = new Sprite(discTexture());
    body.anchor.set(0.5);
    body.tint = hex;
    const proportions: Record<string, [number, number]> = {
      round: [1, 0.85],
      long: [1.4, 0.62],
      flat: [0.82, 1.02],
      angular: [1.1, 0.78],
    };
    const [sx, sy] = proportions[kind.shape] ?? [1, 0.85];
    body.width = RADIUS * 2 * sx;
    body.height = RADIUS * 2 * sy;
    body.x = RADIUS * 0.12 * sx;
    view.addChild(body);

    const fin = new Graphics();
    fin.moveTo(RADIUS * 0.1, -RADIUS * 0.28 * sy);
    fin.lineTo(RADIUS * 0.52, -RADIUS * 0.72 * sy);
    fin.lineTo(RADIUS * 0.58, -RADIUS * 0.2 * sy);
    fin.closePath();
    fin.fill({ color: shade(hex, 0.8), alpha: 0.9 });
    view.addChild(fin);

    const eye = new Graphics();
    eye.circle(RADIUS * 0.42 * sx, -RADIUS * 0.18 * sy, 4.6).fill({ color: 0xffffff });
    eye.circle(RADIUS * 0.48 * sx, -RADIUS * 0.16 * sy, 2.4).fill({ color: 0x1c1430 });
    view.addChild(eye);

    return { view, glow };
  }

  private spawnFish(kind: FishType, isTarget: boolean, mode: MovementMode, level: number): void {
    const cell = this.freeCell();
    if (!cell) return;
    cell.taken = true;
    const { view } = this.buildFishView(kind, isTarget);
    view.x = cell.x;
    view.y = cell.y;
    view.alpha = 0;
    this.pond.addChild(view);
    this.anim.to(view, { alpha: 1 }, { durationMs: SPAWN_MS, ease: ease.outQuad });

    const speedRange: Record<MovementMode, [number, number, number, number]> = {
      static: [0, 0, 0, 0],
      drift: [15, 25, 1500, 3000],
      active: [35, 55, 800, 1600],
    };
    const [smin, smax, tmin, tmax] = speedRange[mode];
    const angle = Math.random() * Math.PI * 2;
    const speed = smin + Math.random() * (smax - smin);
    const turnDelay = tmin + Math.random() * (tmax - tmin);
    const fish: Fish = {
      view,
      kind,
      isTarget,
      cellIndex: this.cells.indexOf(cell),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      turnDelayMs: turnDelay,
      turnAt: this.t + turnDelay,
      bobPhase: Math.random() * Math.PI * 2,
      mode,
      leaving: false,
    };
    this.fishes.push(fish);

    /* gentle idle bob keeps the pond alive even in static mode */
    this.anim.loop(() => {
      if (fish.leaving || mode !== 'static') return;
      view.y = cell.y + Math.sin(this.t / 900 + fish.bobPhase) * 3;
      view.x = cell.x + Math.sin(this.t / 1300 + fish.bobPhase) * 2;
    });
    void level;
  }

  private spawnLeader(mode: MovementMode): void {
    if (!this.targetKind) return;
    const level = this.effectiveLevel();
    this.spawnFish(this.targetKind, true, mode, level);
  }

  private clearFish(): void {
    for (const fish of this.fishes) {
      fish.leaving = true;
      fish.view.destroy({ children: true });
    }
    this.fishes = [];
    this.cells = [];
  }

  /* ---------- gameplay ---------- */

  update(dtMs: number): void {
    super.update(dtMs);
    const now = this.t;

    for (const fish of this.fishes) {
      if (fish.leaving || fish.view.destroyed || fish.mode === 'static') continue;
      if (now >= fish.turnAt) {
        fish.turnAt = now + fish.turnDelayMs;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.hypot(fish.vx, fish.vy) || 20;
        fish.vx = Math.cos(angle) * speed;
        fish.vy = Math.sin(angle) * speed;
      }
      fish.view.x += (fish.vx * dtMs) / 1000;
      fish.view.y += (fish.vy * dtMs) / 1000;
      const minX = 36;
      const maxX = this.w - 36;
      const minY = this.h * BAND_TOP + 6;
      const maxY = this.h * BAND_BOTTOM + 6;
      if (fish.view.x < minX || fish.view.x > maxX) fish.vx *= -1;
      if (fish.view.y < minY || fish.view.y > maxY) fish.vy *= -1;
      fish.view.x = Math.min(maxX, Math.max(minX, fish.view.x));
      fish.view.y = Math.min(maxY, Math.max(minY, fish.view.y));

      /* face the swimming direction */
      if (Math.abs(fish.vx) > 4) fish.view.scale.x = fish.vx < 0 ? -1 : 1;
    }

    /* live hint glow: stronger while gentle/show windows are active */
    for (const fish of this.fishes) {
      if (fish.leaving || fish.view.destroyed || !fish.isTarget) continue;
      const glow = fish.view.children[0] as Sprite;
      const base = 0.5;
      const gentle = now < this.gentleUntil ? 0.34 : 0;
      const show = now < this.showUntil ? 0.5 : 0;
      const pulse = 0.08 * Math.sin(now / 240);
      glow.alpha = Math.min(1, base + gentle + show + pulse);
    }
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.transitioning) return false;

    const hit = this.fishes.find(
      (fish) => !fish.leaving && Math.hypot(fish.view.x - x, fish.view.y - y) <= HIT_RADIUS,
    );
    if (!hit) {
      /* open water: ripple only, nothing recorded (original behavior) */
      this.ripple(x, y, 0xff3b3b);
      return false;
    }

    if (hit.isTarget) {
      this.onFind(hit);
      return true;
    }

    this.onWrongTap(hit);
    return true;
  }

  private onFind(fish: Fish): void {
    this.found++;
    this.signals.attempt('attention.visual', true);
    this.sparkle(fish.view.x, fish.view.y, [TARGET_GLOW_HEX, COLORS.glowSoft, 0xffffff]);
    this.say(['וָאו! מָצָאתָ אוֹתוֹ!']);
    this.ctx.hud.ringCounts(this.found, this.toFind);

    const x = fish.view.x;
    const y = fish.view.y;
    fish.leaving = true;
    this.anim.to(fish.view, { alpha: 0 }, { durationMs: FADE_MS, ease: ease.inQuad, onDone: () => {
      fish.view.destroy({ children: true });
    } });
    this.fishes = this.fishes.filter((f) => f !== fish);
    const cell = this.cells[fish.cellIndex];
    if (cell) cell.taken = false;

    if (this.found >= this.toFind) {
      this.completeRound();
      return;
    }

    /* exactly ONE live target-kind fish at any moment: respawn after fade */
    this.anim.after(SPAWN_MS + 40, () => {
      if (this.isFinished() || this.transitioning) return;
      this.spawnLeader(this.movementForNow());
      void x;
      void y;
    });
  }

  private movementForNow(): MovementMode {
    return movementModeFor(this.effectiveLevel());
  }

  private onWrongTap(fish: Fish): void {
    this.wrongThisRound++;
    this.signals.attempt('attention.visual', false);
    if (this.targetKind) {
      this.signals.errorKind('attention.visual', errorKindFor(this.targetKind, fish.kind));
      const near = errorKindFor(this.targetKind, fish.kind);
      if (near === 'near-miss-same-color') this.say(['כַּמְעַט! זֶה אוֹתוֹ צֶבַע, אֲבָל לֹא הַדָּג הַזּוֹהֵר']);
      else this.say(['לֹא הַדָּג הַזּוֹהֵר — חִפְּשׂוּ שׁוּב']);
    }

    const hint = this.suggestHint(this.wrongThisRound);
    this.lastHint = hint;
    if (hint !== 'none') this.signals.hintUsed('attention.visual');
    if (hint === 'gentle') {
      this.gentleUntil = this.t + GENTLE_MS;
    } else if (hint === 'clear') {
      this.say(['חִפְּשׂוּ אֶת הָאוֹר הַזָּהוֹב סְבִיב הַדָּגִים']);
      const leader = this.fishes.find((f) => f.isTarget && !f.leaving);
      if (leader) this.sparkle(leader.view.x, leader.view.y, [TARGET_GLOW_HEX, 0xffffff]);
    } else if (hint === 'show') {
      this.showUntil = this.t + SHOW_MS;
      this.say(['הָאוֹר הַזָּהוֹב מְנַצְנֵץ סְבִיב הַדָּג — הַקִּישׁוּ עָלָיו']);
      const leader = this.fishes.find((f) => f.isTarget && !f.leaving);
      if (leader) this.ripple(leader.view.x, leader.view.y, TARGET_GLOW_HEX);
    }
  }

  private completeRound(): void {
    this.transitioning = true;
    this.dda.outcome(true, Math.max(0.3, 1 - this.wrongThisRound * 0.15));

    if (this.round >= SESSION_ROUNDS) {
      this.finish(2600);
      return;
    }
    this.anim.after(ROUND_GAP_MS, () => {
      if (this.isFinished()) return;
      this.startRound();
    });
  }

  debugState(): Record<string, unknown> {
    const alive = this.fishes.filter((f) => !f.leaving && !f.view.destroyed);
    const leader = alive.find((f) => f.isTarget);
    return {
      kind: 'glow-fish',
      round: this.round,
      totalRounds: SESSION_ROUNDS,
      found: this.found,
      toFind: this.toFind,
      hint: this.lastHint,
      done: this.isFinished(),
      leader: leader ? { x: Math.round(leader.view.x), y: Math.round(leader.view.y) } : null,
      fishCount: alive.length,
      fishes: alive.map((f) => ({ x: Math.round(f.view.x), y: Math.round(f.view.y), target: f.isTarget })),
    };
  }
}

/* keep LearningSignals type visible for tooling imports */
export type { LearningSignals };
