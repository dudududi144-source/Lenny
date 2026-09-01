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
  outBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
} satisfies Record<string, Easing>;

/* cubic-bezier(0.4, 0, 0.2, 1) — the shared entrance/exit curve (Stage 5).
   Lives beside the named easings so DOM CSS and canvas tweens agree. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const X = sampleX(t) - x;
      if (Math.abs(X) < 1e-5) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= X / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

/** the standard smooth curve, exported for scenes that hand-roll choreography */
export const easeStandard: Easing = cubicBezier(0.4, 0, 0.2, 1);

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

interface TweenProp {
  obj: NumberBox;
  key: string;
  to: number;
  from: number;
}

interface TweenRec {
  target: NumberBox;
  props: TweenProp[];
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

  /**
   * Tween numeric properties of any object (e.g. sprite.x, alpha, width).
   * Point-valued props (container.scale, container.pivot, container.position)
   * are auto-detected and tweened as their numeric x/y — a uniform number
   * target scales both axes. Writing a Point object directly would corrupt
   * the transform (NaN), which is exactly what this guard prevents.
   */
  to(target: object, props: Record<string, number>, options: TweenOptions): TweenHandle {
    const box = target as NumberBox;
    const expanded: TweenProp[] = [];
    for (const [key, to] of Object.entries(props)) {
      const cur = (target as Record<string, unknown>)[key];
      if (
        typeof to === 'number' &&
        cur && typeof cur === 'object' &&
        typeof (cur as NumberBox).x === 'number' &&
        typeof (cur as NumberBox).y === 'number'
      ) {
        const pt = cur as NumberBox;
        expanded.push({ obj: pt, key: 'x', to, from: NaN });
        expanded.push({ obj: pt, key: 'y', to, from: NaN });
      } else {
        expanded.push({ obj: box, key, to, from: NaN });
      }
    }
    const rec: TweenRec = {
      target: box,
      props: expanded,
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
        for (const p of rec.props) p.from = p.obj[p.key];
      }
      const raw = Math.min(1, (rec.age - rec.delayMs) / rec.durationMs);
      const t = rec.ease(raw);
      try {
        for (const p of rec.props) {
          p.obj[p.key] = p.from + (p.to - p.from) * t;
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
