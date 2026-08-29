/* ============================================================
 * RhythmEngine — unit tests.
 *
 * The engine is stateless between hits and works with any clock:
 * we drive it with synthetic clock values. bpm=60 -> 1s per beat,
 * leadIn=1 -> beats at t = 1, 2, 3, 4 seconds.
 * ============================================================ */

import { describe, it, expect } from 'vitest';
import { RhythmEngine } from '../games/fx/RhythmEngine';

function makeEngine(beats = 4): RhythmEngine {
  return new RhythmEngine({ bpm: 60, beats, leadIn: 1.0 });
}

describe('RhythmEngine', () => {
  it('judges an exactly-on-beat tap as perfect', () => {
    const e = makeEngine();
    e.start(0);
    const j = e.judge(1.0);
    expect(j.grade).toBe('perfect');
    expect(j.beatIndex).toBe(0);
    expect(j.offset).toBe(0);
  });

  it('judges offset 0.1s as perfect (within the 0.12 window)', () => {
    const e = makeEngine();
    e.start(0);
    expect(e.judge(1.1).grade).toBe('perfect');
  });

  it('judges offset 0.15s as good (within the 0.28 window)', () => {
    const e = makeEngine();
    e.start(0);
    const j = e.judge(1.15);
    expect(j.grade).toBe('good');
    expect(j.beatIndex).toBe(0);
  });

  it('judges offset 0.5s as miss (outside the good window)', () => {
    const e = makeEngine();
    e.start(0);
    const j = e.judge(1.5);
    expect(j.grade).toBe('miss');
    expect(j.beatIndex).toBe(-1);
  });

  it('a beat cannot be judged twice; a second tap near it misses', () => {
    const e = makeEngine();
    e.start(0);
    expect(e.judge(1.0).grade).toBe('perfect'); /* beat 0 consumed */
    const again = e.judge(1.05); /* nearest un-judged beat is beat 1 at t=2 */
    expect(again.grade).toBe('miss');
  });

  it('isDone only after the last beat plus the good window', () => {
    const e = makeEngine(4); /* last beat at t=4 */
    e.start(0);
    expect(e.isDone(4.0)).toBe(false);
    expect(e.isDone(4.3)).toBe(true);
  });

  it('hits() counts only consumed beats', () => {
    const e = makeEngine();
    e.start(0);
    e.judge(1.0); /* perfect */
    e.judge(2.1); /* good on beat 1 */
    expect(e.hits()).toBe(2);
    e.judge(9.9); /* far off -> miss, does not consume */
    expect(e.hits()).toBe(2);
  });

  it('upcoming() returns only future beats inside the horizon, relative to now', () => {
    const e = makeEngine(4);
    e.start(0);
    expect(e.upcoming(0, 2.5)).toEqual([1.0, 2.0]);
    expect(e.upcoming(3.5, 2)).toEqual([0.5]); /* beat 4 at t=4 */
    expect(e.upcoming(10, 5)).toEqual([]); /* nothing left */
  });

  it('does not judge anything before start()', () => {
    const e = makeEngine();
    expect(e.elapsed(5)).toBe(0);
    expect(e.isDone(100)).toBe(false);
  });
});
