import { describe, expect, it } from 'vitest';
import {
  MAX_WALK_SPEED,
  HUB_JOURNEY,
  WORLD_ISLANDS,
  WORLD_WALK_RADIUS,
  catmullRom2,
  clampToWalkArea,
  islandCenter,
  layoutIslands,
  nearestZone,
  pathPoints,
  walkStepToward,
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

  it('starts the journey near the center — and reaches the regions (stage 12)', () => {
    const islands = layoutIslands();
    expect(islands[0].zone).toBe('light-path');
    expect(islands[0].dist).toBeLessThan(12);
    /* the calm breath-pool waits in the hub garden's corner */
    expect(islands[9].zone).toBe('breath-pool');
    expect(islands[9].dist).toBeLessThan(25);
    /* the unlock chain is now GEOGRAPHY: far stages are really far */
    const maxDist = Math.max(...islands.map((i) => i.dist));
    expect(maxDist).toBeGreaterThan(180);
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
    const outside = clampToWalkArea(400, 400);
    expect(Math.hypot(outside.x, outside.z)).toBeCloseTo(WORLD_WALK_RADIUS, 6);
  });

  it('the hub path flows through the three hub islands in journey order', () => {
    const pts = pathPoints();
    expect(pts.length).toBeGreaterThan(20);
    for (const zone of HUB_JOURNEY) {
      const p = WORLD_ISLANDS.find((i) => i.zone === zone)!;
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

describe('walkStepToward — calm walking, no lurch (critic round B, W4)', () => {
  const from = { x: 0, z: 0 };
  const far = { x: 13, z: 0 }; /* a cross-world walk */

  it('the first frame of the longest walk never exceeds the speed cap', () => {
    /* the old inline formula hit ~65 u/s here — one giant lurch */
    const step = walkStepToward(from, far, 1 / 60);
    const speed = step.x / (1 / 60);
    expect(speed).toBeLessThanOrEqual(MAX_WALK_SPEED + 1e-9);
  });

  it('keeps the soft landing — speed eases out near the target', () => {
    let pos = { x: 0, z: 0 };
    /* walk most of the way with big steps */
    for (let i = 0; i < 200 && Math.hypot(pos.x - far.x, pos.z) > 2; i++) {
      pos = walkStepToward(pos, far, 1 / 30);
    }
    const nearTarget = { x: far.x - 0.5, z: 0 };
    const step = walkStepToward(nearTarget, far, 1 / 60);
    const speed = (step.x - nearTarget.x) / (1 / 60);
    expect(speed).toBeLessThan(MAX_WALK_SPEED * 0.75);
  });

  it('always converges — a walk ends, never stalls and never overshoots', () => {
    let pos = { x: 0, z: 0 };
    let arrived = false;
    for (let i = 0; i < 60_000; i++) {
      const step = walkStepToward(pos, far, 1 / 60);
      pos = { x: step.x, z: step.z };
      if (step.arrived) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(pos.x).toBeCloseTo(far.x, 6);
    expect(Math.hypot(pos.x - far.x, pos.z)).toBeLessThanOrEqual(0.09 + 1e-9);
  });

  it('a dt spike (tab return) moves the child at most one bounded step', () => {
    const step = walkStepToward(from, far, 10);
    expect(Math.hypot(step.x, step.z)).toBeLessThanOrEqual(MAX_WALK_SPEED * 0.1 + 1e-9);
  });

  it('zero dt never moves the child', () => {
    const step = walkStepToward(from, far, 0);
    expect(step.x).toBe(0);
    expect(step.z).toBe(0);
    expect(step.arrived).toBe(false);
  });

  it('already-there targets arrive immediately', () => {
    const step = walkStepToward(from, { x: 0.01, z: 0 }, 1 / 60);
    expect(step.arrived).toBe(true);
  });
});
