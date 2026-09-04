/* ============================================================
 * FpsGovernor — the world's performance steward (pure logic).
 *
 * Stage 7 perf contract:
 *   - desktop ≥ 60fps, mid-range phones ≥ 30fps
 *   - CI floor: ≥ 20fps sustained for 10s
 *   - below 25fps → automatic hardware scaling (softer pixels,
 *     never a stall)
 *   - below 10fps sustained 8s → distress signal (the shell
 *     silently falls back to the classic garden). Stage 13 retune:
 *     real software renderers (SwiftShader cloud previews) hold a
 *     CALM garden at 10-15fps — that is playable, never distress;
 *     the old 15x5s floor kept killing healthy worlds on those
 *     devices ~11s after every entry.
 *
 * Pure: the caller feeds frame times, the governor only decides.
 * WorldApp applies the decisions to the real engine.
 * ============================================================ */

export interface GovernorOptions {
  /** below this the resolution softens (auto hardware scaling) */
  softFps?: number;
  /** below this, sustained, the world is too heavy for the device */
  minFps?: number;
  /** how long fps may stay below minFps before distress (ms) */
  distressMs?: number;
  /** shader-compilation warmup: distress never arms during this */
  distressGraceMs?: number;
  /** hard cap for the hardware-scaling multiplier */
  maxScale?: number;
  /** how hard one scaling step pushes (1.15 = +15% softer pixels) */
  scaleStep?: number;
  /** the engine's base hardware scaling level (1 / min(dpr, 2)) */
  baseScale?: number;
  /** minimum interval between two scaling decisions (ms) */
  decisionMs?: number;
}

export interface GovernorDecision {
  /** what the hardware-scaling level should become */
  newScale: number;
  /** true exactly once when the sustained-low-fps budget is spent */
  distress: boolean;
}

const DEFAULTS = {
  softFps: 25,
  minFps: 10,
  distressMs: 8000,
  /** shader-compilation warmup: distress never arms during this */
  distressGraceMs: 6000,
  maxScale: 3.6,
  scaleStep: 1.15,
  baseScale: 1,
  decisionMs: 400,
  windowMs: 1500,
};

export class FpsGovernor {
  private readonly softFps: number;
  private readonly minFps: number;
  private readonly distressMs: number;
  private readonly distressGraceMs: number;
  private readonly maxScale: number;
  private readonly scaleStep: number;
  private readonly baseScale: number;
  private readonly decisionMs: number;
  private readonly windowMs: number;

  private frames: Array<{ t: number; dt: number }> = [];
  private lastDecision = 0;
  private distressSince: number | null = null;
  private distressed = false;
  private firstFrameAt: number | null = null;
  private prevDecisionFps = 0;
  /** a known-heavy spectacle (the balloon vista) is airborne */
  private spectacle = false;

  constructor(opts: GovernorOptions = {}) {
    const o = { ...DEFAULTS, ...opts };
    this.softFps = o.softFps;
    this.minFps = o.minFps;
    this.distressMs = o.distressMs;
    this.distressGraceMs = o.distressGraceMs;
    this.maxScale = o.maxScale;
    this.scaleStep = o.scaleStep;
    this.baseScale = o.baseScale;
    this.decisionMs = o.decisionMs;
    this.windowMs = o.windowMs;
  }

  /** Feed one rendered frame (timestamps in ms, monotonic-ish). */
  push(now: number, dtMs: number): void {
    if (this.firstFrameAt === null) this.firstFrameAt = now;
    this.frames.push({ t: now, dt: Math.max(0.001, dtMs) });
    const cutoff = now - this.windowMs;
    while (this.frames.length > 0 && this.frames[0].t < cutoff) this.frames.shift();
  }

  /** Average fps over the trailing window (0 when not enough data). */
  fps(now: number): number {
    const cutoff = now - 1000;
    let dtSum = 0;
    let n = 0;
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i];
      if (f.t < cutoff) break;
      dtSum += f.dt;
      n++;
    }
    if (n === 0 || dtSum <= 0) return 0;
    return (1000 * n) / dtSum;
  }

  /**
   * Decide once per `decisionMs`. Returns the scale to apply and a
   * one-shot distress flag (false again until the fps recovers above
   * `minFps` and the budget is spent anew).
   */
  evaluate(now: number, currentScale: number): GovernorDecision {
    let newScale = currentScale;
    let distress = false;

    if (now - this.lastDecision < this.decisionMs) return { newScale, distress };

    const fps = this.fps(now);
    this.lastDecision = now;

    if (fps > 0) {
      if (fps < this.softFps) {
        newScale = Math.min(this.maxScale, currentScale * this.scaleStep);
      } else if (fps > 55 && currentScale > this.baseScale) {
        newScale = Math.max(this.baseScale, currentScale * 0.94);
      }
    }

    if (!this.spectacle && fps > 0 && fps < this.minFps && this.firstFrameAt !== null && now - this.firstFrameAt >= this.distressGraceMs) {
      /* recovery-aware distress (audit 9-b follow-up): a weak device that
         is CLIMBING out of the hole (wide canvas booted 4→10→13fps and was
         still killed mid-recovery) gets its budget paused while the trend
         is up — only a stalled or falling fps below the floor is distress. */
      const improving = this.prevDecisionFps > 0 && fps >= this.prevDecisionFps * 1.25;
      if (improving) {
        this.distressSince = null;
      } else {
        if (this.distressSince === null) this.distressSince = now;
        if (!this.distressed && now - this.distressSince >= this.distressMs) {
          this.distressed = true;
          distress = true;
        }
      }
    } else {
      this.distressSince = null;
      this.distressed = false;
    }

    if (fps > 0) this.prevDecisionFps = fps;
    return { newScale, distress };
  }

  /**
   * A known-heavy spectacle is running (the balloon vista flight):
   * the resolution still softens every decision, but the spectacle
   * itself is never judged "too heavy" — a 26-second promise to a
   * child is kept in full. Distress re-arms honestly once the feet
   * touch the ground (spectacle off).
   */
  setSpectacle(on: boolean): void {
    if (on) {
      this.distressSince = null;
      this.distressed = false;
    }
    this.spectacle = on;
  }

  /** Forget history (used on resume after a pause — the engine is warm). */
  reset(): void {
    this.frames = [];
    this.lastDecision = 0;
    this.distressSince = null;
    this.distressed = false;
    this.firstFrameAt = null;
  }
}
