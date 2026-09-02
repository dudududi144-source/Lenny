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
  radiusMin: 6,
  radiusMax: 18,
  inertia: 0.92,
  /** default angular sensibility 1000 → slower = bigger value */
  angularSensibility: Math.round(1000 / 0.6),
  startAlpha: -Math.PI / 2,
  startBeta: 1.02,
  startRadius: 12.5,
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
  camera.maxZ = 420;

  camera.attachControl();

  return camera;
}
