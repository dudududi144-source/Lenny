/* ============================================================
 * WorldCreatures — the garden's ambient life (Stage 7, commit 4;
 * stage 15-D adds the birds + the atmosphere gate).
 *
 * Zero forced interaction (ETHICS): butterflies drift on bezier
 * paths in the day, fireflies wander at night, little fish circle
 * the breath-pool forever. Nothing here is ever required, nothing
 * here is ever gated — the world simply is alive.
 *
 * Stage 15-D (the quality tiers):
 *   - `weak` keeps EXACTLY the stage-14 creature set (no birds,
 *     fireflies only at night) — the CI floor's proven world.
 *   - `standard`/`rich` earn the extras via setAtmosphere(true):
 *     fireflies also drift through the evening, and OCCASIONAL BIRDS
 *     glide across the sky (3 pooled gliders, deterministic spawns,
 *     culled past 90u from the walker, zero per-frame allocations).
 *
 * NAMING CONTRACT (do not "simplify"): every MESH whose transform is
 * written per frame carries a name prefix that WorldApp's
 * ANIMATED_PREFIXES list matches (creature-/butterfly/bird-), so the
 * static-matrix freeze pass never freezes a living thing. The old
 * bf-l-/fish-/firefly- names slipped past that list and the freeze
 * pass literally petrified their world matrices.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { DayPhase } from '../content/dayCycle';
import { islandCenter } from './WorldLayout';
import { mulberry32 } from './worldAcorns';

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
const BIRD_COUNT = 3;
/** birds farther than this from the walker get parked (distance cull) */
const BIRD_CULL_DIST = 90;
/** next spawn lands somewhere in this band of seconds after the last */
const BIRD_SPAWN_MIN_S = 9;
const BIRD_SPAWN_MAX_S = 19;

/** One painted wing-pair texture (a lazy gull silhouette) — shared. */
function birdTexture(scene: Scene): DynamicTexture {
  const s = 64;
  const tex = new DynamicTexture('creature-bird-tex', { width: s, height: s }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = '#4a3f38';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  /* two swept wings meeting at a small body */
  ctx.beginPath();
  ctx.moveTo(4, 40);
  ctx.quadraticCurveTo(20, 18, 32, 34);
  ctx.quadraticCurveTo(44, 18, 60, 40);
  ctx.stroke();
  ctx.fillStyle = '#4a3f38';
  ctx.beginPath();
  ctx.ellipse(32, 36, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

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
  /** standard+ decorations: evening fireflies + the sky's birds. Weak = today. */
  setAtmosphere(on: boolean): void;
  /** walker x/z feed the birds' distance cull (defaults keep old callers honest) */
  update(t: number, dt: number, px?: number, pz?: number): void;
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
    const wingL = MeshBuilder.CreatePlane(`butterfly-wing-l-${i}`, { width: 0.22, height: 0.16 }, scene);
    wingL.material = mat;
    wingL.parent = node;
    wingL.position.x = -0.1;
    const wingR = MeshBuilder.CreatePlane(`butterfly-wing-r-${i}`, { width: 0.22, height: 0.16 }, scene);
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

  /* ---------- fireflies (night — evening too on standard+) ---------- */
  const fireflyMat = emissiveMat(scene, 'ff-mat', '#ffe9a6', 1.4);
  const fireflies: Mesh[] = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const f = MeshBuilder.CreateSphere(`creature-firefly-${i}`, { diameter: 0.09, segments: 4 }, scene);
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
    const f = MeshBuilder.CreateCylinder(`creature-fish-${i}`, { diameterTop: 0.01, diameterBottom: 0.09, height: 0.26, tessellation: 5 }, scene);
    f.material = fishMat;
    f.rotation.x = Math.PI / 2;
    f.parent = root;
    fish.push(f);
  }

  /* ---------- birds (standard+; pooled gliders, zero allocs) ----------
     Each bird owns its state; spawns land around the WALKER (who is
     near the origin of the day), fly a straight glide, and park. */
  const birdTex = birdTexture(scene);
  const birdMat = new StandardMaterial('creature-bird-mat', scene);
  birdMat.diffuseTexture = birdTex;
  birdMat.opacityTexture = birdTex;
  birdMat.opacityTexture.getAlphaFromRGB = false;
  birdMat.emissiveColor = new Color3(0.08, 0.07, 0.06);
  birdMat.specularColor = Color3.Black();
  birdMat.backFaceCulling = false;
  birdMat.disableLighting = true;
  birdMat.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
  birdMat.alphaCutOff = 0.4;

  interface Bird {
    mesh: Mesh;
    active: boolean;
    bornAt: number;
    durS: number;
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    y: number;
    flap: number;
  }
  const birds: Bird[] = [];
  const birdRng = mulberry32(0xb1d5);
  let nextBirdSpawn = 6;
  for (let i = 0; i < BIRD_COUNT; i++) {
    const b = MeshBuilder.CreatePlane(`bird-${i}`, { width: 1.15, height: 0.55 }, scene);
    b.material = birdMat;
    b.parent = root;
    b.isPickable = false;
    b.setEnabled(false);
    b.position.y = -999;
    birds.push({ mesh: b, active: false, bornAt: 0, durS: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, y: 14, flap: 0 });
  }

  let phase: DayPhase = 'midday';
  let atmosphere = false;

  /** fireflies show at night — and through the evening once the
      device has earned the atmosphere (weak keeps night only) */
  const applyFireflyVisibility = (): void => {
    const show = phase === 'night' || (atmosphere && phase === 'evening');
    for (const f of fireflies) f.setEnabled(show);
  };

  return {
    setPhase(p: DayPhase): void {
      phase = p;
      const dayButterflies = p === 'morning' || p === 'midday';
      for (let i = 0; i < butterflies.length; i++) {
        butterflies[i].node.setEnabled(dayButterflies);
      }
      applyFireflyVisibility();
    },
    setAtmosphere(on: boolean): void {
      atmosphere = on;
      if (!on) {
        /* weak tier: park the birds, keep the sky exactly as it was */
        for (const b of birds) {
          b.active = false;
          b.mesh.setEnabled(false);
          b.mesh.position.y = -999;
        }
      }
      applyFireflyVisibility();
    },
    update(t: number, dt: number, px = 0, pz = 0): void {
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
      /* fireflies: soft wandering + blink (evening joins on standard+) */
      if (phase === 'night' || (atmosphere && phase === 'evening')) {
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

      /* birds: occasionally one crosses the sky (standard+ only).
         Spawns are deterministic, cheap, and culled — the sky stays
         alive without ever costing the floor. */
      const birdPhaseOk = atmosphere && (phase === 'morning' || phase === 'midday' || phase === 'evening');
      if (birdPhaseOk && t >= nextBirdSpawn) {
        const slot = birds.find((b) => !b.active);
        if (slot) {
          const a = birdRng() * Math.PI * 2;
          const across = 26 + birdRng() * 16;
          slot.fromX = Math.cos(a) * across;
          slot.fromZ = Math.sin(a) * across;
          slot.toX = -slot.fromX + (birdRng() - 0.5) * 24;
          slot.toZ = -slot.fromZ + (birdRng() - 0.5) * 24;
          slot.y = 11 + birdRng() * 7;
          slot.durS = 7 + birdRng() * 5;
          slot.bornAt = t;
          slot.flap = birdRng() * Math.PI * 2;
          slot.active = true;
          slot.mesh.setEnabled(true);
        }
        nextBirdSpawn = t + BIRD_SPAWN_MIN_S + birdRng() * (BIRD_SPAWN_MAX_S - BIRD_SPAWN_MIN_S);
      }
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        if (!b.active) continue;
        const k = (t - b.bornAt) / b.durS;
        if (k >= 1) {
          b.active = false;
          b.mesh.setEnabled(false);
          b.mesh.position.y = -999;
          continue;
        }
        const e = k * k * (3 - 2 * k); /* smoothstep — lazy banking */
        const x = b.fromX + (b.toX - b.fromX) * e;
        const z = b.fromZ + (b.toZ - b.fromZ) * e;
        b.mesh.position.set(x, b.y + Math.sin(t * 0.9 + i * 2.1) * 0.8, z);
        b.mesh.rotation.y = Math.atan2(b.toX - b.fromX, b.toZ - b.fromZ);
        /* the flap reads from far below as a gentle rock */
        b.mesh.rotation.z = Math.sin(t * 7 + b.flap) * 0.32;
        /* distance cull: the walker moved on, the bird parks */
        if (Math.hypot(x - px, z - pz) > BIRD_CULL_DIST) {
          b.active = false;
          b.mesh.setEnabled(false);
          b.mesh.position.y = -999;
        }
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
      birdMat.dispose();
      birdTex.dispose();
    },
  };
}
