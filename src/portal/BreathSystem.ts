/* ============================================================
 * BreathSystem — guided box-breathing for children (4-2-4)
 * Drives the breathing circle during the BREATH portal state.
 * Pure time-based state machine; no scene coupling.
 * ============================================================ */

export type BreathPhase = 'inhale' | 'hold' | 'exhale';

export interface BreathTimings {
  inhale: number;
  hold: number;
  exhale: number;
}

export class BreathSystem {
  private t = 0;
  private cycles = 0;
  private phase: BreathPhase = 'inhale';

  constructor(private timings: BreathTimings) {}

  /** Advance by dt seconds. */
  update(dt: number): void {
    this.t += dt;
    const { inhale, hold, exhale } = this.timings;
    if (this.phase === 'inhale' && this.t >= inhale) {
      this.t -= inhale;
      this.phase = 'hold';
    } else if (this.phase === 'hold' && this.t >= hold) {
      this.t -= hold;
      this.phase = 'exhale';
    } else if (this.phase === 'exhale' && this.t >= exhale) {
      this.t -= exhale;
      this.phase = 'inhale';
      this.cycles++;
    }
  }

  getPhase(): BreathPhase {
    return this.phase;
  }

  /** Completed full cycles. */
  getCycles(): number {
    return this.cycles;
  }

  /**
   * Circle scale target in [0, 1].
   * inhale: 0 -> 1 (easeOut), hold: 1, exhale: 1 -> 0 (easeIn).
   */
  getScale(): number {
    const { inhale, exhale } = this.timings;
    if (this.phase === 'inhale') {
      const p = Math.min(1, this.t / inhale);
      return this.easeOutCubic(p);
    }
    if (this.phase === 'hold') {
      return 1;
    }
    const p = Math.min(1, this.t / exhale);
    return 1 - this.easeInCubic(p);
  }

  /** Hebrew guidance label for the current phase (with niqqud). */
  getLabel(): string {
    if (this.phase === 'inhale') return '\u05e9\u05b0\u05c1\u05d0\u05b4\u05d9...';       /* שְׁאִי... */
    if (this.phase === 'hold') return '\u05d4\u05b7\u05d7\u05b2\u05d6\u05b4\u05d9\u05e7\u05b4\u05d9...';  /* הָחֲזִיקִי... */
    return '\u05e0\u05b4\u05e9\u05b0\u05c1\u05e4\u05b4\u05d9...';                       /* נִשְׁפִּי... */
  }

  private easeOutCubic(p: number): number {
    return 1 - Math.pow(1 - p, 3);
  }

  private easeInCubic(p: number): number {
    return p * p * p;
  }

  reset(): void {
    this.t = 0;
    this.cycles = 0;
    this.phase = 'inhale';
  }
}
