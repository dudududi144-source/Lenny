import { describe, expect, it } from 'vitest';
import { FpsGovernor } from '../world/FpsGovernor';

/** Push a steady frame stream at a given fps for a given duration. */
function run(gov: FpsGovernor, fps: number, seconds: number, start = 1000): number {
  const dt = 1000 / fps;
  const frames = Math.floor((seconds * 1000) / dt);
  let now = start;
  for (let i = 0; i < frames; i++) {
    gov.push(now, dt);
    now += dt;
  }
  return now;
}

describe('FpsGovernor', () => {
  it('measures trailing fps from frame times', () => {
    const gov = new FpsGovernor();
    const now = run(gov, 60, 2);
    expect(gov.fps(now)).toBeGreaterThan(55);
    expect(gov.fps(now)).toBeLessThan(65);
  });

  it('reads a slow device as slow', () => {
    const gov = new FpsGovernor();
    const now = run(gov, 18, 2);
    expect(gov.fps(now)).toBeGreaterThan(15);
    expect(gov.fps(now)).toBeLessThan(21);
  });

  it('returns 0 before any frames', () => {
    const gov = new FpsGovernor();
    expect(gov.fps(0)).toBe(0);
  });

  it('softens the resolution below 25fps (auto hardware scaling)', () => {
    const gov = new FpsGovernor({ decisionMs: 0 });
    let now = run(gov, 20, 1);
    const before = gov.evaluate(now, 1);
    expect(before.newScale).toBeGreaterThan(1);
    now = run(gov, 60, 1, now + 2000);
    const healthy = gov.evaluate(now, before.newScale);
    expect(healthy.newScale).toBeLessThan(before.newScale);
  });

  it('never scales past the cap', () => {
    const gov = new FpsGovernor({ maxScale: 1.5, decisionMs: 0 });
    let now = 1000;
    let scale = 1;
    for (let i = 0; i < 50; i++) {
      now = run(gov, 10, 0.6, now); /* fresh frames before every decision */
      scale = gov.evaluate(now, scale).newScale;
    }
    expect(scale).toBe(1.5);
  });

  it('keeps the scale at base on a healthy device', () => {
    const gov = new FpsGovernor();
    const now = run(gov, 60, 1);
    const d = gov.evaluate(now, 1);
    expect(d.newScale).toBe(1);
    expect(d.distress).toBe(false);
  });

  it('fires distress only after 5 sustained seconds below 15fps', () => {
    const gov = new FpsGovernor({ decisionMs: 0, distressMs: 5000 });
    let now = run(gov, 12, 1); /* 1s of 12fps */
    let d = gov.evaluate(now, 1); /* the distress clock starts here */
    expect(d.distress).toBe(false);
    now = run(gov, 12, 3, now); /* 4s total — still inside the budget */
    d = gov.evaluate(now, 1);
    expect(d.distress).toBe(false);
    now = run(gov, 12, 2.2, now); /* past the 5s budget */
    d = gov.evaluate(now, 1);
    expect(d.distress).toBe(true);
    /* one-shot: not again while still slow */
    now = run(gov, 12, 1, now);
    d = gov.evaluate(now, 1);
    expect(d.distress).toBe(false);
  });

  it('recovers the distress window when fps comes back up', () => {
    const gov = new FpsGovernor({ decisionMs: 0, distressMs: 5000 });
    let now = run(gov, 12, 3);
    gov.evaluate(now, 1);
    now = run(gov, 60, 2, now); /* recovered */
    gov.evaluate(now, 1);
    /* slow again — the budget restarts from zero */
    now = run(gov, 12, 3, now);
    const d = gov.evaluate(now, 1);
    expect(d.distress).toBe(false);
  });

  it('reset() forgets the frame history', () => {
    const gov = new FpsGovernor();
    run(gov, 30, 1);
    gov.reset();
    expect(gov.fps(2000)).toBe(0);
  });
});
