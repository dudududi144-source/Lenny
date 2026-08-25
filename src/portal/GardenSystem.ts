/* ============================================================
 * GardenSystem — draws the living garden path.
 * Replaces the galaxy: a winding trail with zone-stations the
 * child walks along. Zones unlock as the child progresses.
 * ============================================================ */

import Phaser from 'phaser';
import { ZONES, ZoneId } from '../data/garden';

export interface GardenProgress {
  /* which zones the child has opened */
  unlocked: ZoneId[];
  /* how many games finished per zone */
  finished: Record<string, number>;
  /* which zone the child is standing in */
  current: ZoneId;
}

export const defaultProgress: GardenProgress = {
  unlocked: ['light-path', 'breath-pool'],
  finished: {},
  current: 'light-path',
};

export class GardenSystem {
  /* normalized positions along a winding trail (0..1) */
  private spots: { id: ZoneId; nx: number; ny: number }[] = [];

  constructor() {
    /* lay the 10 zones on a gentle S-curve from bottom to top */
    const n = ZONES.length;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const ny = 0.88 - f * 0.72;
      const nx = 0.5 + Math.sin(f * Math.PI * 2.2) * 0.22;
      this.spots.push({ id: ZONES[i].id, nx, ny });
    }
  }

  private zonePos(id: ZoneId, w: number, h: number): { x: number; y: number } | null {
    const s = this.spots.find((p) => p.id === id);
    if (!s) return null;
    return { x: s.nx * w, y: s.ny * h };
  }

  draw(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    t: number,
    progress: GardenProgress
  ): void {
    g.clear();

    /* --- soft garden ground --- */
    this.drawGround(g, w, h, t);

    /* --- the winding path --- */
    g.lineStyle(5, 0xfff6ec, 0.18);
    g.beginPath();
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      if (i === 0) g.moveTo(s.nx * w, s.ny * h);
      else g.lineTo(s.nx * w, s.ny * h);
    }
    g.strokePath();

    /* dotted light along the path */
    for (let i = 0; i < this.spots.length - 1; i++) {
      const a = this.spots[i], b = this.spots[i + 1];
      for (let k = 1; k < 4; k++) {
        const fx = (a.nx + (b.nx - a.nx) * (k / 4)) * w;
        const fy = (a.ny + (b.ny - a.ny) * (k / 4)) * h;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i + k);
        g.fillStyle(0xffd76a, 0.15 + tw * 0.1);
        g.fillCircle(fx, fy, 2);
      }
    }

    /* --- zone stations --- */
    for (const zone of ZONES) {
      const pos = this.zonePos(zone.id, w, h);
      if (!pos) continue;
      const isOpen = progress.unlocked.includes(zone.id);
      const isCurrent = progress.current === zone.id;
      this.drawZone(g, pos.x, pos.y, zone.color, zone.icon, isOpen, isCurrent, t);
    }
  }

  private drawGround(g: Phaser.GameObjects.Graphics, w: number, h: number, t: number): void {
    /* vertical gradient: sky -> grass */
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const r = Math.round(26 + f * 20);
      const gg = Math.round(20 + f * 34);
      const b = Math.round(64 - f * 20);
      g.fillStyle((r << 16) | (gg << 8) | Math.max(0, b), 1);
      g.fillRect(0, (h / bands) * i, w, h / bands + 1);
    }
    /* drifting fireflies */
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 67 + t * 12) % w);
      const fy = ((i * 131 + t * 8) % (h * 0.8)) + h * 0.1;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + i));
      g.fillStyle(0xffd76a, 0.12 * tw);
      g.fillCircle(fx, fy, 3);
    }
  }

  private drawZone(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    icon: string,
    open: boolean,
    current: boolean,
    t: number
  ): void {
    void icon; /* icon rendered via Text in the scene if needed */
    const r = current ? 22 : 17;
    const pulse = open ? 0.6 + 0.4 * Math.sin(t * 2) : 0.3;

    /* halo */
    if (open) {
      g.fillStyle(color, 0.14 * pulse);
      g.fillCircle(x, y, r * 2);
    }

    /* body */
    g.fillStyle(open ? color : 0x3a3350, open ? 0.9 : 0.6);
    g.fillCircle(x, y, r);

    /* ring */
    g.lineStyle(2, open ? 0xfff6ec : 0x55506a, open ? 0.8 : 0.4);
    g.strokeCircle(x, y, r);

    /* spark on current zone */
    if (current) {
      g.fillStyle(0xfff6ec, 0.9);
      g.fillCircle(x, y - r - 8, 3);
    }
  }

  hitTest(px: number, py: number, w: number, h: number): ZoneId | null {
    let best: ZoneId | null = null;
    let bestD = Infinity;
    for (const s of this.spots) {
      const x = s.nx * w, y = s.ny * h;
      const d = Math.hypot(px - x, py - y);
      if (d < 30 && d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    return best;
  }
}
