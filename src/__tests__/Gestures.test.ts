import { describe, expect, it } from 'vitest';
import {
  TAP_MAX_PIXELS,
  isDragDistance,
  pressEnd,
  pressStart,
} from '../world/Gestures';

describe('Gestures — the physical contract (critic round B, W5)', () => {
  it('a quick, still release is a tap', () => {
    const start = pressStart(100, 100, 1000);
    expect(pressEnd(start, 104, 103, 1000 + 120)).toBe('tap');
  });

  it('the distance budget matches the spec exactly (12px)', () => {
    expect(TAP_MAX_PIXELS).toBe(12);
    const start = pressStart(0, 0, 0);
    /* exactly on the distance budget edge: 12px is still a tap */
    expect(pressEnd(start, 12, 0, 100)).toBe('tap');
    /* one pixel more is a drag */
    expect(pressEnd(start, 13, 0, 100)).toBe('drag');
  });

  it('a 4-year-old slow press is still a walk — duration never voids a tap', () => {
    const start = pressStart(0, 0, 0);
    expect(pressEnd(start, 0, 0, 300)).toBe('tap');
    expect(pressEnd(start, 2, 1, 500)).toBe('tap');
    expect(pressEnd(start, 3, 2, 900)).toBe('tap');
    expect(pressEnd(start, 1, 0, 4000)).toBe('tap');
  });

  it('a slow SHORT move is a tap too (little fingers wobble)', () => {
    const start = pressStart(0, 0, 0);
    expect(pressEnd(start, 8, 6, 400)).toBe('tap');
  });

  it('distance aborts into a drag mid-gesture', () => {
    const start = pressStart(0, 0, 0);
    expect(isDragDistance(start, 30, 0)).toBe(true);
    expect(isDragDistance(start, 5, 5)).toBe(false);
  });

  it('diagonal movement is measured euclideanly', () => {
    const start = pressStart(0, 0, 0);
    expect(pressEnd(start, 9, 9, 100)).toBe('drag'); /* hyp(9,9)=12.7 > 12 */
    expect(pressEnd(start, 8, 8, 100)).toBe('tap'); /* hyp(8,8)=11.3 <= 12 */
  });
});
