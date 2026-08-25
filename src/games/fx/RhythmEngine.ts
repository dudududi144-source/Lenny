/* ============================================================
 * RhythmEngine — a reusable timing/beat-detection system.
 *
 * Why this exists: rhythm games need to judge WHEN a tap happens
 * relative to a beat. Instead of re-implementing timing windows
 * in every rhythm scene, we build ONE solid engine and reuse it.
 *
 * Design notes (the "exemplar" part):
 *  - Beat map is data-driven: an array of target times (seconds).
 *  - Judgment windows are configurable (perfect / good / miss).
 *  - The engine is stateless between hits — easy to test.
 *  - Works with any clock source (scene time, performance.now).
 *
 * Usage in a scene:
 *   const engine = new RhythmEngine({ bpm: 90, beats: 8 });
 *   engine.start(now());
 *   ... on tap: const j = engine.judge(now());
 *   j.grade === 'perfect' | 'good' | 'miss'
 * ============================================================ */

export type BeatGrade = 'perfect' | 'good' | 'miss';

export interface Judgment {
  grade: BeatGrade;
  /* signed offset in seconds: negative = early, positive = late */
  offset: number;
  /* which beat index was judged (-1 if none nearby) */
  beatIndex: number;
}

export interface RhythmConfig {
  /* beats per minute */
  bpm: number;
  /* how many beats in the pattern */
  beats: number;
  /* seconds of tolerance around each beat */
  perfectWindow?: number;
  goodWindow?: number;
  /* optional offset before first beat (count-in) */
  leadIn?: number;
}

export class RhythmEngine {
  private cfg: Required<RhythmConfig>;
  private beatTimes: number[] = [];
  private judged: boolean[] = [];
  private startTime = 0;
  private running = false;

  constructor(cfg: RhythmConfig) {
    this.cfg = {
      bpm: cfg.bpm,
      beats: cfg.beats,
      perfectWindow: cfg.perfectWindow ?? 0.12,
      goodWindow: cfg.goodWindow ?? 0.28,
      leadIn: cfg.leadIn ?? 1.2,
    };
    const interval = 60 / this.cfg.bpm;
    for (let i = 0; i < this.cfg.beats; i++) {
      this.beatTimes.push(this.cfg.leadIn + i * interval);
      this.judged.push(false);
    }
  }

  /** Begin the pattern. Pass the current clock time in seconds. */
  start(now: number): void {
    this.startTime = now;
    this.running = true;
    for (let i = 0; i < this.judged.length; i++) this.judged[i] = false;
  }

  /** Elapsed pattern time in seconds. */
  elapsed(now: number): number {
    return this.running ? now - this.startTime : 0;
  }

  /** Is the whole pattern finished? */
  isDone(now: number): boolean {
    const last = this.beatTimes[this.beatTimes.length - 1] ?? 0;
    return this.elapsed(now) > last + this.cfg.goodWindow;
  }

  /**
   * Judge a tap at clock time `now`.
   * Finds the closest un-judged beat and grades the offset.
   */
  judge(now: number): Judgment {
    const t = this.elapsed(now);
    let bestIdx = -1;
    let bestAbs = Infinity;
    for (let i = 0; i < this.beatTimes.length; i++) {
      if (this.judged[i]) continue;
      const off = t - this.beatTimes[i];
      const abs = Math.abs(off);
      if (abs < bestAbs) {
        bestAbs = abs;
        bestIdx = i;
      }
    }

    if (bestIdx === -1 || bestAbs > this.cfg.goodWindow) {
      return { grade: 'miss', offset: 0, beatIndex: -1 };
    }

    this.judged[bestIdx] = true;
    const offset = t - this.beatTimes[bestIdx];
    const grade: BeatGrade = bestAbs <= this.cfg.perfectWindow ? 'perfect' : 'good';
    return { grade, offset, beatIndex: bestIdx };
  }

  /** How many beats were hit with at least a 'good' grade. */
  hits(): number {
    let n = 0;
    for (const j of this.judged) if (j) n++;
    return n;
  }

  /** Total number of beats in the pattern. */
  total(): number {
    return this.cfg.beats;
  }

  /** Upcoming beat times (for drawing falling notes), relative to pattern start. */
  upcoming(now: number, horizon: number): number[] {
    const t = this.elapsed(now);
    const out: number[] = [];
    for (const bt of this.beatTimes) {
      if (bt >= t && bt <= t + horizon) out.push(bt - t);
    }
    return out;
  }
}
