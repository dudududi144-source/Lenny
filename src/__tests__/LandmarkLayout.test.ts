import { describe, expect, it } from 'vitest';
import { LANDMARKS, WORLD_WALK_RADIUS, landmarkRimPoint, landmarkVisitPoint, nearestLandmark } from '../world/WorldLayout';
import { WORLD_ISLANDS, pathPoints, resolveWalkTarget } from '../world/WorldLayout';

describe('LANDMARKS — the places beyond the path (critic round B, W1)', () => {
  const path = pathPoints();

  const pathDist = (x: number, z: number): number => {
    let m = Infinity;
    for (const p of path) m = Math.min(m, Math.hypot(p.x - x, p.z - z));
    return m;
  };
  const islandDist = (x: number, z: number): number => {
    let m = Infinity;
    for (const i of WORLD_ISLANDS) m = Math.min(m, Math.hypot(x - i.x, z - i.z) - i.radius);
    return m;
  };

  it('has eight named places, each with a Hebrew name and a narration line', () => {
    expect(LANDMARKS.length).toBe(8);
    for (const l of LANDMARKS) {
      expect(l.name.length).toBeGreaterThan(2);
      expect(l.line.length).toBeGreaterThan(8);
      expect(l.keep).toBeGreaterThan(0.8);
      expect(l.keep).toBeLessThan(2.2);
    }
    const ids = new Set(LANDMARKS.map((l) => l.id));
    expect(ids.size).toBe(8);
  });

  it('every landmark sits inside the walkable world with a margin', () => {
    for (const l of LANDMARKS) {
      expect(Math.hypot(l.x, l.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS - 0.7);
    }
  });

  it('no landmark crowds an island (≥1.5 from every rim) or the path (≥1.2)', () => {
    for (const l of LANDMARKS) {
      expect(islandDist(l.x, l.z)).toBeGreaterThanOrEqual(1.5);
      expect(pathDist(l.x, l.z)).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('landmarks are destinations, not a cluster (≥3 apart)', () => {
    for (let i = 0; i < LANDMARKS.length; i++) {
      for (let j = i + 1; j < LANDMARKS.length; j++) {
        const a = LANDMARKS[i];
        const b = LANDMARKS[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('every landmark has a walkable approach — the visit point on open grass', () => {
    for (const l of LANDMARKS) {
      const v = landmarkVisitPoint(l);
      expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS);
      expect(islandDist(v.x, v.z)).toBeGreaterThanOrEqual(0.3);
      expect(pathDist(v.x, v.z)).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('rim points are always outside the keep-out — the child never stands in the pond', () => {
    for (const l of LANDMARKS) {
      /* approach from several directions, all resolve outside */
      for (const [fx, fz] of [[l.x + 5, l.z], [l.x - 5, l.z], [l.x, l.z + 5], [l.x, l.z - 5]]) {
        const rim = landmarkRimPoint(l, fx, fz);
        expect(Math.hypot(rim.x - l.x, rim.z - l.z)).toBeGreaterThanOrEqual(l.keep);
      }
    }
  });

  it('nearestLandmark measures from the keep-out rim', () => {
    const l = LANDMARKS[0];
    const at = nearestLandmark(l.x, l.z, 0.5);
    expect(at?.landmark.id).toBe(l.id);
    expect(at?.dist).toBe(0);
    expect(nearestLandmark(l.x, l.z + l.keep + 1.2, 0.5)).toBeNull();
    expect(nearestLandmark(l.x, l.z + l.keep + 0.4, 0.5)?.landmark.id).toBe(l.id);
  });

  it('resolveWalkTarget pushes taps into a landmark keep-out onto its rim and tags the place', () => {
    const l = LANDMARKS[0];
    const noLocks = () => false;
    const r = resolveWalkTarget(l.x, l.z, noLocks);
    expect(r.landmark?.id).toBe(l.id);
    expect(r.blocked).toBe(false);
    expect(Math.hypot(r.x - l.x, r.z - l.z)).toBeGreaterThanOrEqual(l.keep);
  });

  it('plain grass taps stay untagged', () => {
    const r = resolveWalkTarget(0.5, 0.5, () => false);
    expect(r.landmark).toBeNull();
    expect(r.blocked).toBe(false);
  });
});
