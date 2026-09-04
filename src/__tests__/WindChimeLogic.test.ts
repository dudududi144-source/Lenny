import { describe, expect, it } from 'vitest';
import { CHIME_COUNT, CHIME_PITCHES, echoComplete, echoMatchesSoFar, melodyFor, melodyLengthFor } from '../games/logic/windChime';

/* windChime — pure auditory working memory: six identical-looking
   chimes, a step apart for the ear. The melody is deterministic. */

describe('windChime logic', () => {
  it('six chimes on an ascending ladder', () => {
    expect(CHIME_COUNT).toBe(6);
    expect(CHIME_PITCHES.length).toBe(6);
    for (let i = 1; i < CHIME_PITCHES.length; i++) {
      expect(CHIME_PITCHES[i]).toBeGreaterThan(CHIME_PITCHES[i - 1]);
    }
  });

  it('melody length grows with the tier (3..6), clamped', () => {
    expect([melodyLengthFor(0), melodyLengthFor(1), melodyLengthFor(2), melodyLengthFor(3)]).toEqual([3, 4, 5, 6]);
    expect(melodyLengthFor(-2)).toBe(3);
    expect(melodyLengthFor(11)).toBe(6);
  });

  it('every melody stays on the chimes and never repeats a note immediately', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let seed = 100; seed < 140; seed += 17) {
        const m = melodyFor(tier, seed);
        expect(m.length).toBe(melodyLengthFor(tier));
        for (const n of m) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(CHIME_COUNT);
        }
        for (let i = 1; i < m.length; i++) {
          expect(m[i]).not.toBe(m[i - 1]);
        }
      }
    }
  });

  it('same (tier, seed) — same melody, every device', () => {
    expect(melodyFor(1, 117)).toEqual(melodyFor(1, 117));
    expect(melodyFor(1, 117)).not.toEqual(melodyFor(1, 118));
  });

  it('echo matching: prefix-true, complete only when exact', () => {
    const m = melodyFor(0, 100);
    expect(echoMatchesSoFar([], m)).toBe(true);
    expect(echoMatchesSoFar(m.slice(0, 2), m)).toBe(true);
    const wrong = m.slice();
    wrong[1] = (m[1] + 1) % CHIME_COUNT;
    expect(echoMatchesSoFar(wrong, m)).toBe(false);
    expect(echoComplete(m.slice(0, m.length - 1), m)).toBe(false);
    expect(echoComplete(m, m)).toBe(true);
    expect(echoComplete(wrong, m)).toBe(false);
  });
});
