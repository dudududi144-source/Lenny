import { describe, expect, it } from 'vitest';
import { NUMERAL_NAMES, starCountFor, starFieldFor } from '../games/logic/starConnect';

/* starConnect — the number line as a spatial journey.
   The field is deterministic so every device draws the same sky. */

describe('starConnect logic', () => {
  it('ten spoken numerals, one per star', () => {
    expect(NUMERAL_NAMES.length).toBe(10);
    for (const n of NUMERAL_NAMES) expect(n.length).toBeGreaterThan(1);
  });

  it('star count grows with the tier (4..10), clamped', () => {
    expect([starCountFor(0), starCountFor(1), starCountFor(2), starCountFor(3)]).toEqual([4, 6, 8, 10]);
    expect(starCountFor(-1)).toBe(4);
    expect(starCountFor(7)).toBe(10);
  });

  it('the field lands exactly n well-spread stars inside the layout square', () => {
    for (let tier = 0; tier < 4; tier++) {
      const field = starFieldFor(tier, 731);
      expect(field.n).toBe(starCountFor(tier));
      expect(field.stars.length).toBe(field.n);
      for (const s of field.stars) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(1);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(1);
      }
      for (let i = 0; i < field.stars.length; i++) {
        for (let j = i + 1; j < field.stars.length; j++) {
          const d = Math.hypot(field.stars[i].x - field.stars[j].x, field.stars[i].y - field.stars[j].y);
          expect(d).toBeGreaterThanOrEqual(0.2); /* no two stars share a touch radius */
        }
      }
    }
  });

  it('same seed — same sky, every device', () => {
    expect(starFieldFor(2, 731)).toEqual(starFieldFor(2, 731));
    expect(starFieldFor(2, 731)).not.toEqual(starFieldFor(2, 732));
  });
});
