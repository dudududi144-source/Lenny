import { describe, expect, it } from 'vitest';
import {
  WORLD_ISLANDS,
  WORLD_WALK_RADIUS,
  catmullRom2,
  clampToWalkArea,
  islandCenter,
  layoutIslands,
  nearestZone,
  pathPoints,
} from '../world/WorldLayout';
import { ZONES } from '../data/garden';

describe('WorldLayout', () => {
  it('places exactly one island per zone, in path order', () => {
    const islands = layoutIslands();
    expect(islands).toHaveLength(10);
    expect(islands.map((i) => i.zone)).toEqual(ZONES.map((z) => z.id));
  });

  it('is deterministic — same numbers on every call', () => {
    expect(layoutIslands()).toEqual(layoutIslands());
    expect(WORLD_ISLANDS).toEqual(layoutIslands());
  });

  it('starts the journey near the center and ends at the calm far end', () => {
    const islands = layoutIslands();
    expect(islands[0].zone).toBe('light-path');
    expect(islands[0].dist).toBeLessThan(5);
    expect(islands[9].zone).toBe('breath-pool');
    expect(islands[9].dist).toBeGreaterThan(10);
  });

  it('keeps every island fully inside the walkable world', () => {
    for (const p of WORLD_ISLANDS) {
      const edge = Math.hypot(p.x, p.z) + p.radius;
      expect(edge).toBeLessThan(WORLD_WALK_RADIUS);
    }
  });

  it('never overlaps two islands (a path, not a pile)', () => {
    for (let i = 0; i < WORLD_ISLANDS.length; i++) {
      for (let j = i + 1; j < WORLD_ISLANDS.length; j++) {
        const a = WORLD_ISLANDS[i];
        const b = WORLD_ISLANDS[j];
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        expect(d).toBeGreaterThan(a.radius + b.radius + 0.6);
      }
    }
  });

  it('islandCenter finds the exact spiral point', () => {
    const c = islandCenter('memory-hill');
    const p = WORLD_ISLANDS.find((i) => i.zone === 'memory-hill')!;
    expect(c.x).toBeCloseTo(p.x, 10);
    expect(c.z).toBeCloseTo(p.z, 10);
  });

  it('nearestZone returns null in open country', () => {
    const far = { x: 14.9, z: 14.9 };
    /* outside the walk ring entirely — no zone is near */
    const hit = nearestZone(far.x, far.z, 0.4);
    if (Math.hypot(far.x, far.z) > WORLD_WALK_RADIUS) expect(hit).toBeNull();
  });

  it('nearestZone detects standing on an island (dist 0)', () => {
    const c = islandCenter('light-path');
    const hit = nearestZone(c.x, c.z, 0.5);
    expect(hit).not.toBeNull();
    expect(hit!.zone).toBe('light-path');
    expect(hit!.dist).toBe(0);
  });

  it('nearestZone respects the max distance ring around an island', () => {
    const c = islandCenter('thinking-forest');
    expect(nearestZone(c.x + 0.35, c.z, 0.5)!.zone).toBe('thinking-forest');
    expect(nearestZone(c.x + 3.5, c.z, 0.5)).toBeNull();
  });

  it('clamps runaway targets back into the walkable world', () => {
    const inside = clampToWalkArea(3, 4);
    expect(inside.x).toBe(3);
    expect(inside.z).toBe(4);
    const outside = clampToWalkArea(30, 40);
    expect(Math.hypot(outside.x, outside.z)).toBeCloseTo(WORLD_WALK_RADIUS, 6);
  });

  it('the path polyline flows through every island in order', () => {
    const pts = pathPoints();
    expect(pts.length).toBeGreaterThan(100);
    for (const p of WORLD_ISLANDS) {
      const has = pts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1.2);
      expect(has).toBe(true);
    }
  });

  it('catmullRom2 interpolates through its control points', () => {
    const ctrl = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
    ];
    const out = catmullRom2(ctrl, 10);
    expect(out.some((p) => Math.abs(p.x - 1) < 0.01 && Math.abs(p.z) < 0.01)).toBe(true);
  });
});
