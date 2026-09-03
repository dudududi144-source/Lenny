import { describe, expect, it } from 'vitest';
import {
  MEADOW_CHUNK,
  MEADOW_START,
  chunkCenter,
  chunkFind,
  chunkHash,
  chunkKey,
  chunkOf,
  chunkSparkles,
  isMeadowPoint,
} from '../world/WorldMeadow';
import { WANDER_RADIUS, WORLD_WALK_RADIUS } from '../world/WorldLayout';

describe('WorldMeadow — the almost-infinite ring is a place, not noise', () => {
  it('chunk keys and centers round-trip through chunkOf', () => {
    const cx = 3;
    const cz = -7;
    const key = chunkKey(cx, cz);
    const ctr = chunkCenter(cx, cz);
    const back = chunkOf(ctr.x, ctr.z);
    expect(back.cx).toBe(cx);
    expect(back.cz).toBe(cz);
    expect(key).toBe('3:-7');
    expect(Math.hypot(ctr.x - (cx + 0.5) * MEADOW_CHUNK, ctr.z - (cz + 0.5) * MEADOW_CHUNK)).toBeCloseTo(0, 10);
  });

  it('chunkHash is stable and differs across neighbors', () => {
    expect(chunkHash(2, 5)).toBe(chunkHash(2, 5));
    const seen = new Set<number>();
    for (let cx = -4; cx <= 4; cx++) {
      for (let cz = -4; cz <= 4; cz++) seen.add(chunkHash(cx, cz));
    }
    /* 81 distinct chunks — collisions would make the meadow repeat */
    expect(seen.size).toBeGreaterThan(75);
  });

  it('chunk content is deterministic: same chunk, same world, forever', () => {
    const a = chunkSparkles(6, -2);
    const b = chunkSparkles(6, -2);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(chunkFind(6, -2)).toBe(chunkFind(6, -2));
  });

  it('every sparkle sits inside its own chunk (streaming cull holds)', () => {
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        for (const s of chunkSparkles(cx, cz)) {
          const c = chunkOf(s.x, s.z);
          expect(c.cx).toBe(cx);
          expect(c.cz).toBe(cz);
        }
      }
    }
  });

  it('sparkle ids match the collect ledger contract (cx:cz:i)', () => {
    const s = chunkSparkles(1, 1);
    for (const sp of s) {
      expect(sp.id).toMatch(/^\d+:\d+:\d+$/);
    }
  });

  it('the meadow begins beyond the curated garden and ends at the wander edge', () => {
    expect(MEADOW_START).toBeGreaterThan(WORLD_WALK_RADIUS);
    expect(WANDER_RADIUS).toBeGreaterThan(MEADOW_START * 2);
    expect(isMeadowPoint(0, 0)).toBe(false);
    expect(isMeadowPoint(MEADOW_START + 4, 0)).toBe(true);
  });
});
