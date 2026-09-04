/* ============================================================
 * WorldFox — the child's body in the garden (stage 11, the great
 * journey). Until now the child WAS a hover-dot with a star above
 * it; a big world deserves a real walker: a small orange cub who
 * turns to face where she goes, swings her legs while she walks,
 * flops her ears when she jumps, and wags her tail when she stops.
 *
 * Built from primitives only (zero assets, the garden's law):
 * body, head, ears, snout, nose, eyes, cheeks, tail, four legs.
 *
 * Performance discipline (the WorldLandmarks pattern):
 *   - materials created once, shared
 *   - zero per-frame allocations — every animation writes straight
 *     into transforms from module state
 *   - one shadow-caster body mesh (the fox IS the shadow's owner)
 *
 * Pure-ish: the facing math lives in facingToward (unit-pinned).
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

const hex = (s: string): Color3 => Color3.FromHexString(s);

/** Colors: a warm garden cub — caramel coat, cream belly, dark boots. */
const FOX_COLORS = {
  coat: '#e08a3c',
  coatDark: '#c4712c',
  cream: '#fdf3e0',
  dark: '#4a3220',
  nose: '#33231a',
  blush: '#f2a48c',
} as const;

/**
 * Smooth facing: the shortest angular path toward `target`, eased by
 * k (0..1). Pure so the turn feels the same by test as by eye.
 */
export function facingToward(current: number, target: number, k: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.max(0, Math.min(1, k));
}

/** Yaw so the model's +z forward points along (dx, dz). */
export function yawFor(dx: number, dz: number): number {
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(dx, dz);
}

export interface FoxFrame {
  /** world XZ of the cub's feet */
  pos: { x: number; z: number };
  /** planar speed (0 = idle) */
  speed: number;
  /** yaw the cub should face (radians) */
  facing: number;
  /** ground height under the feet */
  groundY: number;
  /** current jump offset above ground (0 = grounded) */
  jumpY: number;
  /** true on the frame the ground was re-entered (landing squash) */
  landed: boolean;
}

export interface FoxHandle {
  update(t: number, dt: number, frame: FoxFrame): void;
  /** the mesh that casts the cub's shadow */
  bodyMesh(): Mesh;
  /** head-top world position (bubble anchor) */
  headPos(): Vector3;
  /** The well's promise, worn: a scarf in the given hex (or none). */
  setScarf(colorHex: string | null): void;
  dispose(): void;
}

export function buildFox(scene: Scene): FoxHandle {
  const root = new TransformNode('fox-root', scene);
  /* stage 14: a bigger cub — the continent is huge, the hero must
     read against it (and her scarf must be worth the walk) */
  root.scaling.setAll(1.18);
  const bodyRoot = new TransformNode('fox-body-root', scene);
  bodyRoot.parent = root;

  const coat = new StandardMaterial('fox-coat', scene);
  coat.diffuseColor = hex(FOX_COLORS.coat);
  coat.specularColor = new Color3(0.05, 0.04, 0.03);
  const coatDark = new StandardMaterial('fox-coat-dark', scene);
  coatDark.diffuseColor = hex(FOX_COLORS.coatDark);
  coatDark.specularColor = new Color3(0.04, 0.03, 0.03);
  const cream = new StandardMaterial('fox-cream', scene);
  cream.diffuseColor = hex(FOX_COLORS.cream);
  cream.specularColor = new Color3(0.04, 0.04, 0.04);
  const dark = new StandardMaterial('fox-dark', scene);
  dark.diffuseColor = hex(FOX_COLORS.dark);
  dark.specularColor = new Color3(0.02, 0.02, 0.02);
  const blush = new StandardMaterial('fox-blush', scene);
  blush.diffuseColor = hex(FOX_COLORS.blush);
  blush.emissiveColor = hex(FOX_COLORS.blush).scale(0.12);
  blush.specularColor = new Color3(0.03, 0.02, 0.02);

  /* ---------- the body (the shadow caster) ---------- */
  const body = MeshBuilder.CreateSphere('fox-body', { diameter: 0.5, segments: 9 }, scene);
  body.scaling.set(1.0, 0.86, 1.28);
  body.position.set(0, 0.33, -0.02);
  body.material = coat;
  body.parent = bodyRoot;

  const belly = MeshBuilder.CreateSphere('fox-belly', { diameter: 0.38, segments: 8 }, scene);
  belly.scaling.set(0.9, 0.62, 1.1);
  belly.position.set(0, 0.27, 0.06);
  belly.material = cream;
  belly.parent = bodyRoot;

  /* ---------- the head ---------- */
  const head = new TransformNode('fox-head', scene);
  head.parent = bodyRoot;
  head.position.set(0, 0.5, 0.24);

  const skull = MeshBuilder.CreateSphere('fox-skull', { diameter: 0.4, segments: 9 }, scene);
  skull.scaling.set(1, 0.94, 1.02);
  skull.material = coat;
  skull.parent = head;

  const snout = MeshBuilder.CreateSphere('fox-snout', { diameter: 0.2, segments: 8 }, scene);
  snout.scaling.set(1, 0.8, 1.15);
  snout.position.set(0, -0.06, 0.2);
  snout.material = cream;
  snout.parent = head;

  const nose = MeshBuilder.CreateSphere('fox-nose', { diameter: 0.07, segments: 6 }, scene);
  nose.position.set(0, -0.04, 0.32);
  nose.material = dark;
  nose.parent = head;

  const eyeL = MeshBuilder.CreateSphere('fox-eye-l', { diameter: 0.085, segments: 7 }, scene);
  eyeL.position.set(-0.1, 0.05, 0.17);
  eyeL.material = dark;
  eyeL.parent = head;
  const eyeR = eyeL.clone('fox-eye-r');
  eyeR.position.x = 0.1;
  eyeR.parent = head;

  const cheekL = MeshBuilder.CreateDisc('fox-cheek-l', { radius: 0.045, tessellation: 10 }, scene);
  cheekL.rotation.x = -0.5;
  cheekL.position.set(-0.14, -0.02, 0.16);
  cheekL.material = blush;
  cheekL.parent = head;
  const cheekR = cheekL.clone('fox-cheek-r');
  cheekR.position.x = 0.14;
  cheekR.parent = head;

  /* ears: soft cones with cream insides, parented so they flop */
  const earL = MeshBuilder.CreateCylinder('fox-ear-l', { diameterTop: 0.02, diameterBottom: 0.13, height: 0.24, tessellation: 7 }, scene);
  earL.position.set(-0.12, 0.24, -0.02);
  earL.rotation.z = 0.22;
  earL.material = coat;
  earL.parent = head;
  const earR = earL.clone('fox-ear-r');
  earR.position.x = 0.12;
  earR.rotation.z = -0.22;
  earR.parent = head;
  const earTipL = MeshBuilder.CreateSphere('fox-eartip-l', { diameter: 0.09, segments: 6 }, scene);
  earTipL.position.set(-0.12, 0.24, -0.02);
  earTipL.scaling.set(1, 0.7, 1);
  earTipL.material = coatDark;
  earTipL.parent = head;
  const earTipR = earTipL.clone('fox-eartip-r');
  earTipR.position.x = 0.12;
  earTipR.parent = head;

  /* ---------- the tail (wags) ---------- */
  const tail = new TransformNode('fox-tail', scene);
  tail.parent = bodyRoot;
  tail.position.set(0, 0.36, -0.3);
  const tailMesh = MeshBuilder.CreateSphere('fox-tail-mesh', { diameter: 0.22, segments: 8 }, scene);
  tailMesh.scaling.set(0.8, 0.8, 1.7);
  tailMesh.position.set(0, 0.02, -0.16);
  tailMesh.material = coat;
  tailMesh.parent = tail;
  const tailTip = MeshBuilder.CreateSphere('fox-tail-tip', { diameter: 0.15, segments: 7 }, scene);
  tailTip.position.set(0, 0.04, -0.36);
  tailTip.material = cream;
  tailTip.parent = tail;

  /* ---------- the legs (swing) — with dark boots that read the gait ---------- */
  const legs: Mesh[] = [];
  const legPos: Array<[number, number]> = [
    [-0.13, 0.12], [0.13, 0.12], /* front pair */
    [-0.13, -0.16], [0.13, -0.16], /* back pair */
  ];
  for (let i = 0; i < 4; i++) {
    const leg = MeshBuilder.CreateCylinder(`fox-leg-${i}`, { diameter: 0.09, height: 0.26, tessellation: 7 }, scene);
    leg.position.set(legPos[i][0], 0.13, legPos[i][1]);
    leg.material = i < 2 ? coat : coatDark;
    leg.parent = bodyRoot;
    legs.push(leg);
    const foot = MeshBuilder.CreateSphere(`fox-foot-${i}`, { diameterX: 0.11, diameterY: 0.09, diameterZ: 0.14, segments: 6 }, scene);
    foot.position.set(0, -0.13, 0.02);
    foot.material = dark;
    foot.parent = leg;
  }

  /* ---------- the scarf (the well's promise, stage 14) ----------
     A soft ring around the neck + a little tail that flies when
     the cub runs. The color is wardrobe-owned; null hides it. */
  const scarfMat = new StandardMaterial('fox-scarf-mat', scene);
  scarfMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const scarf = MeshBuilder.CreateTorus('fox-scarf', { diameter: 0.34, thickness: 0.085, tessellation: 16 }, scene);
  scarf.scaling.set(1, 0.62, 1);
  scarf.position.set(0, 0.46, 0.12);
  scarf.material = scarfMat;
  scarf.parent = bodyRoot;
  const scarfTail = MeshBuilder.CreateBox('fox-scarf-tail', { width: 0.1, height: 0.26, depth: 0.045 }, scene);
  scarfTail.position.set(0.05, 0.26, -0.06);
  scarfTail.rotation.x = 0.5;
  scarfTail.material = scarfMat;
  scarfTail.parent = bodyRoot;
  scarf.setEnabled(false);
  scarfTail.setEnabled(false);

  /* ---------- animation state (module-level, zero allocs) ---------- */
  let walkPhase = 0;
  let curFacing = 0;
  let landSquash = 0;
  let nextBlink = 2.2;
  let blinkLeft = 0;
  let nextEarFlick = 5.5;
  let earFlickLeft = 0;

  const disposeList: Array<{ dispose(): void }> = [coat, coatDark, cream, dark, blush, scarfMat];

  return {
    update(t, dt, frame) {
      root.position.set(frame.pos.x, frame.groundY + frame.jumpY, frame.pos.z);

      /* face the direction of travel (shortest arc, eased) */
      curFacing = facingToward(curFacing, frame.facing, dt * 9);
      root.rotation.y = curFacing;

      /* the walk cycle: legs swing, body bounces, tail wags harder */
      const moving = frame.speed > 0.12;
      if (moving) {
        walkPhase += dt * (5.4 + Math.min(6, frame.speed * 1.6));
      }
      const swing = moving ? Math.sin(walkPhase) * 0.62 : 0;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      legs[2].rotation.x = -swing;
      legs[3].rotation.x = swing;

      /* the scarf tail flies with the run (the walk pays for the wear) */
      if (scarf.isEnabled()) {
        scarfTail.rotation.x = 0.5 + (moving ? Math.sin(walkPhase * 1.05) * 0.35 : Math.sin(t * 1.4) * 0.08);
      }

      const airborne = frame.jumpY > 0.02;
      if (airborne) {
        /* legs tuck under, ears lift — a small jump, read from far */
        legs[0].rotation.x = -0.7;
        legs[1].rotation.x = -0.7;
        legs[2].rotation.x = 0.55;
        legs[3].rotation.x = 0.55;
        earL.rotation.x = -0.4;
        earR.rotation.x = -0.4;
        tail.rotation.x = 0.35;
        bodyRoot.position.y = 0;
        bodyRoot.rotation.x = 0.08;
      } else {
        earL.rotation.x = Math.sin(walkPhase * 0.5) * 0.06;
        earR.rotation.x = -Math.sin(walkPhase * 0.5) * 0.06;
        tail.rotation.x = 0;
        bodyRoot.rotation.x = moving ? Math.sin(walkPhase * 2) * 0.02 : 0;
        /* the bounce of the step + the landing squash */
        if (frame.landed) landSquash = 1;
        landSquash = Math.max(0, landSquash - dt * 4.5);
        const squash = landSquash * 0.24;
        const bounce = moving ? Math.abs(Math.sin(walkPhase)) * 0.035 : Math.sin(t * 2.1) * 0.012;
        bodyRoot.position.y = bounce - squash * 0.14;
        bodyRoot.scaling.y = 1 - squash;
        bodyRoot.scaling.x = 1 + squash * 0.5;
        bodyRoot.scaling.z = 1 + squash * 0.5;
      }

      /* the tail wags: quick when moving, lazy sweeps when idle */
      const wagSpeed = moving ? 9 : 1.7;
      tail.rotation.y = Math.sin(t * wagSpeed) * (moving ? 0.5 : 0.28);

      /* blinking: every few seconds, a soft double-lid */
      if (blinkLeft > 0) {
        blinkLeft -= dt;
        const k = blinkLeft > 0.06 ? 0.12 : 1;
        eyeL.scaling.y = k;
        eyeR.scaling.y = k;
      } else {
        eyeL.scaling.y = 1;
        eyeR.scaling.y = 1;
        if (t > nextBlink) {
          blinkLeft = 0.12;
          nextBlink = t + 2.2 + (Math.abs(Math.sin(t * 12.9898)) * 2.6);
        }
      }

      /* an ear-flick now and then — a cub is alive even when still */
      if (earFlickLeft > 0) {
        earFlickLeft -= dt;
        const k = Math.sin(earFlickLeft * 26) * 0.3 * earFlickLeft;
        earL.rotation.z = 0.22 + k;
        earR.rotation.z = -0.22 + k * 0.4;
      } else {
        earL.rotation.z = 0.22;
        earR.rotation.z = -0.22;
        if (t > nextEarFlick) {
          earFlickLeft = 0.42;
          nextEarFlick = t + 4.5 + Math.abs(Math.sin(t * 7.31)) * 5;
        }
      }
    },
    bodyMesh: () => body,
    setScarf(colorHex: string | null): void {
      if (!colorHex) {
        scarf.setEnabled(false);
        scarfTail.setEnabled(false);
        return;
      }
      scarfMat.emissiveColor = Color3.FromHexString(colorHex).scale(0.35);
      scarfMat.diffuseColor = Color3.FromHexString(colorHex);
      scarf.setEnabled(true);
      scarfTail.setEnabled(true);
    },
    headPos: () => {
      /* head world position without allocations in the hot path —
         this is called at bubble cadence (per second), not per frame */
      const m = skull.getWorldMatrix();
      return Vector3.TransformCoordinates(new Vector3(0, 0.1, 0.1), m);
    },
    dispose() {
      root.dispose(false, true);
      for (const d of disposeList) d.dispose();
    },
  };
}
