/* ============================================================
 * WorldBalloon tests — the pure journey is pinned.
 *
 * The vista ride is a promise to a small child: you leave from
 * the pad, you see the whole world, and the basket brings you
 * back to the exact same spot. These tests hold that promise.
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { balloonPose, RIDE_ALT, RIDE_MS, RIDE_RADIUS } from '../world/WorldBalloon';

const PAD = { x: 12.4, z: 31.8 }; /* a plausible pad near the home meadow */

describe('the balloon flight path leaves home and returns home', () => {
  it('starts exactly at the pad, on the ground', () => {
    const p = balloonPose(0, PAD.x, PAD.z);
    expect(p.x).toBeCloseTo(PAD.x, 6);
    expect(p.z).toBeCloseTo(PAD.z, 6);
    expect(p.alt).toBeCloseTo(0, 6);
  });

  it('lands exactly at the pad, on the ground — every flight is a round trip', () => {
    const p = balloonPose(1, PAD.x, PAD.z);
    expect(p.x).toBeCloseTo(PAD.x, 4);
    expect(p.z).toBeCloseTo(PAD.z, 4);
    expect(p.alt).toBeCloseTo(0, 4);
  });

  it('climbs: mid-flight it is high above the land', () => {
    let peak = 0;
    for (let k = 0; k <= 1; k += 0.01) {
      peak = Math.max(peak, balloonPose(k, PAD.x, PAD.z).alt);
    }
    expect(peak).toBeGreaterThan(RIDE_ALT * 0.9);
    expect(peak).toBeLessThanOrEqual(RIDE_ALT);
  });

  it('sweeps out to the wide ring — the child really leaves the garden', () => {
    let far = 0;
    for (let k = 0; k <= 1; k += 0.01) {
      const p = balloonPose(k, PAD.x, PAD.z);
      far = Math.max(far, Math.hypot(p.x, p.z));
    }
    expect(far).toBeGreaterThan(RIDE_RADIUS * 0.95);
  });

  it('is continuous — no teleports between adjacent samples', () => {
    const STEP = 0.002;
    let prev = balloonPose(0, PAD.x, PAD.z);
    for (let k = STEP; k <= 1.0001; k += STEP) {
      const p = balloonPose(Math.min(1, k), PAD.x, PAD.z);
      const jump = Math.hypot(p.x - prev.x, p.z - prev.z);
      /* a 0.002 slice of the ride legitimately covers ring × 4π × STEP
         units at cruise (the ring grew r=205 → 460) — a real teleport
         would still be 100+ units in one sample */
      const sample = 2 * Math.PI * RIDE_RADIUS * 2 * STEP; /* two full turns */
      expect(jump).toBeLessThan(sample * 1.5);
      expect(Math.abs(p.alt - prev.alt)).toBeLessThan(2.5);
      prev = p;
    }
  });

  it('never dips below the ground it flies over', () => {
    for (let k = 0; k <= 1; k += 0.005) {
      expect(balloonPose(k, PAD.x, PAD.z).alt).toBeGreaterThanOrEqual(0);
    }
  });

  it('is pure and deterministic', () => {
    const a = balloonPose(0.42, PAD.x, PAD.z);
    const b = balloonPose(0.42, PAD.x, PAD.z);
    expect(a).toEqual(b);
  });

  it('clamps out-of-range flight fractions', () => {
    const before = balloonPose(-0.7, PAD.x, PAD.z);
    expect(before.x).toBeCloseTo(PAD.x, 6);
    const after = balloonPose(1.7, PAD.x, PAD.z);
    expect(after.x).toBeCloseTo(PAD.x, 4);
    expect(after.alt).toBeCloseTo(0, 4);
  });
});

describe('the ride is a journey, not a flash', () => {
  it('lasts long enough to feel the continent', () => {
    expect(RIDE_MS).toBeGreaterThanOrEqual(20_000);
    expect(RIDE_MS).toBeLessThanOrEqual(60_000);
  });

  it('the cruise altitude reads the regions from above', () => {
    expect(RIDE_ALT).toBeGreaterThanOrEqual(90);
    expect(RIDE_ALT).toBeLessThanOrEqual(140);
  });
});
