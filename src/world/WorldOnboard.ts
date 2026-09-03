/* ============================================================
 * WorldOnboard — the first-visit flyover state machine (extracted
 * from WorldApp.ts, ROADMAP P3 #9).
 *
 * The tour is one gentle sweep over the garden that always ends
 * exactly at the play pose (over the first island). One tap skips
 * it — the ease starts from wherever the camera happens to be
 * (ETHICS: the child is always in control, never held hostage).
 *
 * Pure core (onboardTick) + a thin runtime handle. The unit tests
 * pin the journey; e2e pins the phase flip to 'exploring'.
 * ============================================================ */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { blendPose, flyoverPose, FLYOVER_MS, FLYOVER_SETTLE_MS, type CameraPose } from './WorldCamera';

/** The camera surface the tour needs (structural — fakes test it). */
export interface OnboardCamera {
  alpha: number;
  beta: number;
  radius: number;
  readonly target: Vector3;
  setTarget(target: Vector3): unknown;
  attachControl(): unknown;
  detachControl(): unknown;
}

export interface OnboardState {
  /** ms timestamp the tour started from (pose k=0 moment). */
  bootAt: number;
  /** null = not skipped yet; otherwise the skip tap's ms timestamp. */
  skipAt: number | null;
  /** the camera pose captured at the skip tap (the ease starts here). */
  skipFrom: CameraPose | null;
}

export function initialOnboardState(bootAt: number): OnboardState {
  return { bootAt, skipAt: null, skipFrom: null };
}

export interface OnboardTick {
  pose: CameraPose;
  done: boolean;
}

/**
 * Pure: the pose the camera should hold at `now`, and whether the
 * tour has finished. Unskipped tours run FLYOVER_MS from bootAt;
 * skipped ones ease from the captured pose over FLYOVER_SETTLE_MS.
 */
export function onboardTick(state: OnboardState, now: number, play: CameraPose): OnboardTick {
  if (state.skipAt !== null && state.skipFrom !== null) {
    const pose = blendPose(state.skipFrom, play, Math.min(1, (now - state.skipAt) / FLYOVER_SETTLE_MS));
    return { pose, done: now - state.skipAt >= FLYOVER_SETTLE_MS };
  }
  const k = Math.min(1, Math.max(0, (now - state.bootAt) / FLYOVER_MS));
  return { pose: flyoverPose(k, play.tx, play.tz), done: k >= 1 };
}

export interface WorldOnboardHandle {
  active(): boolean;
  /**
   * Apply this frame's tour pose. When the tour finishes it
   * reattaches the camera, fires onDone once, and returns true
   * (exactly once — the caller flips to its exploring phase).
   */
  tick(now: number, camera: OnboardCamera): boolean;
  /** A pointer-down arrived mid-tour: ease from wherever the camera is. */
  requestSkip(now: number, camera: OnboardCamera): void;
  /** The pose the tour is driving toward (the play pose). */
  playPose(): CameraPose;
}

export function createWorldOnboard(
  active: boolean,
  play: CameraPose,
  bootAt: number,
  events: { onDone?(): void } = {},
): WorldOnboardHandle {
  let isActive = active;
  let state = initialOnboardState(bootAt);
  /* one scratch target, mutated per frame — zero allocations in the loop */
  const targetScratch = new Vector3(play.tx, 0.6, play.tz);

  return {
    active: () => isActive,
    tick(now: number, camera: OnboardCamera): boolean {
      if (!isActive) return false;
      const { pose, done } = onboardTick(state, now, play);
      camera.alpha = pose.alpha;
      camera.beta = pose.beta;
      camera.radius = pose.radius;
      targetScratch.x = pose.tx;
      targetScratch.z = pose.tz;
      camera.setTarget(targetScratch);
      if (done) {
        isActive = false;
        camera.attachControl();
        try {
          events.onDone?.();
        } catch {
          /* phase listeners never crash the garden */
        }
        return true;
      }
      return false;
    },
    requestSkip(now: number, camera: OnboardCamera): void {
      if (!isActive || state.skipAt !== null) return;
      state = {
        bootAt: state.bootAt,
        skipAt: now,
        skipFrom: {
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
          tx: camera.target.x,
          tz: camera.target.z,
        },
      };
    },
    playPose: () => play,
  };
}
