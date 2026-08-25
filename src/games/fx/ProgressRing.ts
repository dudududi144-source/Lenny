/* ============================================================
 * ProgressRing — a reusable animated progress indicator.
 *
 * Why this exists: nearly every game needs to show progress
 * (3 of 5 found, round 2 of 3, etc.). A single polished ring
 * keeps the visual language consistent across all games.
 *
 * Design notes (the exemplar part):
 *  - Smoothly animates toward the target value (no jumps).
 *  - Optional pulse when the ring completes.
 *  - Tiny footprint: one Graphics object, call draw() per frame.
 * ============================================================ */

import Phaser from 'phaser';

export interface ProgressRingConfig {
  x: number;
  y: number;
  radius: number;
  thickness?: number;
  trackColor?: number;
  fillColor?: number;
}

export class ProgressRing {
  private g: Phaser.GameObjects.Graphics;
  private cfg: Required<ProgressRingConfig>;
  private displayed = 0;   /* animated 0..1 */
  private target = 0;      /* actual 0..1 */
  private pulse = 0;       /* completion pulse timer */

  constructor(scene: Phaser.Scene, cfg: ProgressRingConfig) {
    this.g = scene.add.graphics();
    this.cfg = {
      x: cfg.x,
      y: cfg.y,
      radius: cfg.radius,
      thickness: cfg.thickness ?? 6,
      trackColor: cfg.trackColor ?? 0x3a3350,
      fillColor: cfg.fillColor ?? 0xffd76a,
    };
  }

  /** Set progress as a fraction 0..1 (values are clamped). */
  set(fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    if (clamped >= 1 && this.target < 1) this.pulse = 1;
    this.target = clamped;
  }

  /** Set progress from counts, e.g. setCounts(3, 5). */
  setCounts(done: number, total: number): void {
    if (total <= 0) { this.set(0); return; }
    this.set(done / total);
  }

  /** Advance animation and draw. Call from scene update(). */
  update(dt: number): void {
    /* ease toward target */
    this.displayed += (this.target - this.displayed) * Math.min(1, dt * 6);
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 1.5);

    const g = this.g;
    g.clear();
    const c = this.cfg;
    const r = c.radius + this.pulse * 4;

    /* track */
    g.lineStyle(c.thickness, c.trackColor, 0.8);
    g.strokeCircle(c.x, c.y, r);

    /* filled arc from the top, clockwise */
    if (this.displayed > 0.001) {
      const end = -Math.PI / 2 + this.displayed * Math.PI * 2;
      g.lineStyle(c.thickness, c.fillColor, 1);
      g.beginPath();
      g.arc(c.x, c.y, r, -Math.PI / 2, end, false);
      g.strokePath();
    }

    /* completion glow */
    if (this.pulse > 0) {
      g.fillStyle(c.fillColor, this.pulse * 0.25);
      g.fillCircle(c.x, c.y, r + c.thickness);
    }
  }

  /** Clean up. */
  destroy(): void {
    this.g.destroy();
  }
}
