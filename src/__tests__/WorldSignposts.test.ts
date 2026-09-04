import { describe, expect, it } from 'vitest';
import { REGIONS, REGION_ROADS, regionById } from '../world/WorldRegions';
import { planSignposts, regionAngularOrder } from '../world/WorldSignposts';

/* stage 16-c — the silent wayfinding planner: text-free carved arrows
   that point at REAL region hearts, posts that never block the road,
   a totem in every region's color. All pure, so all unit-pinned. */

describe('WorldSignposts — the continent reads without words', () => {
  it('plants a fork post per road start and a gate post + totem per region', () => {
    const { posts, totems } = planSignposts();
    expect(posts.filter((p) => p.kind === 'fork').length).toBe(REGIONS.length);
    expect(posts.filter((p) => p.kind === 'gate').length).toBe(REGIONS.length);
    expect(totems.length).toBe(REGIONS.length);
  });

  it('deterministic: the same plan twice, byte for byte', () => {
    expect(planSignposts()).toEqual(planSignposts());
  });

  it('every carved arrow points at the ACTUAL target it names', () => {
    const { posts } = planSignposts();
    for (const post of posts) {
      expect(post.arrows.length).toBe(3);
      for (const arrow of post.arrows) {
        if (arrow.to === 'hub') continue;
        const heart = regionById(arrow.to);
        const want = Math.atan2(heart.x - post.x, heart.z - post.z);
        expect(arrow.yaw).toBeCloseTo(want, 6);
      }
    }
  });

  it('fork arrows lead with the road’s own region at the top', () => {
    const { posts } = planSignposts();
    for (const post of posts.filter((p) => p.kind === 'fork')) {
      expect(post.arrows[0].to).toBe(post.region);
      expect(post.arrows[0].y).toBeGreaterThan(post.arrows[1].y);
      expect(post.arrows[1].y).toBeGreaterThan(post.arrows[2].y);
    }
  });

  it('posts stand clear of the road they describe (never blocking it)', () => {
    const { posts } = planSignposts();
    for (const post of posts) {
      const road = REGION_ROADS.find((r) => r.region === post.region)!;
      let nearest = Infinity;
      for (const p of road.points) {
        const d = Math.hypot(p.x - post.x, p.z - post.z);
        if (d < nearest) nearest = d;
      }
      expect(nearest).toBeGreaterThan(1.2);
      expect(Math.hypot(post.x, post.z)).toBeLessThanOrEqual(1200);
    }
  });

  it('totems wear their region’s own color at the entrance', () => {
    const { totems } = planSignposts();
    for (const totem of totems) {
      expect(totem.color).toBe(regionById(totem.region).tint);
      const gate = REGION_ROADS.find((r) => r.region === totem.region)!.gate;
      const d = Math.hypot(totem.x - gate.x, totem.z - gate.z);
      expect(d).toBeGreaterThan(1.2); /* beside the gate, not on it */
      expect(d).toBeLessThan(6);
    }
  });

  it('angular order sorts the ten hearts around the hub by compass angle', () => {
    const order = regionAngularOrder();
    expect(order.length).toBe(REGIONS.length);
    for (let i = 1; i < order.length; i++) {
      expect(Math.atan2(order[i].z, order[i].x)).toBeGreaterThanOrEqual(
        Math.atan2(order[i - 1].z, order[i - 1].x),
      );
    }
  });
});
