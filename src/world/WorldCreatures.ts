/* ============================================================
 * WorldCreatures — the garden's ambient life (Stage 7, commit 4).
 *
 * Zero forced interaction (ETHICS): butterflies drift on bezier
 * paths in the day, fireflies wander at night, little fish circle
 * the breath-pool forever. Nothing here is ever required, nothing
 * here is ever gated — the world simply is alive.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { DayPhase } from '../content/dayCycle';
import { islandCenter } from './WorldLayout';

/* ---------- pure path math (unit-tested) ---------- */

export interface BezierPoint {
  x: number;
  y: number;
  z: number;
}

export function cubicBezier(p0: BezierPoint, p1: BezierPoint, p2: BezierPoint, p3: BezierPoint, t: number): BezierPoint {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    z: a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  };
}

/* ---------- creature builders ---------- */

const BUTTERFLY_TINTS = ['#ffd76a', '#7dffb8', '#f2549a'];
const BUTTERFLY_COUNT = 3;
const FIREFLY_COUNT = 12;
const FISH_COUNT = 3;

function emissiveMat(scene: Scene, name: string, hex: string, strength: number): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = Color3.FromHexString(hex).scale(strength);
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  return m;
}

export interface CreatureCounts {
  butterflies: number;
  fireflies: number;
  fish: number;
}

export interface CreaturesHandle {
  setPhase(phase: DayPhase): void;
  update(t: number, dt: number): void;
  counts(): CreatureCounts;
  dispose(): void;
}

export function buildCreatures(scene: Scene): CreaturesHandle {
  const root = new TransformNode('creatures-root', scene);

  /* ---------- butterflies (day) ---------- */
  interface Butterfly {
    node: TransformNode;
    wingL: Mesh;
    wingR: Mesh;
    p0: BezierPoint;
    p1: BezierPoint;
    p2: BezierPoint;
    p3: BezierPoint;
    speed: number;
    offset: number;
  }
  const butterflies: Butterfly[] = [];
  const wingMat: StandardMaterial[] = [];
  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const mat = emissiveMat(scene, `bf-mat-${i}`, BUTTERFLY_TINTS[i % BUTTERFLY_TINTS.length], 0.55);
    mat.alpha = 0.95;
    mat.backFaceCulling = false;
    wingMat.push(mat);

    const node = new TransformNode(`butterfly-${i}`, scene);
    node.parent = root;
    const wingL = MeshBuilder.CreatePlane(`bf-l-${i}`, { width: 0.22, height: 0.16 }, scene);
    wingL.material = mat;
    wingL.parent = node;
    wingL.position.x = -0.1;
    const wingR = MeshBuilder.CreatePlane(`bf-r-${i}`, { width: 0.22, height: 0.16 }, scene);
    wingR.material = mat;
    wingR.parent = node;
    wingR.position.x = 0.1;

    /* one wandering loop per butterfly (deterministic, spread wide) */
    const seed = i * 2.51;
    const p0: BezierPoint = { x: Math.cos(seed) * 8, y: 1.7, z: Math.sin(seed) * 8 };
    const p1: BezierPoint = { x: Math.cos(seed + 1.8) * 11, y: 2.6, z: Math.sin(seed + 1.8) * 11 };
    const p2: BezierPoint = { x: Math.cos(seed + 3.6) * 6, y: 1.3, z: Math.sin(seed + 3.6) * 6 };
    const p3: BezierPoint = { x: Math.cos(seed + 5.4) * 9, y: 2.2, z: Math.sin(seed + 5.4) * 9 };
    butterflies.push({ node, wingL, wingR, p0, p1, p2, p3, speed: 0.028 + i * 0.006, offset: i * 0.37 });
  }

  /* ---------- fireflies (night) ---------- */
  const fireflyMat = emissiveMat(scene, 'ff-mat', '#ffe9a6', 1.4);
  const fireflies: Mesh[] = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const f = MeshBuilder.CreateSphere(`firefly-${i}`, { diameter: 0.09, segments: 4 }, scene);
    f.material = fireflyMat;
    f.parent = root;
    f.setEnabled(false);
    fireflies.push(f);
  }

  /* ---------- fish (always — the breath-pool lives) ---------- */
  const poolCenter = islandCenter('breath-pool');
  const fishMat = emissiveMat(scene, 'fish-mat', '#ffb066', 0.5);
  const fish: Mesh[] = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    const f = MeshBuilder.CreateCylinder(`fish-${i}`, { diameterTop: 0.01, diameterBottom: 0.09, height: 0.26, tessellation: 5 }, scene);
    f.material = fishMat;
    f.rotation.x = Math.PI / 2;
    f.parent = root;
    fish.push(f);
  }

  let phase: DayPhase = 'midday';

  return {
    setPhase(p: DayPhase): void {
      phase = p;
      const dayButterflies = p === 'morning' || p === 'midday';
      for (let i = 0; i < butterflies.length; i++) {
        butterflies[i].node.setEnabled(dayButterflies);
      }
      const nightFireflies = p === 'night';
      for (const f of fireflies) f.setEnabled(nightFireflies);
    },
    update(t: number, dt: number): void {
      void dt;
      /* butterflies: bezier loops + wing flap + gentle facing */
      for (let i = 0; i < butterflies.length; i++) {
        const b = butterflies[i];
        if (!b.node.isEnabled()) continue;
        const u = (t * b.speed + b.offset) % 1;
        const p = cubicBezier(b.p0, b.p1, b.p2, b.p3, u);
        const q = cubicBezier(b.p0, b.p1, b.p2, b.p3, (u + 0.004) % 1);
        b.node.position.set(p.x, p.y + Math.sin(t * 2 + i) * 0.1, p.z);
        b.node.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
        const flap = Math.sin(t * 14 + i * 2) * 0.9;
        b.wingL.rotation.y = 0.5 + flap;
        b.wingR.rotation.y = -0.5 - flap;
      }
      /* fireflies: soft wandering + blink */
      if (phase === 'night') {
        for (let i = 0; i < fireflies.length; i++) {
          const f = fireflies[i];
          const a = t * (0.22 + (i % 4) * 0.05) + i * 1.7;
          const r = 3 + (i % 5) * 1.9;
          f.position.set(Math.cos(a) * r, 0.7 + Math.sin(t * 0.9 + i * 2.3) * 0.55, Math.sin(a * 0.83 + i) * r);
          f.scaling.setAll(0.7 + Math.abs(Math.sin(t * 2.4 + i * 1.3)) * 0.7);
        }
      }
      /* fish: lazy circles in the breath-pool */
      for (let i = 0; i < fish.length; i++) {
        const a = t * (0.5 + i * 0.13) + i * 2.1;
        const r = 0.42 + i * 0.12;
        const x = poolCenter.x + Math.cos(a) * r;
        const z = poolCenter.z + Math.sin(a) * r;
        fish[i].position.set(x, 0.3 + Math.sin(t * 1.4 + i) * 0.03, z);
        fish[i].rotation.y = -a;
      }
    },
    counts: () => ({
      butterflies: BUTTERFLY_COUNT,
      fireflies: FIREFLY_COUNT,
      fish: FISH_COUNT,
    }),
    dispose(): void {
      root.dispose(false, true);
      for (const m of wingMat) m.dispose();
      fireflyMat.dispose();
      fishMat.dispose();
    },
  };
}
