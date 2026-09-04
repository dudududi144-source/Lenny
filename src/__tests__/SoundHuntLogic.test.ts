import { describe, expect, it } from 'vitest';
import { bubbleMsFor, croakEveryFor, frogPadFor, padCountFor, padLayoutFor } from '../games/logic/soundHunt';

/* soundHunt — peek-a-boo auditory attention: the pond is deterministic,
   the frog is deterministic, and the knobs (bubble window, croak pace)
   soften or sharpen by tier without ever creating a fail state. */

describe('soundHunt logic', () => {
  it('pad count grows with the tier (4..6), clamped', () => {
    expect([padCountFor(0), padCountFor(1), padCountFor(2), padCountFor(3)]).toEqual([4, 5, 6, 6]);
    expect(padCountFor(-2)).toBe(4);
    expect(padCountFor(5)).toBe(6);
  });

  it('the bubble shrinks and the croak slows as the tier climbs', () => {
    expect([bubbleMsFor(0), bubbleMsFor(1), bubbleMsFor(2), bubbleMsFor(3)]).toEqual([1050, 880, 720, 600]);
    expect([croakEveryFor(0), croakEveryFor(1), croakEveryFor(2), croakEveryFor(3)]).toEqual([3000, 3400, 3800, 4200]);
    expect(bubbleMsFor(9)).toBe(600);
    expect(croakEveryFor(-1)).toBe(3000);
  });

  it('every pond lands n pads, well separated and in bounds', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let seed = 500; seed < 600; seed += 31) {
        const pond = padLayoutFor(tier, seed);
        expect(pond.n).toBe(padCountFor(tier));
        expect(pond.pads).toHaveLength(pond.n);
        for (const p of pond.pads) {
          expect(p.x).toBeGreaterThanOrEqual(0.1);
          expect(p.x).toBeLessThanOrEqual(0.9);
          expect(p.y).toBeGreaterThanOrEqual(0.1);
          expect(p.y).toBeLessThanOrEqual(0.9);
        }
        for (let i = 0; i < pond.pads.length; i++) {
          for (let j = i + 1; j < pond.pads.length; j++) {
            expect(Math.hypot(pond.pads[i].x - pond.pads[j].x, pond.pads[i].y - pond.pads[j].y)).toBeGreaterThanOrEqual(0.23);
          }
        }
      }
    }
  });

  it('the frog hides at a valid, deterministic pad for (count, seed)', () => {
    for (let n = 1; n <= 6; n++) {
      for (let seed = 500; seed < 540; seed += 7) {
        const idx = frogPadFor(n, seed);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(n);
        expect(frogPadFor(n, seed)).toBe(idx); /* same seed, same pad */
      }
    }
    /* and the frog moves around the pond across seeds (never stuck) */
    const seen = new Set<number>();
    for (let seed = 550; seed < 590; seed++) seen.add(frogPadFor(4, seed));
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});
