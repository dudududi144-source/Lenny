/* ============================================================
 * FractalBackground — living cosmic backdrop
 * Three parallax star layers + drifting soft nebulae.
 * Pure procedural rendering on a Phaser Graphics object.
 * Deterministic (seeded) so it looks identical every load.
 * ============================================================ */

import Phaser from 'phaser';

interface BgStar {
  x: number;      /* 0..1 normalized */
  y: number;      /* 0..1 normalized */
  r: number;      /* radius px */
  layer: number;  /* 0 far, 1 mid, 2 near */
  tw: number;     /* twinkle phase offset */
}

interface Nebula {
  x: number;
  y: number;
  r: number;
  hueShift: number;
  drift: number;  /* drift speed */
}

/* Small seeded PRNG (mulberry32) for deterministic layout */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class FractalBackground {
  private stars: BgStar[] = [];
  private nebulae: Nebula[] = [];

  constructor(starCount: number = 90, nebulaCount: number = 5, seed: number = 144) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < starCount; i++) {
      const layer = i % 3;
      this.stars.push({
        x: rnd(),
        y: rnd(),
        r: 0.6 + rnd() * (layer === 2 ? 1.8 : 1.2),
        layer,
        tw: rnd() * Math.PI * 2,
      });
    }
    for (let i = 0; i < nebulaCount; i++) {
      this.nebulae.push({
        x: rnd(),
        y: rnd() * 0.7,
        r: 90 + rnd() * 140,
        hueShift: rnd(),
        drift: 0.004 + rnd() * 0.008,
      });
    }
  }

  /**
   * Draw one frame.
   * @param g      target graphics
   * @param w,h    viewport size
   * @param t      elapsed seconds
   * @param warmth 0..1 — shifts palette from cold violet to warm gold
   * @param pulse  0..1 — theta pulse intensity for subtle global glow
   */
  draw(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    t: number,
    warmth: number,
    pulse: number
  ): void {
    g.clear();

    /* --- deep gradient sky --- */
    this.drawSky(g, w, h, warmth);

    /* --- drifting nebulae (very soft, additive-feel via low alpha) --- */
    for (const n of this.nebulae) {
      const nx = ((n.x + t * n.drift) % 1.3 - 0.15) * w;
      const ny = n.y * h + Math.sin(t * 0.15 + n.hueShift * 6) * 14;
      const col = this.nebulaColor(n.hueShift, warmth);
      for (let k = 3; k >= 1; k--) {
        g.fillStyle(col, 0.028 * k * (0.6 + pulse * 0.4));
        g.fillCircle(nx, ny, n.r * (k / 3));
      }
    }

    /* --- parallax star field --- */
    for (const s of this.stars) {
      const parallax = (s.layer + 1) * 6;
      const sy = ((s.y * h + t * parallax) % (h + 20)) - 10;
      const sx = s.x * w;
      const twinkle = 0.35 + 0.55 * Math.abs(Math.sin(t * 1.4 + s.tw));
      const alpha = twinkle * (0.5 + s.layer * 0.2);
      g.fillStyle(0xffffff, Math.min(1, alpha));
      g.fillCircle(sx, sy, s.r);
      /* occasional cross-glint on near stars */
      if (s.layer === 2 && twinkle > 0.82) {
        g.lineStyle(0.8, 0xffffff, 0.4);
        g.lineBetween(sx - s.r * 3, sy, sx + s.r * 3, sy);
      }
    }
  }

  private drawSky(g: Phaser.GameObjects.Graphics, w: number, h: number, warmth: number): void {
    const bands = 18;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const col = this.skyColor(f, warmth);
      g.fillStyle(col, 1);
      g.fillRect(0, (h / bands) * i, w, h / bands + 1);
    }
  }

  private skyColor(f: number, warmth: number): number {
    /* cold: deep violet night -> warm: ember dawn near horizon */
    const r = Math.round(5 + f * 20 + warmth * 28);
    const gg = Math.round(2 + f * 8 + warmth * 14);
    const b = Math.round(16 + f * 44 - warmth * 10);
    return (r << 16) | (gg << 8) | Math.max(0, b);
  }

  private nebulaColor(shift: number, warmth: number): number {
    if (shift < 0.34) return warmth > 0.5 ? 0xffd76a : 0x7c4dff;
    if (shift < 0.67) return warmth > 0.5 ? 0xff8bd4 : 0xf2549a;
    return warmth > 0.5 ? 0x7dffb8 : 0x4dc9ff;
  }
}
