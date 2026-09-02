import { describe, expect, it } from 'vitest';
import {
  CHILD_CAMERA,
  FLYOVER_MS,
  blendPose,
  flyoverPose,
  smoothstep,
} from '../world/WorldCamera';

describe('flyoverPose — the first-visit tour', () => {
  const HOME = { x: 0, z: -3.4 };

  it('pins the tour length the spec asks for (6s)', () => {
    expect(FLYOVER_MS).toBe(6000);
  });

  it('starts far, high and swept aside — over the world center', () => {
    const p = flyoverPose(0, HOME.x, HOME.z);
    expect(p.radius).toBeGreaterThan(16);
    expect(p.tx).toBeCloseTo(0, 6);
    expect(p.tz).toBeCloseTo(0, 6);
    expect(p.alpha).toBeLessThan(CHILD_CAMERA.startAlpha - 1.5);
    expect(p.beta).toBeLessThan(CHILD_CAMERA.startBeta);
  });

  it('ends exactly at the play pose above the first island', () => {
    const p = flyoverPose(1, HOME.x, HOME.z);
    expect(p.alpha).toBeCloseTo(CHILD_CAMERA.startAlpha, 6);
    expect(p.beta).toBeCloseTo(CHILD_CAMERA.startBeta, 6);
    expect(p.radius).toBeCloseTo(CHILD_CAMERA.startRadius, 6);
    expect(p.tx).toBeCloseTo(HOME.x, 6);
    expect(p.tz).toBeCloseTo(HOME.z, 6);
  });

  it('never leaves the child camera limits mid-tour', () => {
    for (let i = 0; i <= 20; i++) {
      const p = flyoverPose(i / 20, HOME.x, HOME.z);
      expect(p.beta).toBeGreaterThanOrEqual(CHILD_CAMERA.betaMin);
      expect(p.beta).toBeLessThanOrEqual(1.02); /* between high view and play view */
      expect(p.radius).toBeLessThanOrEqual(17.5);
      /* the target walks from the center to the island — never beyond */
      expect(Math.hypot(p.tx, p.tz)).toBeLessThanOrEqual(Math.hypot(HOME.x, HOME.z) + 0.001);
    }
  });

  it('smoothstep is flat at both ends and monotonic', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    let prev = 0;
    for (let i = 0; i <= 50; i++) {
      const v = smoothstep(i / 50);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('blendPose at k=1 lands exactly on the destination', () => {
    const a = { alpha: 0, beta: 0.7, radius: 17, tx: 0, tz: 0 };
    const b = { alpha: -1.2, beta: 1.02, radius: 12.5, tx: 1, tz: -3 };
    const out = blendPose(a, b, 1);
    expect(out.alpha).toBeCloseTo(b.alpha, 6);
    expect(out.beta).toBeCloseTo(b.beta, 6);
    expect(out.radius).toBeCloseTo(b.radius, 6);
    expect(out.tx).toBeCloseTo(1, 6);
    expect(out.tz).toBeCloseTo(-3, 6);
  });
});
