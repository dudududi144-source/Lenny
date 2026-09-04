/* ============================================================
 * WorldSignposts — the continent's silent wayfinding (stage 16-c).
 *
 * The continent grew to ten regions; a 4-7 year-old at a fork needs
 * the next decision to be VISIBLE from afar. This module plants:
 *
 *   FORK POSTS   — one wooden post at every region road's start
 *                  (where the ten roads fan off the hub ring) with
 *                  three CARVED arrows: its own region's heart on
 *                  top, the two angular-neighbor regions beneath.
 *   GATE POSTS   — the same post at every region entrance, arrows
 *                  pointing at the two neighbor regions and back
 *                  down the road toward the hub.
 *   REGION TOTEMS — a tall pole silhouette at every region entrance,
 *                  colored by that region's own tint (its uiColor in
 *                  the region data), readable from across a region.
 *
 * The owner deprioritized in-game text: the signs carry NO text —
 * direction is the message (arrow silhouettes rotate toward the
 * ACTUAL next region heart, derived read-only from WorldRegions).
 *
 * Discipline (the critic's W6 ledger, still law):
 *   - everything derives from ONE pure planner, deterministic,
 *     unit-testable, zero scene objects involved
 *   - three thin-instanced masters total (poles / arrows / totems)
 *     = 3 draw calls steady-state, shared materials, merged parts
 *   - frozen static meshes: names avoid WorldApp's ANIMATED_PREFIXES
 *     so the boot freeze pass petrifies them on purpose
 *   - distance-culled (visible from ~80u) by a 600ms interval that
 *     only rewrites a thin-instance matrix when its visibility
 *     FLIPS — zero per-frame cost, zero allocations
 *   - built for ALL tiers: wayfinding is not decoration
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { REGIONS, REGION_ROADS, terrainHeight, type RegionDef, type RegionId } from './WorldRegions';

/* ---------- the pure planner (unit-pinned) ---------- */

export interface SignpostArrow {
  /** the region this carved arrow points at ('hub' = back down the road) */
  to: RegionId | 'hub';
  /** world yaw so the arrow points at the ACTUAL target */
  yaw: number;
  /** height on the pole (top arrow = the road's own region) */
  y: number;
}

export interface SignpostSpot {
  kind: 'fork' | 'gate';
  region: RegionId;
  x: number;
  z: number;
  arrows: SignpostArrow[];
}

export interface TotemSpot {
  region: RegionId;
  x: number;
  z: number;
  /** the region's own color (tint = the region's uiColor in the data) */
  color: string;
}

/** angular order of the ten region hearts around the hub (deterministic) */
export function regionAngularOrder(): RegionDef[] {
  return [...REGIONS].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
}

const ARROW_YS = [1.26, 1.0, 0.74];

/**
 * One plan for the whole continent (pure, deterministic): a fork post
 * per road start, a gate post + totem per region entrance. Arrows
 * rotate toward real region hearts; posts stand ~2u OFF the road so
 * they never block it; totems carry the region's color.
 */
export function planSignposts(): { posts: SignpostSpot[]; totems: TotemSpot[] } {
  const order = regionAngularOrder();
  const posts: SignpostSpot[] = [];
  const totems: TotemSpot[] = [];

  const neighborArrows = (region: RegionId, fromX: number, fromZ: number): SignpostArrow[] => {
    const idx = order.findIndex((r) => r.id === region);
    const prev = order[(idx - 1 + order.length) % order.length];
    const next = order[(idx + 1) % order.length];
    const make = (r: RegionDef, y: number): SignpostArrow => ({
      to: r.id,
      yaw: Math.atan2(r.x - fromX, r.z - fromZ),
      y,
    });
    /* top arrow first — at a fork the road's own region leads */
    return [make(prev, ARROW_YS[1]), make(next, ARROW_YS[2])];
  };

  for (const road of REGION_ROADS) {
    const region = REGIONS.find((r) => r.id === road.region)!;
    const heart = road.points[road.points.length - 1];

    /* ---- fork post: where the road leaves the hub ring ---- */
    const at = road.points[Math.min(3, road.points.length - 1)];
    const ahead = road.points[Math.min(6, road.points.length - 1)];
    const dx = ahead.x - at.x;
    const dz = ahead.z - at.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = (REGIONS.findIndex((r) => r.id === road.region) % 2 === 0 ? 1 : -1) * 2.05;
    const fx = at.x + (-dz / len) * side;
    const fz = at.z + (dx / len) * side;
    posts.push({
      kind: 'fork',
      region: road.region,
      x: fx,
      z: fz,
      arrows: [
        { to: road.region, yaw: Math.atan2(heart.x - fx, heart.z - fz), y: ARROW_YS[0] },
        ...neighborArrows(road.region, fx, fz),
      ],
    });

    /* ---- gate: totem + a post, beside the road at the entrance ---- */
    const g = road.gate;
    const perp = g.facing + Math.PI / 2;
    const tx = g.x + Math.cos(perp) * 2.7;
    const tz = g.z + Math.sin(perp) * 2.7;
    const gx = g.x + Math.cos(perp) * 4.9;
    const gz = g.z + Math.sin(perp) * 4.9;
    const back = road.points[Math.min(3, road.points.length - 1)];
    posts.push({
      kind: 'gate',
      region: road.region,
      x: gx,
      z: gz,
      arrows: [
        ...neighborArrows(road.region, gx, gz),
        { to: 'hub', yaw: Math.atan2(back.x - gx, back.z - gz), y: ARROW_YS[2] },
      ],
    });
    totems.push({ region: road.region, x: tx, z: tz, color: region.tint });
  }

  return { posts, totems };
}

/* ---------- the builder ---------- */

export interface SignpostsHandle {
  dispose(): void;
}

/** signs are legible from ~80u; past that the thin instance parks */
const CULL_DIST = 85;
const CULL_TICK_MS = 600;

export function buildWorldSignposts(scene: Scene): SignpostsHandle {
  const root = new TransformNode('signpost-root', scene);
  const plan = planSignposts();

  /* ---------- shared materials (three, total) ---------- */
  const woodMat = new StandardMaterial('signpost-wood', scene);
  woodMat.diffuseColor = Color3.FromHexString('#a9764a');
  woodMat.specularColor = new Color3(0.03, 0.03, 0.02);

  const poleMat = new StandardMaterial('signpost-pole', scene);
  poleMat.diffuseColor = Color3.FromHexString('#6f4f2e');
  poleMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const totemMat = new StandardMaterial('totem-mat', scene);
  totemMat.diffuseColor = Color3.White();
  /* a whisper of warm self-light: the totem reads as a silhouette at
     dusk without ever joining the glow layer's budget */
  totemMat.emissiveColor = Color3.FromHexString('#2a2416');
  totemMat.specularColor = new Color3(0.02, 0.02, 0.02);

  /* ---------- masters (built once, merged, thin-instanced) ---------- */

  /* the pole: one stick + a little pointed cap */
  const poleParts = [
    MeshBuilder.CreateCylinder('sp-pole', { diameter: 0.11, height: 1.5, tessellation: 6 }, scene),
    MeshBuilder.CreateCylinder('sp-cap', { diameterTop: 0.02, diameterBottom: 0.17, height: 0.22, tessellation: 6 }, scene),
  ];
  poleParts[0].position.y = 0.75;
  poleParts[1].position.y = 1.61;
  const poleMaster = Mesh.MergeMeshes(poleParts, true, true, undefined, false, false)!;
  poleMaster.name = 'signpost-pole-master';
  poleMaster.material = poleMat;
  poleMaster.parent = root;
  poleMaster.isPickable = false;
  poleMaster.alwaysSelectAsActiveMesh = true;

  /* one carved arrow: plank + triangular tip, pointing +Z. Instances
     rotate the whole shape toward the real target. */
  const arrowParts = [
    MeshBuilder.CreateBox('sp-plank', { width: 0.13, height: 0.15, depth: 0.66 }, scene),
    MeshBuilder.CreateCylinder('sp-tip', { diameter: 0.26, height: 0.16, tessellation: 3 }, scene),
  ];
  arrowParts[1].rotation.x = Math.PI / 2; /* the prism's axis lies along Z */
  arrowParts[1].position.z = 0.41;
  const arrowMaster = Mesh.MergeMeshes(arrowParts, true, true, undefined, false, false)!;
  arrowMaster.name = 'signpost-arrow-master';
  arrowMaster.material = woodMat;
  arrowMaster.parent = root;
  arrowMaster.isPickable = false;
  arrowMaster.alwaysSelectAsActiveMesh = true;

  /* the totem: stacked silhouette (base, body, wings, head, cap) —
     the same cheap primitive recipe as the landmarks */
  const totemParts = [
    MeshBuilder.CreateBox('sp-totem-base', { width: 0.62, height: 0.4, depth: 0.62 }, scene),
    MeshBuilder.CreateCylinder('sp-totem-body', { diameter: 0.36, height: 1.7, tessellation: 7 }, scene),
    MeshBuilder.CreateBox('sp-totem-wings', { width: 1.05, height: 0.18, depth: 0.16 }, scene),
    MeshBuilder.CreateBox('sp-totem-head', { width: 0.46, height: 0.52, depth: 0.46 }, scene),
    MeshBuilder.CreateCylinder('sp-totem-crown', { diameterTop: 0.04, diameterBottom: 0.5, height: 0.36, tessellation: 4 }, scene),
  ];
  totemParts[0].position.y = 0.2;
  totemParts[1].position.y = 1.25;
  totemParts[2].position.y = 1.62;
  totemParts[3].position.y = 2.36;
  totemParts[4].position.y = 2.8;
  const totemMaster = Mesh.MergeMeshes(totemParts, true, true, undefined, false, false)!;
  totemMaster.name = 'totem-master';
  totemMaster.material = totemMat;
  totemMaster.parent = root;
  totemMaster.isPickable = false;
  totemMaster.alwaysSelectAsActiveMesh = true;
  totemMaster.useVertexColors = true;

  /* ---------- instances: matrices composed once into flat buffers ---------- */

  const postCount = plan.posts.length;
  const totemCount = plan.totems.length;
  const arrowCount = postCount * 3;

  const poleMat4 = new Float32Array(postCount * 16);
  const polePos = new Float32Array(postCount * 3);
  const poleVisible = new Uint8Array(postCount);

  const arrowMat4 = new Float32Array(arrowCount * 16);
  const arrowPos = new Float32Array(arrowCount * 3);
  const arrowVisible = new Uint8Array(arrowCount);

  const totemMat4 = new Float32Array(totemCount * 16);
  const totemPos = new Float32Array(totemCount * 3);
  const totemColors = new Float32Array(totemCount * 4);
  const totemVisible = new Uint8Array(totemCount);

  const scratchScale = new Vector3(1, 1, 1);
  const scratchQuat = new Quaternion();
  const scratchPos = new Vector3();
  const scratchMatrix = new Matrix();

  plan.posts.forEach((post, i) => {
    const y = terrainHeight(post.x, post.z);
    polePos[i * 3] = post.x;
    polePos[i * 3 + 1] = y;
    polePos[i * 3 + 2] = post.z;
    poleVisible[i] = 1;
    scratchPos.set(post.x, y + 0.75, post.z); /* master is centered at 0.75 */
    Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
    scratchMatrix.copyToArray(poleMat4, i * 16);

    post.arrows.forEach((arrow, a) => {
      const j = i * 3 + a;
      const ay = y + arrow.y;
      arrowPos[j * 3] = post.x;
      arrowPos[j * 3 + 1] = ay;
      arrowPos[j * 3 + 2] = post.z;
      arrowVisible[j] = 1;
      Quaternion.RotationYawPitchRollToRef(arrow.yaw, 0, 0, scratchQuat);
      scratchPos.set(post.x, ay, post.z);
      Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
      scratchMatrix.copyToArray(arrowMat4, j * 16);
    });
  });

  plan.totems.forEach((totem, i) => {
    const y = terrainHeight(totem.x, totem.z);
    totemPos[i * 3] = totem.x;
    totemPos[i * 3 + 1] = y;
    totemPos[i * 3 + 2] = totem.z;
    totemVisible[i] = 1;
    scratchPos.set(totem.x, y, totem.z);
    Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
    scratchMatrix.copyToArray(totemMat4, i * 16);
    const c = Color3.FromHexString(totem.color);
    totemColors[i * 4] = c.r;
    totemColors[i * 4 + 1] = c.g;
    totemColors[i * 4 + 2] = c.b;
    totemColors[i * 4 + 3] = 1;
  });

  /* matrix buffers are rewritten by the cull tick (rarely) → dynamic;
     the color buffer never changes after boot → static */
  poleMaster.thinInstanceSetBuffer('matrix', poleMat4, 16, false);
  arrowMaster.thinInstanceSetBuffer('matrix', arrowMat4, 16, false);
  totemMaster.thinInstanceSetBuffer('matrix', totemMat4, 16, false);
  totemMaster.thinInstanceSetBuffer('color', totemColors, 4, true);

  /* ---------- distance culling (the signs' one living cost) ----------
     A 600ms tick reads the ACTIVE CAMERA (no WorldApp coupling), and
     flips each instance between its real matrix and a parked one far
     below the world — writing a buffer only when something CHANGED.
     Weak tier runs this too: wayfinding is for every device. */
  const PARK_Y = -999;

  const cull = (): void => {
    const cam = scene.activeCamera;
    if (!cam) return;
    const cx = cam.globalPosition.x;
    const cz = cam.globalPosition.z;
    let dirty = false;

    /* poles and totems are one-to-one with their spots */
    for (let i = 0; i < postCount; i++) {
      const d = Math.hypot(polePos[i * 3] - cx, polePos[i * 3 + 2] - cz);
      const vis = d <= CULL_DIST ? 1 : 0;
      if (vis !== poleVisible[i]) {
        poleVisible[i] = vis;
        const o = i * 16;
        if (vis) {
          scratchPos.set(polePos[i * 3], polePos[i * 3 + 1] + 0.75, polePos[i * 3 + 2]);
        } else {
          scratchPos.set(polePos[i * 3], PARK_Y, polePos[i * 3 + 2]);
        }
        Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
        scratchMatrix.copyToArray(poleMat4, o);
        dirty = true;
      }
      /* the post's three arrows ride its visibility */
      for (let a = 0; a < 3; a++) {
        const j = i * 3 + a;
        if (vis !== arrowVisible[j]) {
          arrowVisible[j] = vis;
          const o = j * 16;
          if (vis) {
            Quaternion.RotationYawPitchRollToRef(plan.posts[i].arrows[a].yaw, 0, 0, scratchQuat);
            scratchPos.set(arrowPos[j * 3], arrowPos[j * 3 + 1], arrowPos[j * 3 + 2]);
          } else {
            scratchQuat.set(0, 0, 0, 1);
            scratchPos.set(arrowPos[j * 3], PARK_Y, arrowPos[j * 3 + 2]);
          }
          Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
          scratchMatrix.copyToArray(arrowMat4, o);
          dirty = true;
        }
      }
    }
    for (let i = 0; i < totemCount; i++) {
      const d = Math.hypot(totemPos[i * 3] - cx, totemPos[i * 3 + 2] - cz);
      const vis = d <= CULL_DIST ? 1 : 0;
      if (vis !== totemVisible[i]) {
        totemVisible[i] = vis;
        const o = i * 16;
        scratchPos.set(totemPos[i * 3], vis ? totemPos[i * 3 + 1] : PARK_Y, totemPos[i * 3 + 2]);
        Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
        scratchMatrix.copyToArray(totemMat4, o);
        dirty = true;
      }
    }
    if (dirty) {
      poleMaster.thinInstanceBufferUpdated('matrix');
      arrowMaster.thinInstanceBufferUpdated('matrix');
      totemMaster.thinInstanceBufferUpdated('matrix');
    }
  };

  const cullTimer = window.setInterval(cull, CULL_TICK_MS);

  return {
    dispose(): void {
      window.clearInterval(cullTimer);
      root.dispose(false, true);
      woodMat.dispose();
      poleMat.dispose();
      totemMat.dispose();
    },
  };
}
