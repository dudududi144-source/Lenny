import { describe, expect, it } from 'vitest';
import { acornCountFor, acornFieldFor, countWord, isCountComplete, COUNT_WORDS } from '../games/logic/countTap';

/* countTap — order-irrelevant tap-to-count: the set size is the whole
   difficulty, the count words are the whole feedback, and nothing can
   fail. Deterministic in (tier, seed) like every other logic module. */

describe('countTap logic', () => {
  it('set size grows with the tier (4..9), clamped', () => {
    expect([acornCountFor(0), acornCountFor(1), acornCountFor(2), acornCountFor(3)]).toEqual([4, 6, 8, 9]);
    expect(acornCountFor(-3)).toBe(4);
    expect(acornCountFor(9)).toBe(9);
  });

  it('the field always drops exactly n acorns, well separated, in bounds', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let seed = 300; seed < 400; seed += 23) {
        const f = acornFieldFor(tier, seed);
        expect(f.n).toBe(acornCountFor(tier));
        expect(f.acorns).toHaveLength(f.n);
        for (const a of f.acorns) {
          expect(a.x).toBeGreaterThanOrEqual(0.05);
          expect(a.x).toBeLessThanOrEqual(0.95);
          expect(a.y).toBeGreaterThanOrEqual(0.05);
          expect(a.y).toBeLessThanOrEqual(0.95);
        }
        for (let i = 0; i < f.acorns.length; i++) {
          for (let j = i + 1; j < f.acorns.length; j++) {
            expect(Math.hypot(f.acorns[i].x - f.acorns[j].x, f.acorns[i].y - f.acorns[j].y)).toBeGreaterThanOrEqual(0.16);
          }
        }
      }
    }
  });

  it('same (tier, seed) — same stash, every device', () => {
    expect(acornFieldFor(1, 337)).toEqual(acornFieldFor(1, 337));
    expect(acornFieldFor(1, 337)).not.toEqual(acornFieldFor(1, 338));
  });

  it('count completion: every acorn counted exactly once finishes the round', () => {
    expect(isCountComplete(0, 4)).toBe(false);
    expect(isCountComplete(3, 4)).toBe(false);
    expect(isCountComplete(4, 4)).toBe(true);
    expect(isCountComplete(5, 4)).toBe(true); /* over-count still reads as done */
    expect(isCountComplete(0, 0)).toBe(false); /* an empty round never "wins" */
  });

  it('the count words cover the largest set and speak a real ladder', () => {
    expect(COUNT_WORDS.length).toBe(10);
    expect(countWord(1)).toBe('אַחַת');
    expect(countWord(10)).toBe('עֶשֶׂר');
    expect(countWord(0)).toBe('0'); /* never spoken, but never crashes */
    for (let i = 1; i <= acornCountFor(3); i++) {
      expect(countWord(i).length).toBeGreaterThan(1);
    }
  });
});
