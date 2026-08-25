/* ============================================================
 * GardenSystem — draws the living garden path.
 *
 * VISUAL OVERHAUL: the illustrated background now shows through.
 * No opaque ground fill anymore. This system adds:
 *   - drifting fireflies
 *   - a glowing golden trail connecting the zone stations
 *   - stations as glowing orbs (open bright / locked dim / current pulsing)
 * ============================================================ */

import Phaser from 'phaser';
import { ZONES, ZoneId } from '../data/garden';

export interface GardenProgress {
  unlocked: ZoneId[];
  finished: Record<string, number>;
  current: ZoneId;
}

export const defaultProgress: GardenProgress = {
  unlocked: ['light-path', 'breath-pool'],
  finished: {},
  current: 'light-path',
};

export function freshProgress(): GardenProgress {
  return {
    unlocked: [...defaultProgress.unlocked],
    finished: { ...defaultProgress.finished },
    current: defaultProgress.current,
  };
}

interface Firefly { x: number; y: number; p: number; s: number; }

export class GardenSystem {
  private spots: { id: ZoneId; nx: number; ny: number }[] = [];
  private flies: Firefly[] = [];

  constructor() {
    const n = ZONES.length;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const ny = 0.86 - f * 0.7;
      const nx = 0.5 + Math.sin(f * Math.PI * 2.2) * 0.22;
      this.spots.push({ id: ZONES[i].id, nx, ny });
    }
    for (let i = 0; i < 16; i++) {
      this.flies.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: 0.5 + Math.random() });
    }
  }

  draw(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    t: number,
    progress: GardenProgress,
  ): void {
    g.clear();

    /* fireflies drifting over the illustrated garden */
    for (const f of this.flies) {
      const fx = ((f.x * w + Math.sin(t * 0.4 * f.s + f.p) * 26 + t * 6 * f.s) % w + w) % w;
      const fy = f.y * h + Math.cos(t * 0.5 * f.s + f.p) * 18;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 * f.s + f.p));
      g.fillStyle(0xffd76a, 0.10 * tw);
      g.fillCircle(fx, fy, 6);
      g.fillStyle(0xfff6ec, 0.5 * tw);
      g.fillCircle(fx, fy, 1.6);
    }

    /* glowing golden trail between stations */
    for (let i = 0; i < this.spots.length - 1; i++) {
      const a = this.spots[i], b = this.spots[i + 1];
      const ax = a.nx * w, ay = a.ny * h, bx = b.nx * w, by = b.ny * h;
      g.lineStyle(14, 0xffd76a, 0.06);
      g.lineBetween(ax, ay, bx, by);
      g.lineStyle(7, 0xffd76a, 0.12);
      g.lineBetween(ax, ay, bx, by);
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy);
      const steps = Math.max(2, Math.floor(len / 16));
      for (let s = 0; s <= steps; s++) {
        const px = ax + dx * (s / steps);
        const py = ay + dy * (s / steps);
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s * 0.7 + i));
        g.fillStyle(0xfff6ec, 0.35 * tw);
        g.fillCircle(px, py, 2);
      }
    }

    /* zone stations as glowing orbs */
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      const x = s.nx * w, y = s.ny * h;
      const zone = ZONES[i];
      const open = progress.unlocked.includes(s.id);
      const current = progress.current === s.id;
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.2 + i);

      if (current) {
        g.fillStyle(0xffd76a, 0.10 * pulse);
        g.fillCircle(x, y, 52);
        g.fillStyle(0xffd76a, 0.16 * pulse);
        g.fillCircle(x, y, 36);
      } else if (open) {
        g.fillStyle(zone.color, 0.12 * pulse);
        g.fillCircle(x, y, 40);
      }

      const r = current ? 24 : open ? 18 : 13;
      g.fillStyle(open ? zone.color : 0x2a2440, open ? 0.95 : 0.55);
      g.fillCircle(x, y, r);
      g.lineStyle(current ? 3 : 2, 0xfff6ec, open ? 0.85 : 0.25);
      g.strokeCircle(x, y, r);
      if (open) {
        g.fillStyle(0xfff6ec, 0.85 * pulse);
        g.fillCircle(x, y, current ? 6 : 4);
      }
    }
  }

  hitTest(px: number, py: number, w: number, h: number): ZoneId | null {
    let best: ZoneId | null = null;
    let bestD = Infinity;
    for (const s of this.spots) {
      const x = s.nx * w, y = s.ny * h;
      const d = Math.hypot(px - x, py - y);
      if (d < 34 && d < bestD) { bestD = d; best = s.id; }
    }
    return best;
  }
}
