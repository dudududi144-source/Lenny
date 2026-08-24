/* ============================================================
 * ThetaPulse — visual theta-wave entrainment
 * A precise sinusoidal oscillator in the theta band (4-8Hz).
 * Used to modulate glow/alpha of sparks and rings so the
 * viewer's brain gently synchronizes (frequency-following).
 * Amplitude kept subtle and epilepsy-safe.
 * ============================================================ */

export class ThetaPulse {
  private phase = 0;

  constructor(private freq: number = 6.0) {}

  /** Advance the oscillator by dt seconds. */
  update(dt: number): void {
    this.phase += dt * this.freq * Math.PI * 2;
    /* keep phase bounded for long sessions */
    if (this.phase > Math.PI * 2000) this.phase -= Math.PI * 2000;
  }

  /** Raw sine value in [-1, 1]. */
  getRaw(): number {
    return Math.sin(this.phase);
  }

  /** Normalized intensity in [0, 1]. */
  getIntensity(): number {
    return (this.getRaw() + 1) / 2;
  }

  /**
   * Eased intensity — smoother attack/decay, feels like breathing light.
   * Uses smoothstep on the normalized value.
   */
  getEased(): number {
    const t = this.getIntensity();
    return t * t * (3 - 2 * t);
  }

  setFrequency(hz: number): void {
    this.freq = Math.max(0.5, Math.min(12, hz));
  }

  getFrequency(): number {
    return this.freq;
  }
}
