/* ============================================================
 * WorldCamera — the child's eyes in the 3D garden.
 *
 * Tuned for ages 4-7 (Stage 7 spec):
 *   - beta 0.15..1.25 — the camera never dives underground and
 *     never flips over the top
 *   - radius 6..18 — close enough to feel, far enough to see
 *   - inertia 0.92 — water-smooth orbiting
 *   - rotation speed = default × 0.6 — calm, never dizzying
 *   - panning disabled — two axes only a child needs: look + zoom
 *   - pinch/wheel zoom stay gentle (percentage-based)
 *
 * No character: the camera IS the child's presence (Toca-Boca-like).
 * ============================================================ */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

/** The numbers the spec pins (exported so tests can pin them too). */
export const CHILD_CAMERA = {
  betaMin: 0.15,
  betaMax: 1.25,
  radiusMin: 3.4,
  radiusMax: 46,
  inertia: 0.92,
  /** default angular sensibility 1000 → slower = bigger value */
  angularSensibility: Math.round(1000 / 0.6),
  startAlpha: -Math.PI / 2,
  /* stage 14-B/C composition: beta 0.93 (~37° above the horizon) — the
     child SEES the road and the next clearing ahead (the stage-13 angle
     hid the ground only ~9u in front of the paws) and still keeps the
     horizon band where the continent shows off */
  startBeta: 0.93,
  startRadius: 16,
} as const;

export function createWorldCamera(scene: Scene, target: Vector3): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'world-camera',
    CHILD_CAMERA.startAlpha,
    CHILD_CAMERA.startBeta,
    CHILD_CAMERA.startRadius,
    target.clone(),
    scene,
  );

  camera.lowerBetaLimit = CHILD_CAMERA.betaMin;
  camera.upperBetaLimit = CHILD_CAMERA.betaMax;
  camera.lowerRadiusLimit = CHILD_CAMERA.radiusMin;
  camera.upperRadiusLimit = CHILD_CAMERA.radiusMax;
  camera.inertia = CHILD_CAMERA.inertia;
  camera.angularSensibilityX = CHILD_CAMERA.angularSensibility;
  camera.angularSensibilityY = CHILD_CAMERA.angularSensibility;

  /* no sliding — orbit and zoom only */
  camera.panningSensibility = 0;

  /* gentle zoom on both wheel and pinch */
  camera.wheelDeltaPercentage = 0.01;
  camera.pinchDeltaPercentage = 0.01;

  camera.minZ = 0.4;
  /* stage 14-C: the continent + the mountain ring live FAR away now
     (peaks at ~940u) — the far plane follows the horizon */
  camera.maxZ = 3600; /* 16-a: the wider continent + its horizon ring */

  camera.attachControl();

  return camera;
}

/* ---------- the first-visit flyover (Stage 7, commit 6) ---------- */

export const FLYOVER_MS = 6000;
/** After a skip tap, this long does the settle-to-play ease take. */
export const FLYOVER_SETTLE_MS = 1000;

export interface CameraPose {
  alpha: number;
  beta: number;
  radius: number;
  tx: number;
  tz: number;
}

export function smoothstep(k: number): number {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
}

/**
 * The 6-second first-visit tour: one gentle sweep over the garden,
 * ending exactly at the play pose (over the first island). Pure —
 * the unit tests pin the journey; the child may skip any moment.
 */
export function flyoverPose(k: number, homeX: number, homeZ: number): CameraPose {
  const t = smoothstep(k);
  return {
    alpha: -Math.PI / 2 - (1 - t) * 2.1,
    beta: 0.62 + (CHILD_CAMERA.startBeta - 0.62) * t,
    radius: 21 + (CHILD_CAMERA.startRadius - 21) * t,
    tx: homeX * t,
    tz: homeZ * t,
  };
}

/** The pose a camera is currently at (for the skip ease). */
export function capturePose(camera: ArcRotateCamera): CameraPose {
  return {
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    tx: camera.target.x,
    tz: camera.target.z,
  };
}

/** Linear blend between two poses (k clamped). */
export function blendPose(a: CameraPose, b: CameraPose, k: number): CameraPose {
  const t = smoothstep(k);
  return {
    alpha: a.alpha + (b.alpha - a.alpha) * t,
    beta: a.beta + (b.beta - a.beta) * t,
    radius: a.radius + (b.radius - a.radius) * t,
    tx: a.tx + (b.tx - a.tx) * t,
    tz: a.tz + (b.tz - a.tz) * t,
  };
}
