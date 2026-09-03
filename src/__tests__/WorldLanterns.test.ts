import { describe, expect, it } from 'vitest';
import {
  ISLAND_COUNT,
  LANTERN_COUNT,
  LANTERN_MIN_SEP,
  lanternPositions,
  lanternsFor,
} from '../world/WorldLanterns';
import { WORLD_ISLANDS, WORLD_WALK_RADIUS, pathPoints } from '../world/WorldLayout';

describe('lanternsFor — lights map to lit lanterns', () => {
  it('maps 1:1 in the honest range', () => {
    expect(lanternsFor(0)).toBe(0);
    expect(lanternsFor(1)).toBe(1);
    expect(lanternsFor(7)).toBe(7);
    expect(lanternsFor(LANTERN_COUNT)).toBe(LANTERN_COUNT);
  });

  it('caps at the lantern count — the journey has an end worth reaching', () => {
    expect(lanternsFor(LANTERN_COUNT + 5)).toBe(LANTERN_COUNT);
    expect(lanternsFor(10_000)).toBe(LANTERN_COUNT);
  });

  it('never goes negative and floors fractions', () => {
    expect(lanternsFor(-3)).toBe(0);
    expect(lanternsFor(2.9)).toBe(2);
  });
});

describe('lanternPositions — the journey order along the spiral', () => {
  const spots = lanternPositions();

  it('places exactly LANTERN_COUNT spots on the real garden layout', () => {
    expect(spots.length).toBe(LANTERN_COUNT);
  });

  it('is deterministic — the same garden always lights the same lanterns', () => {
    const again = lanternPositions();
    for (let i = 0; i < spots.length; i++) {
      expect(again[i].x).toBeCloseTo(spots[i].x, 9);
      expect(again[i].z).toBeCloseTo(spots[i].z, 9);
    }
  });

  it('every lantern stands inside the walkable world', () => {
    for (const p of spots) {
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS);
    }
  });

  it('no lantern stands ON an island platform (they flank the path)', () => {
    for (const p of spots) {
      for (const island of WORLD_ISLANDS) {
        const d = Math.hypot(p.x - island.x, p.z - island.z);
        expect(d).toBeGreaterThanOrEqual(island.radius);
      }
    }
  });

  it('lanterns advance in journey order (placement arc strictly grows)', () => {
    /* the spiral doubles back, so radius is NOT monotonic — the arc each
       lantern was placed at is the honest journey order */
    for (let i = 1; i < spots.length; i++) {
      expect(spots[i].arc).toBeGreaterThan(spots[i - 1].arc);
    }
  });

  it('no two lanterns clump together (the spiral loops back on itself)', () => {
    for (let i = 1; i < spots.length; i++) {
      const d = Math.hypot(spots[i].x - spots[i - 1].x, spots[i].z - spots[i - 1].z);
      expect(d).toBeGreaterThanOrEqual(LANTERN_MIN_SEP * 0.95);
    }
  });

  it('lanterns stand beside the path — near it, never floating far away', () => {
    const path = pathPoints();
    for (const p of spots) {
      let nearest = Infinity;
      for (const q of path) nearest = Math.min(nearest, Math.hypot(p.x - q.x, p.z - q.z));
      expect(nearest).toBeLessThanOrEqual(1.2);
    }
  });

  it('the world has islands for the lanterns to flank', () => {
    expect(ISLAND_COUNT).toBe(10);
  });
});

