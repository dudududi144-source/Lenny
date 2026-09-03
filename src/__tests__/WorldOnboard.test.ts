import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CHILD_CAMERA, FLYOVER_MS, FLYOVER_SETTLE_MS } from '../world/WorldCamera';
import {
  createWorldOnboard,
  initialOnboardState,
  onboardTick,
  type OnboardCamera,
} from '../world/WorldOnboard';

/* The play pose WorldApp builds: over the first island (light-path). */
const PLAY = {
  alpha: CHILD_CAMERA.startAlpha,
  beta: CHILD_CAMERA.startBeta,
  radius: CHILD_CAMERA.startRadius,
  tx: 0,
  tz: -3.4,
};

function fakeCamera(): { camera: OnboardCamera; targets: () => number; attaches: () => number } {
  let targets = 0;
  let attaches = 0;
  return {
    camera: {
      alpha: -2.4,
      beta: 0.5,
      radius: 17.5,
      target: new Vector3(0, 0.6, 0),
      setTarget: () => {
        targets++;
      },
      attachControl: () => {
        attaches++;
      },
      detachControl: () => undefined,
    },
    targets: () => targets,
    attaches: () => attaches,
  };
}

describe('onboardTick — pure tour math', () => {
  it('starts far, high and swept aside, not done', () => {
    const { pose, done } = onboardTick(initialOnboardState(1000), 1000, PLAY);
    expect(pose.radius).toBeGreaterThan(19);
    expect(pose.tx).toBeCloseTo(0, 6);
    expect(pose.tz).toBeCloseTo(0, 6);
    expect(done).toBe(false);
  });

  it('is done exactly at FLYOVER_MS and lands on the play pose', () => {
    const { pose, done } = onboardTick(initialOnboardState(1000), 1000 + FLYOVER_MS, PLAY);
    expect(done).toBe(true);
    expect(pose.alpha).toBeCloseTo(PLAY.alpha, 6);
    expect(pose.beta).toBeCloseTo(PLAY.beta, 6);
    expect(pose.radius).toBeCloseTo(PLAY.radius, 6);
    expect(pose.tx).toBeCloseTo(PLAY.tx, 6);
    expect(pose.tz).toBeCloseTo(PLAY.tz, 6);
  });

  it('never leaves the child camera limits mid-tour', () => {
    const state = initialOnboardState(0);
    for (let i = 0; i <= 30; i++) {
      const { pose } = onboardTick(state, (i / 30) * FLYOVER_MS, PLAY);
      expect(pose.beta).toBeGreaterThanOrEqual(CHILD_CAMERA.betaMin);
      expect(pose.beta).toBeLessThanOrEqual(1.02);
      expect(pose.radius).toBeLessThanOrEqual(21);
      expect(Math.hypot(pose.tx, pose.tz)).toBeLessThanOrEqual(Math.hypot(PLAY.tx, PLAY.tz) + 0.001);
    }
  });

  it('a skip eases from the captured pose and settles within FLYOVER_SETTLE_MS', () => {
    const state = {
      ...initialOnboardState(1000),
      skipAt: 2000,
      skipFrom: { alpha: -2.4, beta: 0.5, radius: 17.5, tx: 0, tz: 0 },
    };
    const mid = onboardTick(state, 2000 + FLYOVER_SETTLE_MS / 2, PLAY);
    expect(mid.done).toBe(false);
    /* still between the captured pose and the play pose */
    expect(mid.pose.radius).toBeGreaterThan(PLAY.radius);
    expect(mid.pose.radius).toBeLessThan(21);
    const settled = onboardTick(state, 2000 + FLYOVER_SETTLE_MS, PLAY);
    expect(settled.done).toBe(true);
    expect(settled.pose.alpha).toBeCloseTo(PLAY.alpha, 6);
    expect(settled.pose.tx).toBeCloseTo(PLAY.tx, 6);
  });
});

describe('createWorldOnboard — the runtime FSM', () => {
  it('ends exactly once: reattaches the camera, fires onDone, then goes quiet', () => {
    let done = 0;
    const fake = fakeCamera();
    const ob = createWorldOnboard(true, PLAY, 0, { onDone: () => done++ });
    expect(ob.active()).toBe(true);

    const finished = ob.tick(FLYOVER_MS, fake.camera);
    expect(finished).toBe(true);
    expect(done).toBe(1);
    expect(fake.attaches()).toBe(1);
    expect(fake.targets()).toBeGreaterThan(0);
    expect(ob.active()).toBe(false);

    /* after the tour the handle is inert — no more poses, no more events */
    expect(ob.tick(FLYOVER_MS + 5000, fake.camera)).toBe(false);
    expect(done).toBe(1);
  });

  it('requestSkip is idempotent — the first captured pose wins the ease', () => {
    const fake = fakeCamera();
    const ob = createWorldOnboard(true, PLAY, 0);
    ob.requestSkip(100, fake.camera);
    /* a second tap later must NOT move the ease's starting point */
    fake.camera.alpha = -1.0;
    fake.camera.radius = 9;
    ob.requestSkip(600, fake.camera);

    const mid = ob.tick(100 + FLYOVER_SETTLE_MS / 2, fake.camera);
    expect(mid).toBe(false);
    const settled = ob.tick(100 + FLYOVER_SETTLE_MS, fake.camera);
    expect(settled).toBe(true);
    expect(fake.attaches()).toBe(1);
  });

  it('an inactive tour never starts and never ends', () => {
    const fake = fakeCamera();
    const ob = createWorldOnboard(false, PLAY, 0);
    expect(ob.active()).toBe(false);
    expect(ob.tick(FLYOVER_MS, fake.camera)).toBe(false);
    expect(fake.targets()).toBe(0);
  });

  it('playPose is exactly what the tour converges to', () => {
    const ob = createWorldOnboard(true, PLAY, 0);
    const p = ob.playPose();
    expect(p.alpha).toBeCloseTo(PLAY.alpha, 6);
    expect(p.tz).toBeCloseTo(PLAY.tz, 6);
  });
});
