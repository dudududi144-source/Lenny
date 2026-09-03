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
import { REGIONS, REGION_ROADS, regionById, regionSteps, terrainHeight } from './WorldRegions';

const hex = (s: string): Color3 => Color3.FromHexString(s);

export interface RoadHandle {
  update(t: number, dt: number, px?: number, pz?: number): void;
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

  /* ---------- stage 12: the roads to the regions ----------
     Six splines leave the hub ring, one per region — planks that
     follow the rolling terrain, waystones that breathe, and two
     signposts each (mid-road + at the gate) with the region's name
     and the honest number of child-steps. Reaching the next stage
     of the unlock chain is a JOURNEY now, and the road makes it
     legible: environmental print, the wayfinding skill. */
  const REGION_PLANK_STEP = 2.2;
  const regionRoadMeshes: Array<{ region: string; mesh: Mesh }> = [];
  for (const road of REGION_ROADS) {
    const region = regionById(road.region);
    const roadParts: Mesh[] = [];
    let carried = REGION_PLANK_STEP;
    for (let i = 1; i < road.points.length - 1; i++) {
      const p = road.points[i];
      const prev = road.points[i - 1];
      carried += Math.hypot(p.x - prev.x, p.z - prev.z);
      if (carried < REGION_PLANK_STEP) continue;
      carried = 0;
      const next = road.points[i + 1];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const plank = MeshBuilder.CreateBox(`rd-rr-${road.region}-${i}`, { width: 1.05, height: 0.07, depth: 1.3 }, scene);
      plank.position.set(p.x, terrainHeight(p.x, p.z) + 0.055, p.z);
      plank.rotation.y = Math.atan2(dx, dz);
      plank.material = woodMat;
      roadParts.push(plank);
      if (i % 10 === 0) {
        const post = MeshBuilder.CreateCylinder(`rd-rrail-${road.region}-${i}`, { diameter: 0.08, height: 0.42, tessellation: 6 }, scene);
        post.position.set(p.x + (-dz / len) * 0.62, terrainHeight(p.x, p.z) + 0.28, p.z + (dx / len) * 0.62);
        post.material = woodDark;
        roadParts.push(post);
      }
    }
    const merged = roadParts.length > 1 ? Mesh.MergeMeshes(roadParts, true, false, undefined, false, true) : roadParts[0] ?? null;
    if (merged) {
      merged.name = `road-region-${road.region}`;
      merged.parent = root;
      merged.isPickable = false;
      merged.position.setAll(0);
      allMeshes.push(merged);
      regionRoadMeshes.push({ region: road.region, mesh: merged });
    }

    /* region waystones ride IN the road mesh (static — the breathing
       wave stays a hub luxury; SwiftShader counts every draw call) */
    for (let i = 6; i < road.points.length - 4; i += 10) {
      const p = road.points[i];
      const stone = MeshBuilder.CreateSphere(`rd-rway-${road.region}-${i}`, { diameter: 0.3, segments: 6 }, scene);
      stone.scaling.set(1, 0.7, 1);
      stone.position.set(p.x, terrainHeight(p.x, p.z) + 0.1, p.z);
      stone.material = glowMat;
      stone.isPickable = false;
      roadParts.push(stone);
    }

    /* two signposts per region road */
    const steps = regionSteps(road.region);
    const marks: Array<{ frac: number }> = [{ frac: 0.55 }, { frac: 0.985 }];
    for (let m = 0; m < marks.length; m++) {
      const idx = Math.min(road.points.length - 2, Math.max(1, Math.round(marks[m].frac * (road.points.length - 1))));
      const at = road.points[idx];
      const back = road.points[Math.max(0, idx - 2)];
      const towardHub = Math.atan2(back.z - at.z, back.x - at.x);
      const px = at.x + Math.cos(towardHub + Math.PI / 2) * 1.9;
      const pz = at.z + Math.sin(towardHub + Math.PI / 2) * 1.9;
      const sy = terrainHeight(px, pz);

      const pole = MeshBuilder.CreateCylinder(`rd-rsign-pole-${road.region}-${m}`, { diameter: 0.1, height: 1.3, tessellation: 6 }, scene);
      pole.position.set(px, sy + 0.65, pz);
      pole.material = woodDark;
      pole.isPickable = false;
      pole.parent = root;
      allMeshes.push(pole);

      const w = 512;
      const h = 160;
      const tex = new DynamicTexture(`rd-rsign-tex-${road.region}-${m}`, { width: w, height: h }, scene, true);
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
        ctx.font = '700 60px Heebo, "Segoe UI", Arial, sans-serif';
        ctx.fillText(region.name, w / 2, 54);
        ctx.font = '600 40px Heebo, "Segoe UI", Arial, sans-serif';
        ctx.fillText(m === 0 ? `עוֹד ~${steps} צְעָדִים` : 'הַשַּׁעַר לְמַטָּה', w / 2, 116);
        tex.update();
      };
      draw();
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        void document.fonts.ready.then(draw);
      }
      const plate = MeshBuilder.CreatePlane(`rd-rsign-plate-${road.region}-${m}`, { width: 1.3, height: 0.4 }, scene);
      plate.position.set(px, sy + 1.18, pz);
      plate.rotation.y = towardHub;
      const mat = new StandardMaterial(`rd-rsign-mat-${road.region}-${m}`, scene);
      mat.diffuseTexture = tex;
      mat.specularColor = new Color3(0.04, 0.03, 0.02);
      mat.backFaceCulling = false;
      plate.material = mat;
      plate.isPickable = false;
      plate.parent = root;
      allMeshes.push(plate);
      allMats.push(mat);
    }
  }

  return {
    update(t, dt, px, pz) {
      void dt;
      /* the waystones breathe in a slow wave down the road */
      for (let i = 0; i < waystones.length; i++) {
        waystones[i].position.y = wayBase[i] + Math.sin(t * 1.6 + i * 0.55) * 0.035;
      }
      /* stage 12: far region roads sleep until the walker heads out */
      if (px !== undefined && pz !== undefined) {
        for (const rr of regionRoadMeshes) {
          const r = REGIONS.find((x: { id: string }) => x.id === rr.region);
          if (!r) continue;
          const show = Math.hypot(px - r.x, pz - r.z) < 190; /* typed via REGIONS */
          if (rr.mesh.isEnabled() !== show) rr.mesh.setEnabled(show);
        }
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
