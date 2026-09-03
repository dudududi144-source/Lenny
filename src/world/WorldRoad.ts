/* ============================================================
 * WorldRoad — the journey made legible (stage 11).
 *
 * A big garden needs a road you can read:
 *   - BRIDGES: wooden plank bridges where the path meets each
 *     island's rim — the walk between zones feels crossed, not
 *     faded through.
 *   - WAYSTONES: small glowing stones along the spiral that pulse
 *     as the day palette breathes — the road is alive at night.
 *   - SIGNPOSTS: five wooden posts with painted plates (zone name
 *     + "עוד ~N צעדים") that turn the walk into a journey the
 *     child can plan — environmental print, the wayfinding skill.
 *
 * Zero assets: DynamicTexture plates, shared materials, merged
 * static geometry where possible, transform-only animation.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { getZone, type ZoneId } from '../data/garden';
import { WORLD_ISLANDS, WORLD_SIGNPOSTS, pathPoints, islandCenter } from './WorldLayout';

const hex = (s: string): Color3 => Color3.FromHexString(s);

export interface RoadHandle {
  update(t: number, dt: number): void;
  dispose(): void;
}

export function buildRoad(scene: Scene): RoadHandle {
  const root = new TransformNode('road-root', scene);

  const woodMat = new StandardMaterial('rd-wood', scene);
  woodMat.diffuseColor = hex('#a9764a');
  woodMat.specularColor = new Color3(0.03, 0.03, 0.02);
  const woodDark = new StandardMaterial('rd-wood-dark', scene);
  woodDark.diffuseColor = hex('#7c5433');
  woodDark.specularColor = new Color3(0.02, 0.02, 0.02);
  const stoneMat = new StandardMaterial('rd-stone', scene);
  stoneMat.diffuseColor = hex('#9a978f');
  stoneMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const glowMat = new StandardMaterial('rd-glow', scene);
  glowMat.diffuseColor = hex('#caa53d');
  glowMat.emissiveColor = hex('#ffd76a').scale(0.6);
  glowMat.specularColor = new Color3(0.05, 0.05, 0.02);
  const allMats = [woodMat, woodDark, stoneMat, glowMat];

  const allMeshes: Mesh[] = [];

  /* ---------- boardwalks: planks laid ALONG the road (stage 11 fix) ----------
     At journey scale the islands sit far apart (14–21 units); a straight
     plank between rims became a highway cutting across the meadow. The
     road itself is the bridge now: short wooden planks follow the path
     polyline wherever it runs over open grass, and rails appear only
     where the path narrows near an island approach. */
  const pts = pathPoints();
  const bridgeParts: Mesh[] = [];
  const PLANK_STEP = 1.5;
  let carried = PLANK_STEP; /* place the first plank immediately */
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    /* no boardwalk on an island platform (the platform IS the ground there) */
    let onIsland = false;
    for (const isl of WORLD_ISLANDS) {
      if (Math.hypot(p.x - isl.x, p.z - isl.z) < isl.radius + 0.2) {
        onIsland = true;
        break;
      }
    }
    if (onIsland) {
      carried = PLANK_STEP; /* a fresh plank right off each ramp */
      continue;
    }
    const prev = pts[i - 1];
    carried += Math.hypot(p.x - prev.x, p.z - prev.z);
    if (carried < PLANK_STEP) continue;
    carried = 0;
    const next = pts[i + 1];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const plank = MeshBuilder.CreateBox(`rd-plank-${i}`, { width: 1.05, height: 0.07, depth: 1.15 }, scene);
    plank.position.set(p.x, 0.055, p.z);
    plank.rotation.y = Math.atan2(dx, dz);
    plank.material = woodMat;
    bridgeParts.push(plank);
    /* a rail post pair every few planks — the road reads as a crossing */
    if (i % 24 === 0) {
      for (const side of [-1, 1]) {
        const post = MeshBuilder.CreateCylinder(`rd-rail-${i}-${side}`, { diameter: 0.08, height: 0.42, tessellation: 6 }, scene);
        post.position.set(p.x + (-dz / len) * 0.62 * side, 0.28, p.z + (dx / len) * 0.62 * side);
        post.material = woodDark;
        bridgeParts.push(post);
      }
    }
  }
  const bridges = bridgeParts.length > 1 ? Mesh.MergeMeshes(bridgeParts, true, false, undefined, false, true) : bridgeParts[0] ?? null;
  if (bridges) {
    bridges.name = 'road-bridges';
    bridges.parent = root;
    bridges.isPickable = false;
    bridges.position.setAll(0);
    allMeshes.push(bridges);
  }

  /* ---------- waystones along the spiral ---------- */
  const waystones: Mesh[] = [];
  const wayBase: number[] = [];
  for (let i = 4; i < pts.length - 4; i += 14) {
    const p = pts[i];
    /* skip waystones that would sit on an island platform */
    let onIsland = false;
    for (const isl of WORLD_ISLANDS) {
      if (Math.hypot(p.x - isl.x, p.z - isl.z) < isl.radius + 0.3) {
        onIsland = true;
        break;
      }
    }
    if (onIsland) continue;
    const stone = MeshBuilder.CreateSphere(`rd-way-${i}`, { diameter: 0.3, segments: 6 }, scene);
    stone.scaling.set(1, 0.7, 1);
    stone.position.set(p.x, 0.1, p.z);
    stone.material = glowMat;
    stone.isPickable = false;
    stone.parent = root;
    allMeshes.push(stone);
    waystones.push(stone);
    wayBase.push(0.1);
  }

  /* ---------- signposts with painted plates ---------- */
  for (const sp of WORLD_SIGNPOSTS) {
    const zone = getZone(sp.toZone);
    if (!zone) continue;
    const post = MeshBuilder.CreateCylinder(`rd-sign-pole-${sp.index}`, { diameter: 0.1, height: 1.15, tessellation: 6 }, scene);
    post.position.set(sp.x, 0.57, sp.z);
    post.material = woodDark;
    post.isPickable = false;
    post.parent = root;
    allMeshes.push(post);

    const w = 512;
    const h = 160;
    const tex = new DynamicTexture(`rd-sign-tex-${sp.index}`, { width: w, height: h }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const draw = (): void => {
      ctx.fillStyle = '#a9764a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#7c5433';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#fff8e8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.font = '700 62px Heebo, "Segoe UI", Arial, sans-serif';
      ctx.fillText(zone.name, w / 2, 52);
      ctx.font = '600 42px Heebo, "Segoe UI", Arial, sans-serif';
      ctx.fillText(`עוֹד ~${sp.steps} צְעָדִים`, w / 2, 116);
      tex.update();
    };
    draw();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(draw);
    }

    const plate = MeshBuilder.CreatePlane(`rd-sign-plate-${sp.index}`, { width: 1.15, height: 0.36 }, scene);
    plate.position.set(sp.x, 1.06, sp.z);
    plate.rotation.y = sp.facing + Math.PI / 2;
    const mat = new StandardMaterial(`rd-sign-mat-${sp.index}`, scene);
    mat.diffuseTexture = tex;
    mat.specularColor = new Color3(0.04, 0.03, 0.02);
    mat.backFaceCulling = false;
    plate.material = mat;
    plate.isPickable = false;
    plate.parent = root;
    allMeshes.push(plate);
    allMats.push(mat);
  }

  return {
    update(t, dt) {
      void dt;
      /* the waystones breathe in a slow wave down the road */
      for (let i = 0; i < waystones.length; i++) {
        waystones[i].position.y = wayBase[i] + Math.sin(t * 1.6 + i * 0.55) * 0.035;
      }
    },
    dispose() {
      for (const m of allMeshes) m.dispose();
      root.dispose(false, true);
      for (const m of allMats) m.dispose();
    },
  };
}

/* ---------- pure helpers (unit-pinned) ---------- */

/** The island the bridge from island i leads to (null at the end). */
export function bridgeTarget(i: number): ZoneId | null {
  return i >= 0 && i < WORLD_ISLANDS.length - 1 ? WORLD_ISLANDS[i + 1].zone : null;
}

/** Walking distance in "child steps" from one island to another along the road (straight-chord estimate). */
export function stepsBetween(from: ZoneId, to: ZoneId): number {
  const a = islandCenter(from);
  const b = islandCenter(to);
  return Math.max(4, Math.round(Math.hypot(a.x - b.x, a.z - b.z) * 1.2));
}
