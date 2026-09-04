import { describe, expect, it } from 'vitest';
import { NEST_NAMES, contrastFor, leafCountFor, leafPlanFor, leafRadius, nestForLeaf } from '../games/logic/leafSize';

/* leafSize — classification into three visible anchors (small /
   medium / big). The plan is deterministic; every size appears. */

describe('leafSize logic', () => {
  it('three spoken nests: small, medium, big', () => {
    expect(NEST_NAMES.length).toBe(3);
    for (const n of NEST_NAMES) expect(n.length).toBeGreaterThan(1);
  });

  it('leaf count grows with the tier (5..8), clamped', () => {
    expect([leafCountFor(0), leafCountFor(1), leafCountFor(2), leafCountFor(3)]).toEqual([5, 6, 7, 8]);
    expect(leafCountFor(-5)).toBe(5);
    expect(leafCountFor(9)).toBe(8);
  });

  it('contrast tightens with the tier — finer judgments need closer sizes', () => {
    const c = [contrastFor(0), contrastFor(1), contrastFor(2), contrastFor(3)];
    expect(c[0]).toBeGreaterThan(c[1]);
    expect(c[1]).toBeGreaterThan(c[2]);
    expect(c[2]).toBeGreaterThan(c[3]);
  });

  it('a plan covers every size, stays in 0..2, and is deterministic', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let round = 1; round <= 5; round++) {
        const plan = leafPlanFor(tier, 500 + round * 13, round);
        expect(plan.leaves.length).toBe(leafCountFor(tier));
        expect(plan.contrast).toBe(contrastFor(tier));
        for (const size of plan.leaves) {
          expect(size).toBeGreaterThanOrEqual(0);
          expect(size).toBeLessThanOrEqual(2);
        }
        for (let s = 0; s < 3; s++) {
          expect(plan.leaves).toContain(s); /* every nest gets a leaf */
        }
      }
    }
    expect(leafPlanFor(2, 526, 4)).toEqual(leafPlanFor(2, 526, 4));
  });

  it('leaf radius grows with size and stays a big touch target', () => {
    for (const contrast of [1, 0.72, 0.62]) {
      expect(leafRadius(1, contrast)).toBeGreaterThan(leafRadius(0, contrast));
      expect(leafRadius(2, contrast)).toBeGreaterThan(leafRadius(1, contrast));
      expect(leafRadius(0, contrast)).toBeGreaterThanOrEqual(26);
    }
  });

  it('nestForLeaf clamps into the honest 0..2 band', () => {
    expect(nestForLeaf(0)).toBe(0);
    expect(nestForLeaf(1)).toBe(1);
    expect(nestForLeaf(2)).toBe(2);
    expect(nestForLeaf(-4)).toBe(0);
    expect(nestForLeaf(7)).toBe(2);
    expect(nestForLeaf(1.7)).toBe(1);
  });
});
