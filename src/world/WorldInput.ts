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
  /** A tap landed on a quest prop (flower / stone / gap) — never a walk. */
  onPropTap(propName: string): void;
  /** A tap tried to enter a fog island (already throttled). */
  onLockedTap(zone: ZoneId): void;
  /** A pointer-down landed while the tour is active (skip request). */
  onSkipTap(): void;
  isOnboarding(): boolean;
}

export interface WorldInputHandle {
  detach(): void;
  /** The held-direction vector from the keyboard (null = no keys).
      The keyboard is the desktop child's legs — same walk rules,
      same clamps, same invariants as a tap (round C a11y). */
  keyboardStep(): { x: number; z: number } | null;
  /** The shell turns keyboard walking off while the shelf is open. */
  setKeyboardEnabled(on: boolean): void;
}

/** One gentle locked-island note per this long — never a spam. */
const LOCKED_TOAST_MS = 2600;

/** The meshes a tap may land on: grass, platforms, landmarks, quest props. */
function pickKind(meshName: string): 'walk' | 'prop' | null {
  if (meshName === 'ground' || meshName.startsWith('plat-mesh-')) return 'walk';
  if (meshName.startsWith('landmark-')) return 'walk'; /* the rim IS the destination */
  if (meshName.startsWith('quest-')) return 'prop';
  return null;
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

  /* ---------- keyboard walking (round C a11y) ----------
     Arrows / WASD = held direction. The poller in the render loop
     turns it into walk targets through the SAME resolveWalkTarget
     clamps a tap uses — the desktop child walks the same garden. */
  const heldKeys = new Set<string>();
  let keyboardEnabled = true;
  const WALK_KEYS = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'w', 'a', 's', 'd', 'W', 'A', 'S', 'D',
  ];
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (!WALK_KEYS.includes(ev.key)) return;
    if (events.isOnboarding()) return; /* the tour owns the camera */
    ev.preventDefault(); /* arrows never scroll the garden away */
    heldKeys.add(ev.key);
  };
  const onKeyUp = (ev: KeyboardEvent): void => {
    heldKeys.delete(ev.key);
  };
  const onBlur = (): void => {
    heldKeys.clear(); /* a hidden tab never leaves a stuck walk */
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

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

    /* ray-based pick: CSS coords in, surface predicate on */
    const ray = new Ray(Vector3.Zero(), Vector3.Zero());
    scene.createPickingRayToRef(ev.offsetX, ev.offsetY, Matrix.Identity(), ray, camera);
    const pick = scene.pickWithRay(ray, (m) => m.isPickable && pickKind(m.name) !== null);
    if (!pick || !pick.hit || !pick.pickedPoint) return;

    if (pickKind(pick.pickedMesh!.name) === 'prop') {
      /* a flower is a flower — prop taps never resolve into walks */
      try {
        events.onPropTap(pick.pickedMesh!.name);
      } catch {
        /* a prop tap never crashes the garden */
      }
      return;
    }

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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
    keyboardStep(): { x: number; z: number } | null {
      if (!keyboardEnabled || heldKeys.size === 0) return null;
      let x = 0;
      let z = 0;
      if (heldKeys.has('ArrowLeft') || heldKeys.has('a') || heldKeys.has('A')) x -= 1;
      if (heldKeys.has('ArrowRight') || heldKeys.has('d') || heldKeys.has('D')) x += 1;
      if (heldKeys.has('ArrowUp') || heldKeys.has('w') || heldKeys.has('W')) z -= 1;
      if (heldKeys.has('ArrowDown') || heldKeys.has('s') || heldKeys.has('S')) z += 1;
      if (x === 0 && z === 0) return null;
      const len = Math.hypot(x, z);
      return { x: x / len, z: z / len };
    },
    setKeyboardEnabled(on: boolean): void {
      keyboardEnabled = on;
      if (!on) heldKeys.clear();
    },
  };
}
