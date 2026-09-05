/* stage 20 — the legs' contract: eased in, glided out, never a lurch.
   The owner: the old snap-to-full-speed walk read "fast and weird,
   not fun". These pins keep the gentle legs honest. */
import { describe, expect, it } from 'vitest';
import { kidWalkSpeed, MAX_WALK_SPEED, TAP_STROLL_MAX, WALK_ACCEL, WALK_DECEL } from '../world/WorldLayout';

void WALK_DECEL;

describe('kidWalkSpeed — the eased legs', () => {
  it('starts from zero and never exceeds the peak', () => {
    expect(kidWalkSpeed(0, true, 0.016)).toBeCloseTo(WALK_ACCEL * 0.016, 5);
    expect(kidWalkSpeed(MAX_WALK_SPEED, true, 1)).toBe(MAX_WALK_SPEED);
    expect(kidWalkSpeed(MAX_WALK_SPEED * 2, true, 0.016)).toBe(MAX_WALK_SPEED);
  });

  it('reaches full speed in about a third of a second, not in one frame', () => {
    let v = 0;
    const dt = 1 / 60;
    let frames = 0;
    while (v < MAX_WALK_SPEED - 1e-6 && frames < 600) {
      v = kidWalkSpeed(v, true, dt);
      frames++;
    }
    expect(frames).toBeGreaterThan(8); /* no first-frame lurch */
    expect(frames).toBeLessThan(40); /* ~0.30s at 60fps */
  });

  it('glides to a gentle stop after release (no freeze-frame)', () => {
    let v = MAX_WALK_SPEED;
    const dt = 1 / 60;
    let frames = 0;
    while (v > 0 && frames < 600) {
      v = kidWalkSpeed(v, false, dt);
      frames++;
    }
    expect(frames).toBeGreaterThan(10); /* a real glide, not a dead stop */
    expect(v).toBe(0); /* and it does stop */
  });

  it('never goes negative and tames absurd frame times', () => {
    expect(kidWalkSpeed(0.5, false, 5)).toBe(0);
    /* dt is clamped to 0.1s: one giant frame adds one bounded step,
       the NEXT frames finish the ramp — a lag spike can't teleport */
    expect(kidWalkSpeed(0, true, 5)).toBeCloseTo(WALK_ACCEL * 0.1, 5);
    expect(kidWalkSpeed(-3, true, 0.016)).toBeGreaterThan(0);
  });

  it('a tap stroll stays child-sized', () => {
    /* 40u ≈ 6–7s of walking — the anti-"קפיצה ממקום למקום" bound */
    expect(TAP_STROLL_MAX).toBeLessThan(50);
    expect(MAX_WALK_SPEED).toBeLessThan(8); /* the frantic 9.6 sprint is retired */
  });
});
