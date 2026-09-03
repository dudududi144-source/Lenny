/* ============================================================
 * WorldQuestProps — the touchable bits of discovery quests.
 * (critic round B, W2)
 *
 *   counting  → flowers bloom in a ring around the child; the child
 *               taps each one (one-to-one correspondence), then says
 *               HOW MANY among chips (cardinality).
 *   pattern   → a row of colored stones with one pulsing gap; the
 *               child continues the sequence (seriation).
 *
 * Performance discipline (critic W6): a FIXED pre-built pool
 * (8 flowers × 2 meshes, 9 stones + 1 gap ring) reused across
 * quests — nothing is created or destroyed during play, zero
 * per-frame allocations, 5 shared materials, symmetric dispose.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { PatternColor } from './worldQuests';

export const MAX_FLOWERS = 8;
export const MAX_STONES = 9;

export type QuestPropsSpec =
  | {
      kind: 'counting';
      anchor: { x: number; z: number };
      count: number;
      /** direction toward the camera — flowers bloom in FRONT, never behind */
      facing?: { x: number; z: number };
      /** height of the surface under the anchor (platform top vs grass) */
      surfaceY?: number;
    }
  | {
      kind: 'pattern';
      anchor: { x: number; z: number };
      stones: Array<PatternColor | null>;
      surfaceY?: number;
    };

export interface QuestPropSpot {
  id: string;
  x: number; /* canvas fractions 0..1 */
  y: number;
  on: boolean;
}

interface Shrinker {
  mesh: Mesh;
  start: number;
}

const hex = (s: string): Color3 => Color3.FromHexString(s);

export function buildQuestProps(scene: Scene): {
  show(spec: QuestPropsSpec | null): void;
  pickFlower(index: number): void;
  fillGap(color: PatternColor): void;
  update(t: number, now: number): void;
  spots(project: (p: Vector3) => { x: number; y: number; on: boolean }): QuestPropSpot[];
  dispose(): void;
} {
  const root = new TransformNode('quest-props-root', scene);

  /* ---------- shared materials (5, made once) ---------- */

  const stemMat = new StandardMaterial('qp-stem', scene);
  stemMat.diffuseColor = hex('#4e9e4e');
  stemMat.specularColor = new Color3(0.02, 0.03, 0.02);

  const petalMats: Record<PatternColor, StandardMaterial> = {
    gold: new StandardMaterial('qp-gold', scene),
    rose: new StandardMaterial('qp-rose', scene),
    teal: new StandardMaterial('qp-teal', scene),
  };
  petalMats.gold.diffuseColor = hex('#e8b93c');
  petalMats.gold.emissiveColor = hex('#ffd76a').scale(0.4);
  petalMats.rose.diffuseColor = hex('#e05a96');
  petalMats.rose.emissiveColor = hex('#f2549a').scale(0.4);
  petalMats.teal.diffuseColor = hex('#3fc3ad');
  petalMats.teal.emissiveColor = hex('#52e0c4').scale(0.4);
  for (const k of Object.keys(petalMats) as PatternColor[]) {
    petalMats[k].specularColor = new Color3(0.04, 0.04, 0.03);
  }

  const stoneMats: Record<PatternColor, StandardMaterial> = {
    gold: new StandardMaterial('qp-stone-gold', scene),
    rose: new StandardMaterial('qp-stone-rose', scene),
    teal: new StandardMaterial('qp-stone-teal', scene),
  };
  stoneMats.gold.diffuseColor = hex('#caa53d');
  stoneMats.rose.diffuseColor = hex('#d9568f');
  stoneMats.teal.diffuseColor = hex('#38ab97');
  for (const k of Object.keys(stoneMats) as PatternColor[]) {
    stoneMats[k].specularColor = new Color3(0.05, 0.05, 0.05);
  }

  const gapMat = new StandardMaterial('qp-gap', scene);
  gapMat.diffuseColor = hex('#7c7f78');
  gapMat.emissiveColor = hex('#fff3b0').scale(0.2);
  gapMat.alpha = 0.65;
  gapMat.specularColor = new Color3(0.03, 0.03, 0.03);

  const allMats = [stemMat, ...Object.values(petalMats), ...Object.values(stoneMats), gapMat];

  /* ---------- the fixed pool ---------- */

  const flowerStems: Mesh[] = [];
  const flowerHeads: Mesh[] = [];
  for (let i = 0; i < MAX_FLOWERS; i++) {
    const stem = MeshBuilder.CreateCylinder(`quest-flower-${i}s`, { diameter: 0.07, height: 0.4, tessellation: 6 }, scene);
    stem.material = stemMat;
    stem.parent = root;
    stem.isPickable = true;
    stem.setEnabled(false);
    flowerStems.push(stem);

    const head = MeshBuilder.CreateSphere(`quest-flower-${i}`, { diameter: 0.3, segments: 6 }, scene);
    head.parent = root;
    head.isPickable = true;
    head.setEnabled(false);
    flowerHeads.push(head);
  }

  const stones: Mesh[] = [];
  for (let i = 0; i < MAX_STONES; i++) {
    const s = MeshBuilder.CreateCylinder(`quest-stone-${i}`, { diameter: 0.46, height: 0.13, tessellation: 9 }, scene);
    s.parent = root;
    s.isPickable = true;
    s.setEnabled(false);
    stones.push(s);
  }

  const gapRing = MeshBuilder.CreateTorus('quest-gap', { diameter: 0.56, thickness: 0.07, tessellation: 18 }, scene);
  gapRing.scaling.y = 0.25;
  gapRing.material = gapMat;
  gapRing.parent = root;
  gapRing.isPickable = true;
  gapRing.setEnabled(false);

  /* ---------- state ---------- */

  const shrinkers: Shrinker[] = [];
  const PETALS: PatternColor[] = ['rose', 'gold', 'teal'];
  let gapIndex = -1;
  let gapFilled = false;
  let currentKind: 'counting' | 'pattern' | null = null;

  function hideAll(): void {
    for (let i = 0; i < MAX_FLOWERS; i++) {
      flowerStems[i].setEnabled(false);
      flowerHeads[i].setEnabled(false);
      flowerHeads[i].scaling.setAll(1);
      flowerStems[i].scaling.setAll(1);
    }
    for (let i = 0; i < MAX_STONES; i++) stones[i].setEnabled(false);
    gapRing.setEnabled(false);
    shrinkers.length = 0;
    currentKind = null;
    gapIndex = -1;
    gapFilled = false;
  }

  const petalFor = (i: number): PatternColor => PETALS[i % PETALS.length];

  function show(spec: QuestPropsSpec | null): void {
    hideAll();
    if (!spec) return;

    if (spec.kind === 'counting') {
      const count = Math.max(1, Math.min(MAX_FLOWERS, Math.floor(spec.count)));
      const sy = spec.surfaceY ?? 0;
      currentKind = 'counting';
      /* a gentle arc IN FRONT of the child (the direction the camera
         looks from) — nothing blooms behind the character, nothing
         hides behind another flower */
      const fwd = spec.facing ?? { x: 0, z: 1 };
      const px = -fwd.z;
      const pz = fwd.x;
      const baseX = spec.anchor.x + fwd.x * 0.95;
      const baseZ = spec.anchor.z + fwd.z * 0.95;
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 0.52;
        const depth = i % 2 === 0 ? 0 : 0.3; /* a soft V so heads never touch */
        const fx = baseX + px * off + fwd.x * depth;
        const fz = baseZ + pz * off + fwd.z * depth;
        flowerStems[i].position.set(fx, sy + 0.2, fz);
        flowerHeads[i].position.set(fx, sy + 0.46, fz);
        flowerHeads[i].material = petalMats[petalFor(i)];
        flowerStems[i].setEnabled(true);
        flowerHeads[i].setEnabled(true);
      }
      return;
    }

    /* pattern row: perpendicular to the direction toward world center,
       so the row reads naturally "in front" of wherever the child stands */
    currentKind = 'pattern';
    const sy = spec.surfaceY ?? 0;
    const n = spec.stones.length;
    const toCenter = Math.atan2(-spec.anchor.z, -spec.anchor.x);
    const px = -Math.sin(toCenter);
    const pz = Math.cos(toCenter);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.62;
      const sx = spec.anchor.x + px * off;
      const sz = spec.anchor.z + pz * off;
      const color = spec.stones[i];
      if (color === null) {
        gapIndex = i;
        gapRing.position.set(sx, sy + 0.1, sz);
        gapRing.setEnabled(true);
        gapFilled = false;
      } else {
        stones[i].position.set(sx, sy + 0.07, sz);
        stones[i].material = stoneMats[color];
        stones[i].setEnabled(true);
      }
    }
  }

  return {
    show,

    pickFlower(index: number): void {
      if (currentKind !== 'counting') return;
      if (index < 0 || index >= MAX_FLOWERS) return;
      const head = flowerHeads[index];
      if (!head.isEnabled()) return;
      shrinkers.push({ mesh: head, start: performance.now() });
    },

    fillGap(color: PatternColor): void {
      if (currentKind !== 'pattern' || gapIndex < 0 || gapFilled) return;
      gapFilled = true;
      const s = stones[gapIndex];
      s.position.copyFrom(gapRing.position);
      s.material = stoneMats[color];
      s.setEnabled(true);
      gapRing.setEnabled(false);
      shrinkers.push({ mesh: s, start: performance.now() }); /* springy pop-in */
    },

    update(_t: number, now: number): void {
      /* the gap ring pulses — one material write, zero allocations */
      if (gapRing.isEnabled() && !gapFilled) {
        gapMat.alpha = 0.45 + Math.sin(now / 1000 * 3.2) * 0.25;
      }
      for (let i = shrinkers.length - 1; i >= 0; i--) {
        const s = shrinkers[i];
        const k = Math.min(1, (now - s.start) / 320);
        if (s.mesh.name.startsWith('quest-flower-')) {
          /* flowers fold gently into the grass */
          s.mesh.scaling.setAll(Math.max(0.08, 1 - k * 0.92));
        } else {
          /* the filled stone springs in (back-ease, lands exactly at 1) */
          const back = 1 + 2.0 * Math.pow(k - 1, 3) + 1.1 * Math.pow(k - 1, 2);
          s.mesh.scaling.setAll(Math.max(0.1, back));
        }
        if (k >= 1) shrinkers.splice(i, 1);
      }
    },

    spots(project): QuestPropSpot[] {
      const out: QuestPropSpot[] = [];
      if (currentKind === 'counting') {
        for (let i = 0; i < MAX_FLOWERS; i++) {
          if (!flowerHeads[i].isEnabled()) continue;
          const h = flowerHeads[i];
          const p = project(new Vector3(h.position.x, h.position.y, h.position.z));
          out.push({ id: `quest-flower-${i}`, x: p.x, y: p.y, on: p.on });
        }
      } else if (currentKind === 'pattern') {
        for (let i = 0; i < MAX_STONES; i++) {
          if (!stones[i].isEnabled()) continue;
          const s = stones[i];
          const p = project(new Vector3(s.position.x, s.position.y, s.position.z));
          out.push({ id: `quest-stone-${i}`, x: p.x, y: p.y, on: p.on });
        }
        if (gapRing.isEnabled()) {
          const p = project(new Vector3(gapRing.position.x, gapRing.position.y, gapRing.position.z));
          out.push({ id: 'quest-gap', x: p.x, y: p.y, on: p.on });
        }
      }
      return out;
    },

    dispose(): void {
      for (const m of flowerStems) m.dispose();
      for (const m of flowerHeads) m.dispose();
      for (const m of stones) m.dispose();
      gapRing.dispose();
      root.dispose(false, true);
      for (const m of allMats) m.dispose();
    },
  };
}
