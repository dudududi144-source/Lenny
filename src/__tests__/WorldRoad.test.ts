import { describe, expect, it } from 'vitest';
import { FRIENDS, WORLD_SIGNPOSTS, WORLD_WALK_RADIUS, nearestFriend, pathPoints, zoneHint } from '../world/WorldLayout';
import { WORLD_ISLANDS } from '../world/WorldLayout';
import { ZONES, getZone } from '../data/garden';
import { bridgeTarget, stepsBetween } from '../world/WorldRoad';

describe('WORLD_SIGNPOSTS — the journey the child can read', () => {
  const path = pathPoints();
  const pathDist = (x: number, z: number): number => {
    let m = Infinity;
    for (const p of path) m = Math.min(m, Math.hypot(p.x - x, p.z - z));
    return m;
  };

  it('has five posts, each beside the road (off the asphalt), inside the garden', () => {
    expect(WORLD_SIGNPOSTS.length).toBe(5);
    for (const sp of WORLD_SIGNPOSTS) {
      expect(Math.hypot(sp.x, sp.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS);
      /* the road ribbon is PATH_WIDTH=1.1 (edge ~0.55) — a post at
         ≥0.75 stands clear of it; signposts are road furniture, closer
         to the road than landmarks ever are */
      expect(pathDist(sp.x, sp.z)).toBeGreaterThanOrEqual(0.75);
      expect(sp.steps).toBeGreaterThanOrEqual(4);
      expect(getZone(sp.toZone)).toBeDefined();
      expect(Number.isFinite(sp.facing)).toBe(true);
    }
  });

  it('each signpost points at a zone further down the road', () => {
    for (const sp of WORLD_SIGNPOSTS) {
      const idx = ZONES.findIndex((z) => z.id === sp.toZone);
      expect(idx).toBeGreaterThan(0);
    }
  });
});

describe('FRIENDS — named faces beside the road', () => {
  it('has four friends, each with a name and a line', () => {
    expect(FRIENDS.length).toBe(4);
    for (const f of FRIENDS) {
      expect(f.name.length).toBeGreaterThan(2);
      expect(f.line.length).toBeGreaterThan(8);
    }
    expect(new Set(FRIENDS.map((f) => f.id)).size).toBe(4);
  });

  it('each friend stands inside the garden, off every island rim', () => {
    for (const f of FRIENDS) {
      expect(Math.hypot(f.x, f.z)).toBeLessThanOrEqual(WORLD_WALK_RADIUS - 1);
      for (const isl of WORLD_ISLANDS) {
        expect(Math.hypot(f.x - isl.x, f.z - isl.z)).toBeGreaterThan(isl.radius);
      }
    }
  });

  it('friends are spread apart — not a crowd', () => {
    for (let i = 0; i < FRIENDS.length; i++) {
      for (let j = i + 1; j < FRIENDS.length; j++) {
        expect(Math.hypot(FRIENDS[i].x - FRIENDS[j].x, FRIENDS[i].z - FRIENDS[j].z)).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('nearestFriend finds the one beside you (and nobody far away)', () => {
    const bee = FRIENDS.find((f) => f.id === 'bee')!;
    const hit = nearestFriend(bee.x, bee.z, 1.2);
    expect(hit?.friend.id).toBe('bee');
    expect(nearestFriend(0, 0, 2)).toBeNull();
  });
});

describe('zoneHint — the compass points at the next honest destination', () => {
  const unlocked = new Set(['light-path', 'memory-hill']);
  const isOpen = (z: string): boolean => unlocked.has(z);

  it('skips the zone you stand in and points at the nearest open one', () => {
    const here = WORLD_ISLANDS[0]; /* light-path — standing there */
    const hint = zoneHint(here.x, here.z, isOpen);
    expect(hint).not.toBeNull();
    expect(hint!.zone).toBe('memory-hill');
    expect(hint!.steps).toBeGreaterThan(2);
  });

  it('bearing 0 means straight "up" (+z direction)', () => {
    /* standing south of memory-hill: the arrow points up */
    const mh = WORLD_ISLANDS.find((i) => i.zone === 'memory-hill')!;
    const hint = zoneHint(mh.x, mh.z - 8, isOpen);
    expect(hint!.zone).toBe('memory-hill');
    expect(hint!.bearing).toBeCloseTo(0, 6);
  });

  it('returns null when nothing is open', () => {
    expect(zoneHint(0, 0, () => false)).toBeNull();
  });
});

describe('WorldRoad — bridges and steps', () => {
  it('every island bridges to the next, the last to none', () => {
    expect(bridgeTarget(0)).toBe(WORLD_ISLANDS[1].zone);
    expect(bridgeTarget(WORLD_ISLANDS.length - 2)).toBe(WORLD_ISLANDS[WORLD_ISLANDS.length - 1].zone);
    expect(bridgeTarget(WORLD_ISLANDS.length - 1)).toBeNull();
    expect(bridgeTarget(-1)).toBeNull();
  });

  it('steps are a child-sized count, never zero', () => {
    expect(stepsBetween('light-path', 'memory-hill')).toBeGreaterThan(4);
    expect(stepsBetween('breath-pool', 'breath-pool')).toBe(4); /* the floor */
  });
});
