/* ============================================================
 * WorldLanterns — the path lights the garden promised (critic W6).
 *
 * docs/GARDEN.md says "פנסים נדלקים לאורך השביל" — until now no
 * lantern existed anywhere. This is the journey made visible:
 * every light the child earns in a game (ProgressStore.lights)
 * lights the next lantern along the spiral path, in journey order,
 * forever (capped at the lantern count — no scrolling counters).
 *
 * Pure placement (lanternPositions/lanternsFor) is unit-tested;
 * the runtime handle only swaps materials and pops a springy scale.
 * Zero per-frame allocations: idle lanterns cost one bobber-less
 * material each and nothing else.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { WORLD_ISLANDS, WORLD_WALK_RADIUS, isInsideIsland, pathPoints } from './WorldLayout';

export const LANTERN_COUNT = 12;

/* The lit glass and its dark twin — shared by every lantern. */
const LIT_EMISSIVE = Color3.FromHexString('#ffd76a');
const UNLIT_EMISSIVE = Color3.FromHexString('#5a5f58');

/** One lantern's place in the world — position + its journey arc index. */
export interface LanternSpot {
  x: number;
  z: number;
  /** index along the open path polyline (strictly increasing in journey order) */
  arc: number;
}

/** Lights → lit lanterns: 1:1 up to the cap, never negative. */
export function lanternsFor(lights: number): number {
  return Math.max(0, Math.min(LANTERN_COUNT, Math.floor(lights)));
}

/** Minimum world-space gap between two lanterns — never a clump. */
export const LANTERN_MIN_SEP = 1.0;
/** How far a lantern stands from the path centerline (beside, not on). */
export const LANTERN_OFFSET = 0.5;

/**
 * Evenly spaced spots ALONG the journey path (pure, deterministic).
 *
 * The golden-angle spiral doubles back on itself, so "evenly spaced"
 * means even ARC LENGTH, not even radius. Spots are then nudged
 * perpendicular to the path (alternating sides) so lanterns flank the
 * ribbon like real path lights, re-checked for separation AFTER the
 * nudge, and only kept when they stand on open grass inside the walk.
 */
export function lanternPositions(): LanternSpot[] {
  const open = pathPoints().filter((p) => !isInsideIsland(p.x, p.z));
  if (open.length < LANTERN_COUNT) return [];

  /* cumulative arc length along the open polyline */
  const cum = new Array<number>(open.length);
  cum[0] = 0;
  for (let i = 1; i < open.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(open[i].x - open[i - 1].x, open[i].z - open[i - 1].z);
  }
  const total = cum[open.length - 1];
  if (total <= 0) return [];

  const place = (p: { x: number; z: number }, dirX: number, dirZ: number, side: number): { x: number; z: number } => {
    const off = LANTERN_OFFSET * side;
    return { x: p.x + dirX * off, z: p.z + dirZ * off };
  };

  const out: LanternSpot[] = [];
  let last: { x: number; z: number } | null = null;
  let cursor = 0;
  for (let k = 0; k < LANTERN_COUNT; k++) {
    const targetArc = (total * k) / (LANTERN_COUNT - 1);
    while (cursor < cum.length - 1 && cum[cursor] < targetArc) cursor++;
    const p = open[cursor];

    /* path direction here (neighbors, clamped) — for the perpendicular nudge */
    const prev = open[Math.max(0, cursor - 1)];
    const next = open[Math.min(open.length - 1, cursor + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const nx = -dz;
    const nz = dx;
    const side = k % 2 === 0 ? 1 : -1;

    /* nudge beside the path; fall back to the other side, then the
       centerline itself (which is already open grass) */
    let spot = place(p, nx, nz, side);
    if (isInsideIsland(spot.x, spot.z) || Math.hypot(spot.x, spot.z) > WORLD_WALK_RADIUS) {
      spot = place(p, nx, nz, -side);
      if (isInsideIsland(spot.x, spot.z) || Math.hypot(spot.x, spot.z) > WORLD_WALK_RADIUS) {
        spot = { x: p.x, z: p.z };
      }
    }

    if (last && Math.hypot(spot.x - last.x, spot.z - last.z) < LANTERN_MIN_SEP) continue;
    out.push({ x: spot.x, z: spot.z, arc: cursor });
    last = spot;
  }
  return out;
}

export interface LanternHandle {
  /** Light the first `n` lanterns; new ones pop in when animate. */
  setLit(n: number, animate?: boolean): void;
  lit(): number;
  /** standard+ only: lit glass breathes with a soft candle flicker.
   *  Weak keeps the historical steady glow (and the floor's cost). */
  setAtmosphere(on: boolean): void;
  dispose(): void;
}

interface LanternPop {
  mesh: Mesh;
  start: number;
}

export function buildLanterns(scene: Scene): LanternHandle {
  const root = new TransformNode('lanterns-root', scene);
  const spots = lanternPositions();

  /* three materials TOTAL for twelve lanterns */
  const postMat = new StandardMaterial('lantern-post-mat', scene);
  postMat.diffuseColor = Color3.FromHexString('#8a5a33');
  postMat.specularColor = new Color3(0.03, 0.03, 0.02);

  const glassMat = new StandardMaterial('lantern-glass-unlit', scene);
  glassMat.diffuseColor = Color3.FromHexString('#3c423c');
  glassMat.emissiveColor = UNLIT_EMISSIVE.scale(0.25);
  glassMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const litMat = new StandardMaterial('lantern-glass-lit', scene);
  litMat.diffuseColor = Color3.FromHexString('#4a4030');
  litMat.emissiveColor = LIT_EMISSIVE;
  litMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const heads: Mesh[] = [];
  const posts: Mesh[] = [];
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const post = MeshBuilder.CreateCylinder(
      `lantern-post-${i}`,
      { diameterTop: 0.05, diameterBottom: 0.08, height: 0.85, tessellation: 7 },
      scene,
    );
    post.position.set(spot.x, 0.42, spot.z);
    post.material = postMat;
    post.parent = root;
    post.isPickable = false;
    posts.push(post);

    const head = MeshBuilder.CreateBox(`lantern-head-${i}`, { width: 0.2, height: 0.22, depth: 0.2 }, scene);
    head.position.set(spot.x, 0.93, spot.z);
    head.material = glassMat;
    head.parent = root;
    head.isPickable = false;
    heads.push(head);
  }
  /* twelve identical posts become ONE mesh — twelve draw calls saved,
     forever, on every device (critic W6) */
  const postsMesh = Mesh.MergeMeshes(posts, true, false, undefined, false, false);
  if (postsMesh) {
    postsMesh.name = 'lantern-posts';
    postsMesh.parent = root;
    postsMesh.isPickable = false;
  }

  /* the springy pop for newly lit lanterns (reused slots, no churn) */
  const pops: LanternPop[] = [];
  const sceneObs = scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    /* the flicker rides the same observable as the pops — one pass */
    if (flicker && litCount > 0) {
      const t = now / 1000;
      const k = 0.9 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.7 + 1.3) * 0.04;
      litMat.emissiveColor.copyFrom(LIT_EMISSIVE).scaleInPlace(k);
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      const k = Math.min(1, (now - p.start) / 700);
      const back = 1 + 2.0 * Math.pow(k - 1, 3) + 1.1 * Math.pow(k - 1, 2);
      p.mesh.scaling.setAll(Math.max(0.001, back));
      if (k >= 1) {
        p.mesh.scaling.setAll(1);
        pops.splice(i, 1);
      }
    }
  });

  let litCount = 0;

  /* stage 15-D: candle flicker on the LIT material (shared — one write
     per frame covers every lit lantern). Two cheap sines, never a
     strobe; the unlit glass never flickers. Zero allocations. */
  let flicker = false;

  return {
    setLit(n: number, animate = false): void {
      const target = lanternsFor(n);
      if (target === litCount) return;
      const now = performance.now();
      for (let i = 0; i < heads.length; i++) {
        const want = i < target;
        const head = heads[i];
        if (want && head.material !== litMat) {
          head.material = litMat;
          if (animate) pops.push({ mesh: head, start: now + (i - litCount) * 160 });
        } else if (!want && head.material === litMat) {
          head.material = glassMat;
          head.scaling.setAll(1);
        }
      }
      litCount = target;
    },
    lit: () => litCount,
    setAtmosphere(on: boolean): void {
      flicker = on;
      if (!on) litMat.emissiveColor.copyFrom(LIT_EMISSIVE); /* exact restore */
    },
    dispose(): void {
      scene.onBeforeRenderObservable.remove(sceneObs);
      root.dispose(false, true);
      postMat.dispose();
      glassMat.dispose();
      litMat.dispose();
    },
  };
}

/* Re-exported so tests can pin that no lantern ever stands on a stage. */
export const ISLAND_COUNT = WORLD_ISLANDS.length;
