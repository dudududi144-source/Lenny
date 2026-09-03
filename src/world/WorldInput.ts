/* ============================================================
 * WorldInput — the canvas gesture pipeline (extracted from
 * WorldApp.ts, ROADMAP P3 #9).
 *
 * Owns the pointer lifecycle and the physical tap contract
 * (Gestures.ts): a short tap picks the ground and resolves a walk
 * target, a drag belongs to the camera, a tap during the tour
 * asks to skip. Locked-fog whispers are throttled HERE so the
 * shell never spams toasts.
 *
 * DOM-free decisions live in Gestures + WorldLayout (tested);
 * this module is the thin wiring between them and the canvas.
 * ============================================================ */

import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { isDragDistance, pressEnd, pressStart, type PointerSnapshot } from './Gestures';
import { resolveWalkTarget, type WalkResolution } from './WorldLayout';
import type { ZoneId } from '../data/garden';

export interface WorldInputEvents {
  /** A tap resolved into a walk target (or a rim hold at a fog island). */
  onWalkTarget(resolved: WalkResolution): void;
  /** A tap tried to enter a fog island (already throttled). */
  onLockedTap(zone: ZoneId): void;
  /** A pointer-down landed while the tour is active (skip request). */
  onSkipTap(): void;
  isOnboarding(): boolean;
}

export interface WorldInputHandle {
  detach(): void;
}

/** One gentle locked-island note per this long — never a spam. */
const LOCKED_TOAST_MS = 2600;

/** The only meshes a walk tap may land on: the grass and the platforms. */
function walkPickable(meshName: string): boolean {
  return meshName === 'ground' || meshName.startsWith('plat-mesh-');
}

export function attachWorldInput(
  canvas: HTMLCanvasElement,
  scene: Scene,
  camera: Camera,
  isZoneLocked: (zone: ZoneId) => boolean,
  events: WorldInputEvents,
): WorldInputHandle {
  let press: PointerSnapshot | null = null;
  let dragAborted = false;
  let lockedToastAt = 0;

  const onPointerDown = (ev: PointerEvent): void => {
    if (events.isOnboarding()) {
      /* ETHICS: the child is always in control — one tap skips the tour */
      events.onSkipTap();
    }
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    press = pressStart(ev.offsetX, ev.offsetY, performance.now());
    dragAborted = false;
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (!press || dragAborted) return;
    if (isDragDistance(press, ev.offsetX, ev.offsetY)) {
      dragAborted = true; /* this press is an orbit now — the camera eats it */
    }
  };

  const onPointerUp = (ev: PointerEvent): void => {
    if (!press) return;
    const start = press;
    press = null;
    if (dragAborted) return; /* this press became an orbit — the camera ate it */
    if (pressEnd(start, ev.offsetX, ev.offsetY, performance.now()) !== 'tap') return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (events.isOnboarding()) return; /* walking unlocks after the tour */

    /* ray-based pick: CSS coords in, walkable-surface predicate on */
    const ray = new Ray(Vector3.Zero(), Vector3.Zero());
    scene.createPickingRayToRef(ev.offsetX, ev.offsetY, Matrix.Identity(), ray, camera);
    const pick = scene.pickWithRay(ray, (m) => m.isPickable && walkPickable(m.name));
    if (!pick || !pick.hit || !pick.pickedPoint) return;

    const resolved = resolveWalkTarget(pick.pickedPoint.x, pick.pickedPoint.z, isZoneLocked);
    if (resolved.blocked && resolved.blockedZone) {
      const now = performance.now();
      if (now - lockedToastAt > LOCKED_TOAST_MS) {
        lockedToastAt = now;
        try {
          events.onLockedTap(resolved.blockedZone);
        } catch {
          /* a toast never crashes the garden */
        }
      }
    }
    try {
      events.onWalkTarget(resolved);
    } catch {
      /* a walk target never crashes the garden */
    }
  };

  const onPointerCancel = (): void => {
    press = null;
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return {
    detach(): void {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}
