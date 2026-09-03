import { describe, expect, it } from 'vitest';
import { yawFor, facingToward } from '../world/WorldFox';

describe('WorldFox — the facing math a child reads as "she turns toward me"', () => {
  it('yawFor maps movement to the model\\u2019s forward (+z) yaw', () => {
    expect(yawFor(0, 1)).toBeCloseTo(0, 10); /* +z is yaw 0 */
    expect(yawFor(1, 0)).toBeCloseTo(Math.PI / 2, 10); /* +x faces right */
    expect(yawFor(0, -1)).toBeCloseTo(Math.PI, 10);
    expect(yawFor(0, 0)).toBe(0); /* standing still — no yaw */
  });

  it('facingToward turns the SHORT way around (never the long spin)', () => {
    /* from 3.0 rad to -3.0 rad: the short path is +0.28 through PI, not a 6-rad spin */
    const next = facingToward(3.0, -3.0, 0.5);
    expect(next).toBeGreaterThan(3.0);
  });

  it('facingToward eases and never overshoots the target', () => {
    const next = facingToward(0, Math.PI / 2, 1);
    expect(next).toBeCloseTo(Math.PI / 2, 10); /* k=1 arrives exactly */
    const half = facingToward(0, Math.PI / 2, 0.5);
    expect(half).toBeCloseTo(Math.PI / 4, 10);
  });

  it('facingToward holds still when k is 0', () => {
    expect(facingToward(1.234, -2.5, 0)).toBeCloseTo(1.234, 10);
  });
});
