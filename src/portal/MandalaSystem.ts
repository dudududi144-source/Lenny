/* ============================================================
 * MandalaSystem — the 9-petal cognitive mandala
 * Each petal = one cognitive category, glowing at its own
 * theta frequency. The mandala rotates slowly (sacred geometry)
 * and serves as the "reveal" centerpiece of the portal.
 * ============================================================ */

import Phaser from 'phaser';
import { CATEGORIES, CATEGORY_ORDER } from '../data/games';

export class MandalaSystem {
  private rotation = 0;

  /** radians/sec — slow, meditative */
  constructor(private spinSpeed: number = 0.12) {}

  update(dt: number): void {
    this.rotation += dt * this.spinSpeed;
  }

  /**
   * Draw the mandala centered at (cx, cy).
   * @param radius outer radius
   * @param t      elapsed seconds (for pulsing)
   * @param bloom  0..1 — how open the petals are (for the reveal anim)
   */
  draw(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    t: number,
    bloom: number
  ): void {
    const n = CATEGORY_ORDER.length; /* 9 petals */

    /* --- outer guide rings --- */
    for (let ring = 1; ring <= 3; ring++) {
      const rr = radius * (0.4 + ring * 0.22) * bloom;
      g.lineStyle(1, 0x7c4dff, 0.16);
      g.strokeCircle(cx, cy, rr);
    }

    /* --- 9 category petals --- */
    for (let i = 0; i < n; i++) {
      const cat = CATEGORY_ORDER[i];
      const meta = CATEGORIES[cat];
      const angle = this.rotation + (i / n) * Math.PI * 2;

      /* each petal pulses at its own theta frequency */
      const pulse = 0.55 + 0.45 * Math.sin(t * meta.freq * Math.PI * 2 * 0.35 + i);
      const petalR = radius * 0.42 * bloom;
      const px = cx + Math.cos(angle) * radius * 0.55 * bloom;
      const py = cy + Math.sin(angle) * radius * 0.55 * bloom;

      /* petal glow */
      g.fillStyle(meta.color, 0.10 * pulse);
      g.fillCircle(px, py, petalR * 1.5);
      /* petal body */
      g.fillStyle(meta.color, 0.55 * pulse + 0.15);
      g.fillCircle(px, py, petalR * (0.55 + pulse * 0.2));
      /* petal core */
      g.fillStyle(0xfff6ec, 0.5 * pulse);
      g.fillCircle(px, py, petalR * 0.2);

      /* connector line to center */
      g.lineStyle(1, meta.color, 0.25);
      g.lineBetween(cx, cy, px, py);
    }

    /* --- golden heart (Lenny's core) --- */
    const heartPulse = 0.7 + 0.3 * Math.sin(t * 1.2);
    g.fillStyle(0xffd76a, 0.18 * heartPulse);
    g.fillCircle(cx, cy, radius * 0.24);
    g.fillStyle(0xffd76a, 0.85);
    g.fillCircle(cx, cy, radius * 0.11 * heartPulse);
    g.fillStyle(0xfff6ec, 0.9);
    g.fillCircle(cx, cy, radius * 0.05);
  }
}
