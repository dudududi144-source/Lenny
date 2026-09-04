import { describe, expect, it } from 'vitest';
import {
  WANDER_RADIUS,
  WORLD_ISLANDS,
  islandCenter,
  isInsideIsland,
  resolveWalkTarget,
} from '../world/WorldLayout';
import { DEFAULT_UNLOCKED } from '../games/core/ProgressStore';

/* fresh-garden lock table: only the two open gates are open */
const locked = (zone: string): boolean => !DEFAULT_UNLOCKED.includes(zone);

describe('resolveWalkTarget — fog islands repel gently', () => {
  it('open grass accepts the point as-is', () => {
    const r = resolveWalkTarget(0, 0, locked);
    expect(r.blocked).toBe(false);
    expect(r.x).toBe(0);
    expect(r.z).toBe(0);
  });

  it('an unlocked island accepts the point (the child may visit)', () => {
    const c = islandCenter('breath-pool');
    const r = resolveWalkTarget(c.x, c.z, locked);
    expect(r.blocked).toBe(false);
    expect(r.x).toBeCloseTo(c.x, 6);
  });

  it('a locked fog island holds the child at its rim', () => {
    const c = islandCenter('memory-hill');
    const r = resolveWalkTarget(c.x, c.z, locked);
    expect(r.blocked).toBe(true);
    expect(r.blockedZone).toBe('memory-hill');
    /* the rim point is outside the island but close to it */
    const island = WORLD_ISLANDS.find((i) => i.zone === 'memory-hill')!;
    const d = Math.hypot(r.x - island.x, r.z - island.z);
    expect(d).toBeGreaterThanOrEqual(island.radius + 0.1);
    expect(d).toBeLessThan(island.radius + 0.7);
  });

  it('a tap just past a locked rim walks freely (no sticky edges)', () => {
    const island = WORLD_ISLANDS.find((i) => i.zone === 'thinking-forest')!;
    const outside = { x: island.x + island.radius + 0.9, z: island.z };
    const r = resolveWalkTarget(outside.x, outside.z, locked);
    expect(r.blocked).toBe(false);
  });

  it('never resolves beyond the wanderable world (the meadow is open, the edge is not)', () => {
    const r = resolveWalkTarget(60, 60, locked);
    expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(WANDER_RADIUS);
    const far = resolveWalkTarget(5000, 0, locked);
    expect(Math.hypot(far.x, far.z)).toBeCloseTo(WANDER_RADIUS, 6);
  });
});

describe('isInsideIsland — platform membership', () => {
  it('the center of every island is inside it', () => {
    for (const island of WORLD_ISLANDS) {
      expect(isInsideIsland(island.x, island.z)).toBe(true);
    }
  });

  it('open grass is never inside an island', () => {
    expect(isInsideIsland(0, 0)).toBe(false); /* the world center */
    expect(isInsideIsland(14.8, 0)).toBe(false); /* the outer ring */
    expect(isInsideIsland(-14.8, 0)).toBe(false);
  });

  it('the rim itself is the boundary (outside wins — no sticky edges)', () => {
    const island = WORLD_ISLANDS[0];
    const d = island.radius + 0.05;
    expect(isInsideIsland(island.x + d, island.z)).toBe(false);
  });
});
