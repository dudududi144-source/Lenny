import { describe, expect, it } from 'vitest';
import {
  WORLD_ISLANDS,
  WORLD_WALK_RADIUS,
  islandCenter,
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

  it('never resolves beyond the walkable world', () => {
    const r = resolveWalkTarget(60, 60, locked);
    expect(Math.hypot(r.x, r.z)).toBeCloseTo(WORLD_WALK_RADIUS, 6);
  });
});
