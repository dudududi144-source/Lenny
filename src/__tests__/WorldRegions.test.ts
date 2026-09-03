import { describe, expect, it } from 'vitest';
import {
  REGIONS,
  REGION_ROADS,
  RIVER_CONTROL,
  regionAt,
  regionById,
  regionSteps,
  riverPoints,
  terrainHeight,
  nearestRegion,
} from '../world/WorldRegions';
import { WANDER_RADIUS, WORLD_WALK_RADIUS, WORLD_ISLANDS, WORLD_SIGNPOSTS, FRIENDS, LANDMARKS } from '../world/WorldLayout';
import { HUB_RADIUS } from '../world/WorldLayout';

describe('REGIONS — the continent beyond the garden (stage 12)', () => {
  it('has six named regions with Hebrew names and arrival lines', () => {
    expect(REGIONS).toHaveLength(6);
    for (const r of REGIONS) {
      expect(r.name.length).toBeGreaterThan(2);
      expect(r.line.length).toBeGreaterThan(8);
      expect(r.radius).toBeGreaterThan(50);
    }
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(6);
  });

  it('the regions sit far from the hub and never overlap each other', () => {
    for (const r of REGIONS) {
      const d = Math.hypot(r.x, r.z);
      expect(d).toBeGreaterThan(140); /* a real journey out */
      expect(d + r.radius).toBeLessThanOrEqual(WANDER_RADIUS); /* inside the world */
    }
    for (let i = 0; i < REGIONS.length; i++) {
      for (let j = i + 1; j < REGIONS.length; j++) {
        const a = REGIONS[i];
        const b = REGIONS[j];
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius;
        expect(gap).toBeGreaterThanOrEqual(0); /* patches never overlap */
      }
    }
  });

  it('every region patch holds islands, landmarks or friends — no dead continents', () => {
    for (const r of REGIONS) {
      const populated =
        WORLD_ISLANDS.some((i) => Math.hypot(i.x - r.x, i.z - r.z) <= r.radius) ||
        LANDMARKS.some((l) => Math.hypot(l.x - r.x, l.z - r.z) <= r.radius) ||
        FRIENDS.some((f) => Math.hypot(f.x - r.x, f.z - r.z) <= r.radius);
      expect(populated).toBe(true);
    }
  });

  it('regionAt resolves inside patches and null between them', () => {
    const forest = regionById('forest');
    expect(regionAt(forest.x, forest.z)?.id).toBe('forest');
    expect(regionAt(0, 0)).toBeNull(); /* the hub belongs to itself */
    expect(regionAt(40, 40)).toBeNull(); /* between the hub and the regions */
  });

  it('nearestRegion measures from the patch edge', () => {
    const snow = regionById('snow');
    const hit = nearestRegion(snow.x, snow.z, 5);
    expect(hit?.region.id).toBe('snow');
    expect(hit?.dist).toBe(0);
  });

  it('the roads reach every region and stay inside the world', () => {
    expect(REGION_ROADS).toHaveLength(6);
    for (const road of REGION_ROADS) {
      expect(road.points.length).toBeGreaterThan(20);
      const region = regionById(road.region);
      /* the road ends at the region's heart */
      const last = road.points[road.points.length - 1];
      expect(Math.hypot(last.x - region.x, last.z - region.z)).toBeLessThan(2);
      /* and never leaves the wanderable world */
      for (const p of road.points) {
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(WANDER_RADIUS);
      }
    }
  });

  it('the six roads never braid into each other', () => {
    for (let i = 0; i < REGION_ROADS.length; i++) {
      for (let j = i + 1; j < REGION_ROADS.length; j++) {
        let min = Infinity;
        for (const p of REGION_ROADS[i].points) {
          for (const q of REGION_ROADS[j].points) {
            const d = Math.hypot(p.x - q.x, p.z - q.z);
            if (d < min) min = d;
          }
        }
        expect(min).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('roads keep their distance from the region islands', () => {
    for (const road of REGION_ROADS) {
      for (const isl of WORLD_ISLANDS) {
        /* the road may END near its own island's region but never cuts it */
        let min = Infinity;
        for (const p of road.points) {
          const d = Math.hypot(p.x - isl.x, p.z - isl.z);
          if (d < min) min = d;
        }
        expect(min).toBeGreaterThanOrEqual(4.2);
      }
    }
  });

  it('the hub road exits beyond the garden ring', () => {
    for (const road of REGION_ROADS) {
      const start = road.points[0];
      expect(Math.hypot(start.x, start.z)).toBeGreaterThanOrEqual(HUB_RADIUS - 2);
      expect(Math.hypot(start.x, start.z)).toBeLessThanOrEqual(HUB_RADIUS + 8);
    }
  });

  it('region signposts read honest child-steps', () => {
    for (const r of REGIONS) {
      const steps = regionSteps(r.id);
      expect(steps).toBeGreaterThan(30);
      expect(steps).toBeLessThan(600);
    }
  });
});

describe('terrainHeight — the land itself (stage 12)', () => {
  it('the hub garden stays exactly flat (stage 11 never moves)', () => {
    expect(terrainHeight(0, 0)).toBe(0);
    expect(terrainHeight(100, -100)).toBe(0);
    expect(terrainHeight(-140, 40)).toBe(0);
  });

  it('rises gently into the wilds — walkable relief, never a wall', () => {
    let maxH = 0;
    for (let x = -320; x <= 320; x += 8) {
      for (let z = -320; z <= 320; z += 8) {
        const h = terrainHeight(x, z);
        expect(h).toBeGreaterThan(-6);
        expect(h).toBeLessThan(6);
        if (Math.abs(h) > maxH) maxH = Math.abs(h);
      }
    }
    expect(maxH).toBeGreaterThan(0.5); /* the land actually rises */
  });

  it('is continuous — the fox never meets a cliff', () => {
    for (let i = 0; i < 400; i++) {
      const x = (i * 37) % 600 - 300;
      const z = (i * 91) % 600 - 300;
      const h0 = terrainHeight(x, z);
      const h1 = terrainHeight(x + 0.5, z + 0.5);
      expect(Math.abs(h1 - h0)).toBeLessThan(0.35);
    }
  });

  it('the river carves its valley through the river country', () => {
    const mid = RIVER_CONTROL[3]; /* the region heart control point */
    const inValley = terrainHeight(mid.x, mid.z);
    const onBank = terrainHeight(mid.x + 40, mid.z + 40);
    expect(inValley).toBeLessThan(-0.8);
    expect(inValley).toBeLessThan(onBank);
    /* the river polyline flows toward the north edge */
    const pts = riverPoints();
    expect(pts.length).toBeGreaterThan(50);
    expect(pts[0].z).toBeGreaterThan(300);
  });
});

describe('the stage-12 world geography is coherent', () => {
  it('every island sits inside the curated continent', () => {
    for (const p of WORLD_ISLANDS) {
      expect(Math.hypot(p.x, p.z) + p.radius).toBeLessThan(WORLD_WALK_RADIUS);
    }
  });

  it('the region hero landmarks live inside their regions', () => {
    const heroes = ['giant-tree', 'ice-tower', 'watermill', 'mega-flower', 'obelisk', 'stone-arch'];
    for (const id of heroes) {
      const l = LANDMARKS.find((x) => x.id === id)!;
      const home = REGIONS.find((r) => regionAt(l.x, l.z)?.id === r.id);
      expect(home).toBeDefined();
      void l;
    }
  });

  it('friends and signposts stay on the continent', () => {
    for (const f of FRIENDS) expect(Math.hypot(f.x, f.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS - 1);
    for (const sp of WORLD_SIGNPOSTS) expect(Math.hypot(sp.x, sp.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS);
  });
});
