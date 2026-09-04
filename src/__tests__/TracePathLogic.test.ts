import { describe, expect, it } from 'vitest';
import { advanceAlong, nodesFor, samplePath, trailComplete, trailFor } from '../games/logic/tracePath';

/* tracePath — pre-writing tracing: waypoints in 0..1 space, resampled
   into dots, monotonic finger progress, no fail state anywhere. */

describe('tracePath logic', () => {
  it('waypoint count grows with the tier (3..6), clamped', () => {
    expect([nodesFor(0), nodesFor(1), nodesFor(2), nodesFor(3)]).toEqual([3, 4, 5, 6]);
    expect(nodesFor(-1)).toBe(3);
    expect(nodesFor(7)).toBe(6);
  });

  it('every trail lands n waypoints, well separated and in bounds', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let seed = 800; seed < 900; seed += 29) {
        const t = trailFor(tier, seed);
        expect(t.n).toBe(nodesFor(tier));
        expect(t.nodes).toHaveLength(t.n);
        for (const p of t.nodes) {
          expect(p.x).toBeGreaterThanOrEqual(0.05);
          expect(p.x).toBeLessThanOrEqual(0.95);
          expect(p.y).toBeGreaterThanOrEqual(0.05);
          expect(p.y).toBeLessThanOrEqual(0.95);
        }
        for (let i = 0; i < t.nodes.length; i++) {
          for (let j = i + 1; j < t.nodes.length; j++) {
            expect(Math.hypot(t.nodes[i].x - t.nodes[j].x, t.nodes[i].y - t.nodes[j].y)).toBeGreaterThanOrEqual(0.29);
          }
        }
      }
    }
  });

  it('same (tier, seed) — same sky, every device', () => {
    expect(trailFor(2, 841)).toEqual(trailFor(2, 841));
    expect(trailFor(2, 841)).not.toEqual(trailFor(2, 842));
  });

  it('the dots walk the straight legs in order and end on the last waypoint', () => {
    const nodes = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.5 },
    ];
    const pts = samplePath(nodes);
    expect(pts[0]).toEqual(nodes[0]);
    expect(pts[pts.length - 1]).toEqual(nodes[2]);
    /* all dots stay on the legs (within sampling epsilon) */
    for (const p of pts) {
      const onFirst = Math.abs(p.y - 0.1) < 1e-9 && p.x >= 0.1 - 1e-9 && p.x <= 0.5 + 1e-9;
      const onSecond = Math.abs(p.x - 0.5) < 1e-9 && p.y >= 0.1 - 1e-9 && p.y <= 0.5 + 1e-9;
      expect(onFirst || onSecond).toBe(true);
    }
  });

  it('finger progress advances monotonically and only near the trail', () => {
    const nodes = [
      { x: 0.0, y: 0.0 },
      { x: 1.0, y: 0.0 },
    ];
    const pts = samplePath(nodes);
    expect(pts.length).toBeGreaterThan(5);

    /* a finger ON the trail (a small hop ahead of the cursor) advances */
    const reach = advanceAlong(pts, 10, { x: pts[12].x, y: 0 }, 0.09);
    expect(reach).toBeGreaterThan(10);
    /* a finger far off the trail never advances */
    expect(advanceAlong(pts, 3, { x: 0.5, y: 0.5 }, 0.09)).toBe(3);
    /* progress never goes backwards */
    expect(advanceAlong(pts, 8, { x: 0.0, y: 0.0 }, 0.09)).toBeGreaterThanOrEqual(8);
    /* reaching the end completes the trail */
    const final = advanceAlong(pts, pts.length - 4, { x: 1, y: 0 }, 0.09);
    expect(trailComplete(pts, final)).toBe(true);
    /* halfway is not complete */
    expect(trailComplete(pts, advanceAlong(pts, 0, { x: pts[Math.floor(pts.length / 2)].x, y: 0 }, 0.09))).toBe(false);
    /* and a continuous sweep walks the whole trail dot by dot */
    let p = 0;
    for (let i = 0; i < pts.length; i++) {
      p = advanceAlong(pts, p, { x: pts[i].x, y: pts[i].y }, 0.09);
    }
    expect(trailComplete(pts, p)).toBe(true);
  });
});
