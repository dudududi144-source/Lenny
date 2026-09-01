/* Lightweight tween engine driving every Pixi scene.
   All easing is spring-soft (matching the CSS motion tokens);
   nothing in the game layer moves linearly. */

export type Easing = (t: number) => number;

export const ease = {
  linear: (t: number): number => t,
  inQuad: (t: number): number => t * t,
  outQuad: (t: number): number => t * (2 - t),
  outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number): number => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t: number): number =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
} satisfies Record<string, Easing>;

export interface TweenOptions {
  durationMs: number;
  ease?: Easing;
  delayMs?: number;
  onDone?: () => void;
}

export interface TweenHandle {
  kill(): void;
}

type NumberBox = Record<string, number>;

interface TweenRec {
  target: NumberBox;
  props: Array<{ key: string; to: number; from: number }>;
  age: number;
  durationMs: number;
  ease: Easing;
  delayMs: number;
  onDone?: () => void;
  killed: boolean;
  started: boolean;
}

interface LoopRec {
  fn: (dtMs: number, elapsedMs: number) => void;
  elapsed: number;
  killed: boolean;
}

interface AfterRec {
  remaining: number;
  cb: () => void;
  killed: boolean;
}

export class AnimationSystem {
  private tweens: TweenRec[] = [];
  private loops: LoopRec[] = [];
  private afters: AfterRec[] = [];

  /** Tween numeric properties of any object (e.g. sprite.x, scale, alpha). */
  to(target: object, props: Record<string, number>, options: TweenOptions): TweenHandle {
    const box = target as NumberBox;
    const rec: TweenRec = {
      target: box,
      props: Object.entries(props).map(([key, to]) => ({ key, to, from: NaN })),
      age: 0,
      durationMs: Math.max(1, options.durationMs),
      ease: options.ease ?? ease.outCubic,
      delayMs: options.delayMs ?? 0,
      onDone: options.onDone,
      killed: false,
      started: false,
    };
    this.tweens.push(rec);
    return { kill: () => { rec.killed = true; } };
  }

  /** Delayed callback, killable — safer than setTimeout inside scenes. */
  after(delayMs: number, cb: () => void): TweenHandle {
    const rec: AfterRec = { remaining: delayMs, cb, killed: false };
    this.afters.push(rec);
    return { kill: () => { rec.killed = true; } };
  }

  /** Per-frame callback (bobbing, pulsing, wandering). Returns a cancel fn. */
  loop(fn: (dtMs: number, elapsedMs: number) => void): () => void {
    const rec: LoopRec = { fn, elapsed: 0, killed: false };
    this.loops.push(rec);
    return () => { rec.killed = true; };
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 66); /* clamp tab-switch jumps */

    for (const rec of this.afters) {
      if (rec.killed) continue;
      rec.remaining -= dt;
      if (rec.remaining <= 0) {
        rec.killed = true;
        try {
          rec.cb();
        } catch {
          /* a dead callback must never kill the ticker */
        }
      }
    }
    this.afters = this.afters.filter((rec) => !rec.killed);

    for (const rec of this.tweens) {
      if (rec.killed) continue;
      /* a destroyed view must never be written again (Pixi nulls its
         transform on destroy) — kill the tween silently instead */
      const box = rec.target as { destroyed?: unknown } | null;
      if (box && typeof box === 'object' && box.destroyed === true) {
        rec.killed = true;
        continue;
      }
      rec.age += dt;
      if (rec.age < rec.delayMs) continue;
      if (!rec.started) {
        rec.started = true;
        for (const p of rec.props) p.from = rec.target[p.key];
      }
      const raw = Math.min(1, (rec.age - rec.delayMs) / rec.durationMs);
      const t = rec.ease(raw);
      try {
        for (const p of rec.props) {
          rec.target[p.key] = p.from + (p.to - p.from) * t;
        }
      } catch {
        rec.killed = true;
        continue;
      }
      if (raw >= 1) {
        rec.killed = true;
        try {
          rec.onDone?.();
        } catch {
          /* never kill the ticker from an onDone */
        }
      }
    }
    this.tweens = this.tweens.filter((rec) => !rec.killed);

    for (const rec of this.loops) {
      if (rec.killed) continue;
      rec.elapsed += dt;
      try {
        rec.fn(dt, rec.elapsed);
      } catch {
        rec.killed = true; /* a broken loop cancels itself, not the frame */
      }
    }
    this.loops = this.loops.filter((rec) => !rec.killed);
  }

  destroy(): void {
    for (const rec of this.tweens) rec.killed = true;
    for (const rec of this.loops) rec.killed = true;
    for (const rec of this.afters) rec.killed = true;
    this.tweens = [];
    this.loops = [];
    this.afters = [];
  }
}
