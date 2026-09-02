import { describe, expect, it } from 'vitest';
import {
  TAP_MAX_MS,
  TAP_MAX_PIXELS,
  isDragDistance,
  pressEnd,
  pressStart,
} from '../world/Gestures';

describe('Gestures — the physical contract', () => {
  it('a quick, still release is a tap', () => {
    const start = pressStart(100, 100, 1000);
    expect(pressEnd(start, 104, 103, 1000 + 120)).toBe('tap');
  });

  it('the tap budgets match the spec exactly (12px, 250ms)', () => {
    expect(TAP_MAX_PIXELS).toBe(12);
    expect(TAP_MAX_MS).toBe(250);
    const start = pressStart(0, 0, 0);
    /* exactly on the distance budget edge: 12px is still a tap */
    expect(pressEnd(start, 12, 0, 100)).toBe('tap');
    /* one pixel more is a drag */
    expect(pressEnd(start, 13, 0, 100)).toBe('drag');
    /* exactly on the time budget edge is still a tap */
    expect(pressEnd(start, 0, 0, TAP_MAX_MS)).toBe('tap');
    /* a long still press is not a walk */
    expect(pressEnd(start, 0, 0, TAP_MAX_MS + 1)).toBeNull();
  });

  it('a slow short move is not a tap either', () => {
    const start = pressStart(0, 0, 0);
    expect(pressEnd(start, 8, 6, 400)).toBeNull();
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
