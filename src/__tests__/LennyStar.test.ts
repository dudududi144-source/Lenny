import { describe, expect, it } from 'vitest';
import { bubbleLineFor, starPolygon } from '../world/LennyStar';
import { ZONES } from '../data/garden';

describe('bubbleLineFor — Lenny never invents content', () => {
  it('speaks the zone mission from data/garden.ts, verbatim', () => {
    for (const zone of ZONES) {
      expect(bubbleLineFor(zone.id)).toBe(zone.mission);
    }
  });

  it('open grass gets no bubble (silence is polite)', () => {
    expect(bubbleLineFor(null)).toBeNull();
  });
});

describe('starPolygon — the low-poly star', () => {
  it('has ten points alternating outer/inner radius', () => {
    const pts = starPolygon(0.34, 0.14);
    expect(pts).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      const r = Math.hypot(pts[i].x, pts[i].y);
      expect(r).toBeCloseTo(i % 2 === 0 ? 0.34 : 0.14, 6);
    }
  });

  it('starts pointing up and is symmetric', () => {
    const pts = starPolygon(1, 0.4);
    expect(pts[0].x).toBeCloseTo(0, 6);
    expect(pts[0].y).toBeCloseTo(1, 6); /* top spike */
    /* mirror pairs across the y-axis: spikes at 162°↔18° and 234°↔306° */
    for (const [l, r] of [[2, 8], [4, 6]] as const) {
      expect(pts[l].x).toBeCloseTo(-pts[r].x, 6);
      expect(pts[l].y).toBeCloseTo(pts[r].y, 6);
    }
  });
});
