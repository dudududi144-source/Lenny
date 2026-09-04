import { describe, expect, it } from 'vitest';
import { LANDMARKS, WORLD_WALK_RADIUS, landmarkRimPoint, landmarkVisitPoint, nearestLandmark, slideAroundLandmark } from '../world/WorldLayout';
import { WORLD_ISLANDS, pathPoints, resolveWalkTarget, HUB_RADIUS } from '../world/WorldLayout';
import { REGION_ROADS } from '../world/WorldRegions';

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

  it('has fifty named places, each with a Hebrew name and a narration line', () => {
    expect(LANDMARKS.length).toBe(50);
    for (const l of LANDMARKS) {
      expect(l.name.length).toBeGreaterThan(2);
      expect(l.line.length).toBeGreaterThan(8);
      expect(l.keep).toBeGreaterThan(0.8);
      expect(l.keep).toBeLessThanOrEqual(3.6);
    }
    const ids = new Set(LANDMARKS.map((l) => l.id));
    expect(ids.size).toBe(50);
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

  it('region heroes never crowd a region road (≥6 from every sample)', () => {
    for (const l of LANDMARKS) {
      if (Math.hypot(l.x, l.z) <= HUB_RADIUS + 4) continue; /* hub landmarks answer to the spiral */
      for (const road of REGION_ROADS) {
        for (const p of road.points) {
          expect(Math.hypot(p.x - l.x, p.z - l.z)).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it('landmarks are destinations, not a cluster (≥3 apart)', () => {
    for (let i = 0; i < LANDMARKS.length; i++) {
      for (let j = i + 1; j < LANDMARKS.length; j++) {
        const a = LANDMARKS[i];
        const b = LANDMARKS[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(4.5);
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

describe('slideAroundLandmark — errands survive the keep-out (critic V1)', () => {
  const beehive = LANDMARKS.find((l) => l.id === 'beehive')!;

  it('the pushed child always stands on the rim, never inside', () => {
    for (const l of LANDMARKS) {
      const deep = { x: l.x, z: l.z }; /* dead center */
      const out = slideAroundLandmark(l, deep.x, deep.z, null);
      expect(Math.hypot(out.x - l.x, out.z - l.z)).toBeCloseTo(l.keep + 0.02, 5);
      const edge = { x: l.x + l.keep * 0.5, z: l.z };
      const out2 = slideAroundLandmark(l, edge.x, edge.z, null);
      expect(Math.hypot(out2.x - l.x, out2.z - l.z)).toBeCloseTo(l.keep + 0.02, 5);
    }
  });

  it('a passing errand is NOT cancelled — the slide is not an arrival', () => {
    const r = slideAroundLandmark(beehive, beehive.x + 0.5, beehive.z, { x: beehive.x + 8, z: beehive.z });
    expect(r.arrived).toBe(false);
  });

  it('a walk INTO the place ends at the rim — that was the visit', () => {
    const r = slideAroundLandmark(beehive, beehive.x + 0.5, beehive.z, { x: beehive.x, z: beehive.z });
    expect(r.arrived).toBe(true);
  });

  it('the dead-center stall case still gains tangential progress (20° bias)', () => {
    /* target exactly behind the place — the old push oscillated forever */
    const target = { x: beehive.x - 10, z: beehive.z };
    const start = { x: beehive.x + beehive.keep * 0.9, z: beehive.z };
    const s1 = slideAroundLandmark(beehive, start.x, start.z, target);
    const ang1 = Math.atan2(s1.z - beehive.z, s1.x - beehive.x);
    expect(Math.abs(ang1)).toBeGreaterThan(0.2); /* off the 0/π axis */
    /* repeated slides keep rotating the same way — a real detour forms */
    const s2 = slideAroundLandmark(beehive, s1.x, s1.z, target);
    const ang2 = Math.atan2(s2.z - beehive.z, s2.x - beehive.x);
    expect(Math.abs(ang2 - ang1)).toBeGreaterThan(0.2);
  });

  it('the bias steers toward the target side (shortest way around)', () => {
    const targetAbove = { x: beehive.x - 6, z: beehive.z - 5 };
    const s = slideAroundLandmark(beehive, beehive.x + 1, beehive.z, targetAbove);
    expect(s.z).toBeLessThan(beehive.z); /* rotated toward -z, the target side */
  });

  it('a real chord between two zones survives a pass by the beehive', () => {
    /* the critic's geometry: rhythm-square -> words-valley passes 0.86u
       from the beehive — walk it frame by frame and it must ARRIVE */
    const from = WORLD_ISLANDS.find((i) => i.zone === 'rhythm-square')!;
    const to = WORLD_ISLANDS.find((i) => i.zone === 'words-valley')!;
    let pos = { x: from.x, z: from.z };
    const target = { x: to.x, z: to.z };
    let arrived = false;
    for (let i = 0; i < 60_000; i++) {
      /* the WorldApp order: step toward the target, then slide out */
      const step = (() => {
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d <= 0.09) return { x: target.x, z: target.z, arrived: true };
        const safeDt = 1 / 60;
        const k = Math.min(1, safeDt * 2.1 * (0.55 + Math.min(1, d / 2.5)));
        const stepLen = Math.min(d * k, 3.4 * safeDt);
        if (d - stepLen <= 0.09) return { x: target.x, z: target.z, arrived: true };
        return { x: pos.x + (dx * stepLen) / d, z: pos.z + (dz * stepLen) / d, arrived: false };
      })();
      pos = { x: step.x, z: step.z };
      if (step.arrived) {
        arrived = true;
        break;
      }
      const inside = LANDMARKS.find((l) => Math.hypot(pos.x - l.x, pos.z - l.z) < l.keep);
      if (inside) {
        const slide = slideAroundLandmark(inside, pos.x, pos.z, target);
        pos = { x: slide.x, z: slide.z };
      }
    }
    expect(arrived).toBe(true);
  });
});
