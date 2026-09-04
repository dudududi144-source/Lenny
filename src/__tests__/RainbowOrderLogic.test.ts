import { describe, expect, it } from 'vitest';
import { RAINBOW_COLORS, stoneCountFor, stonesFor } from '../games/logic/rainbowOrder';

/* rainbowOrder — seriation along the rainbow's own canonical order.
   The rainbow IS the legend: the answer key is the culture, not a rule. */

describe('rainbowOrder logic', () => {
  it('the rainbow is the alphabet: 6 unique colors, each with a spoken name', () => {
    expect(RAINBOW_COLORS.length).toBe(6);
    const hexes = new Set(RAINBOW_COLORS.map((c) => c.hex));
    expect(hexes.size).toBe(6);
    for (const c of RAINBOW_COLORS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.hex).toBeGreaterThan(0);
    }
  });

  it('stone count grows gently with the tier (4..6, capped)', () => {
    expect([stoneCountFor(0), stoneCountFor(1), stoneCountFor(2), stoneCountFor(3)]).toEqual([4, 5, 6, 6]);
    expect(stoneCountFor(-3)).toBe(4);
    expect(stoneCountFor(9)).toBe(6);
  });

  it('stonesFor is always a PREFIX of the rainbow, in canonical order', () => {
    for (let tier = 0; tier < 4; tier++) {
      const stones = stonesFor(tier);
      expect(stones).toEqual(RAINBOW_COLORS.slice(0, stones.length));
      expect(stones.length).toBe(stoneCountFor(tier));
    }
  });
});
