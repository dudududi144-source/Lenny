/* ============================================================
 * WorldClearings — the thirty game clearings + the acorn woods
 * (stage 14). The renderer half of WorldStations/worldAcorns.
 *
 * Every clearing (station) shows, from far to near:
 *   - a LIGHT PILLAR (a soft glowing column, tall enough to find
 *     from the next hill — wayfinding, not decoration)
 *   - a PENNANT FLAG on a pole (zone color + the band's dots)
 *   - a glowing PAD on the grass (step on it / tap it → the games
 *     of that band offer themselves; the pad IS pickable)
 *
 * Locked zones' clearings never render (the fog owns them too).
 * The acorns sit at ACORN_SPOTS, bob and spin, and disappear
 * forever once gathered (setCollected — the map remembers).
 *
 * Performance discipline (WorldLandmarks pattern): materials and
 * meshes built once, zero per-frame allocations, tiny meshes.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { ZONES, type ZoneId } from '../data/garden';
import { STATIONS, type StationBand, type StationSpot, STATION_PAD_RADIUS } from './WorldStations';
import { ACORN_SPOTS } from './worldAcorns';
import { terrainHeight } from './WorldRegions';

const hex = (s: string): Color3 => Color3.FromHexString(s);

export interface ClearingSpot {
  zone: ZoneId;
  band: StationBand;
  /** canvas-fraction of the pad (e2e + the entry card anchor) */
  x: number;
  y: number;
  on: boolean;
}

export interface ClearingsHandle {
  /** Which zones' clearings exist (fog owns locked ones). */
  refresh(unlockedZones: ReadonlySet<string>): void;
  /** Per-frame life (pennants wave, pads pulse, acorns bob). */
  update(t: number, dt: number, px: number, pz: number): void;
  /** Canvas-fraction spots of every visible pad (e2e taps). */
  spots(project: (p: Vector3) => { x: number; y: number; on: boolean }): ClearingSpot[];
  /** The acorn the walker is touching right now (or null). */
  acornWithinReach(x: number, z: number, reach: number): { id: string } | null;
  /** Hide gathered acorns (session + restored ledger). */
  setCollectedAcorns(ids: ReadonlySet<string>): void;
  /** The pad mesh names a tap may land on. */
  dispose(): void;
}

/* ---------- pennant texture: the band's dots on the zone color ---------- */

function pennantTexture(scene: Scene, color: string, band: StationBand): DynamicTexture {
  const w = 128;
  const h = 84;
  const tex = new DynamicTexture(`pennant-${color}-${band}`, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  /* the swallow-tail flag reads at a glance */
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(4, 6);
  ctx.lineTo(118, 6);
  ctx.lineTo(96, 42);
  ctx.lineTo(118, 78);
  ctx.lineTo(4, 78);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,40,24,0.55)';
  ctx.lineWidth = 5;
  ctx.stroke();
  /* band dots: 1 / 2 / 3 */
  ctx.fillStyle = 'rgba(255,252,240,0.95)';
  const dots = band + 1;
  for (let i = 0; i < dots; i++) {
    ctx.beginPath();
    ctx.arc(30 + i * 26, 42, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.update();
  tex.hasAlpha = false;
  return tex;
}

/* ---------- the acorn mesh (two spheres: nut + cap) ---------- */

function buildAcorn(scene: Scene, x: number, z: number): TransformNode {
  const root = new TransformNode(`acorn-node-${x.toFixed(1)}-${z.toFixed(1)}`, scene);
  const y = terrainHeight(x, z);
  root.position.set(x, y, z);
  const nut = MeshBuilder.CreateSphere('acorn-nut', { diameterX: 0.3, diameterY: 0.36, diameterZ: 0.3, segments: 6 }, scene);
  nut.position.y = 0.5;
  nut.material = acornNutMat;
  nut.parent = root;
  const cap = MeshBuilder.CreateSphere('acorn-cap', { diameterX: 0.34, diameterY: 0.2, diameterZ: 0.34, segments: 6 }, scene);
  cap.position.y = 0.66;
  cap.material = acornCapMat;
  cap.parent = root;
  /* the stem makes it read as an acorn, not a pebble */
  const stem = MeshBuilder.CreateCylinder('acorn-stem', { diameter: 0.045, height: 0.14, tessellation: 5 }, scene);
  stem.position.y = 0.8;
  stem.material = acornCapMat;
  stem.parent = root;
  /* one acorn = ONE draw call (44 woods × 3 parts would tax software
     renderers) — the multi-material merge keeps both looks */
  const parts = [nut, cap, stem];
  const merged = Mesh.MergeMeshes(parts, true, false, undefined, false, true);
  if (merged) {
    merged.name = 'acorn-body';
    merged.parent = root;
    merged.isPickable = false;
  }
  return root;
}

/* shared materials (built once per scene) */
let acornNutMat: StandardMaterial;
let acornCapMat: StandardMaterial;

interface StationParts {
  spot: StationSpot;
  root: TransformNode;
  pad: Mesh;
  padGlow: Mesh;
  pillar: Mesh;
  pennant: Mesh;
  padMat: StandardMaterial;
  glowMat: StandardMaterial;
}

export function buildClearings(scene: Scene): ClearingsHandle {
  const root = new TransformNode('clearings-root', scene);

  acornNutMat = new StandardMaterial('acorn-nut-mat', scene);
  acornNutMat.diffuseColor = hex('#c98a4b');
  acornNutMat.specularColor = new Color3(0.05, 0.04, 0.03);
  acornCapMat = new StandardMaterial('acorn-cap-mat', scene);
  acornCapMat.diffuseColor = hex('#6b4a2c');
  acornCapMat.specularColor = new Color3(0.04, 0.03, 0.03);

  const zoneColor = new Map<string, string>(ZONES.map((z) => [z.id, z.uiColor]));
  const poleMat = new StandardMaterial('station-pole-mat', scene);
  poleMat.diffuseColor = hex('#7a5a38');
  poleMat.specularColor = new Color3(0.03, 0.03, 0.03);
  const pillarMat = new StandardMaterial('station-pillar-mat', scene);
  pillarMat.emissiveColor = hex('#fff3b0');
  pillarMat.diffuseColor = Color3.Black();
  pillarMat.specularColor = Color3.Black();
  pillarMat.disableLighting = true;
  pillarMat.alpha = 0.14;
  pillarMat.backFaceCulling = false;

  const stations: StationParts[] = [];
  const pennantMats: StandardMaterial[] = [];
  const zoneSet = new Set<string>();

  for (const spot of STATIONS) {
    const color = zoneColor.get(spot.zone) ?? '#ffd76a';
    const sRoot = new TransformNode(`station-${spot.zone}-${spot.band}`, scene);
    sRoot.position.set(spot.x, terrainHeight(spot.x, spot.z), spot.z);
    sRoot.parent = root;

    /* the pad — pickable, the name carries zone+band for the tap router */
    const padMat = new StandardMaterial(`station-pad-mat-${spot.zone}-${spot.band}`, scene);
    padMat.diffuseColor = hex(color).scale(0.85);
    padMat.emissiveColor = hex(color).scale(0.22);
    padMat.specularColor = new Color3(0.05, 0.05, 0.05);
    padMat.alpha = 0.94;
    const pad = MeshBuilder.CreateDisc(
      `station-pad-${spot.zone}-${spot.band}`,
      { radius: STATION_PAD_RADIUS, tessellation: 26 },
      scene,
    );
    pad.rotation.x = Math.PI / 2;
    pad.position.y = 0.045;
    pad.material = padMat;
    pad.parent = sRoot;
    pad.isPickable = true;

    /* the pulse ring around the pad */
    const glowMat = new StandardMaterial(`station-glow-mat-${spot.zone}-${spot.band}`, scene);
    glowMat.emissiveColor = hex(color);
    glowMat.diffuseColor = Color3.Black();
    glowMat.specularColor = Color3.Black();
    glowMat.disableLighting = true;
    glowMat.alpha = 0.5;
    const padGlow = MeshBuilder.CreateTorus(
      `station-glow-${spot.zone}-${spot.band}`,
      { diameter: STATION_PAD_RADIUS * 2 + 0.22, thickness: 0.09, tessellation: 24 },
      scene,
    );
    padGlow.position.y = 0.05;
    padGlow.scaling.y = 0.42;
    padGlow.material = glowMat;
    padGlow.parent = sRoot;
    padGlow.isPickable = false;

    /* the pennant pole + flag (faces the island) */
    const pole = MeshBuilder.CreateCylinder(
      `station-pole-${spot.zone}-${spot.band}`,
      { diameter: 0.09, height: 2.1, tessellation: 6 },
      scene,
    );
    pole.position.set(0, 1.05, 0);
    pole.material = poleMat;
    pole.parent = sRoot;
    pole.isPickable = false;

    const pennantMat = new StandardMaterial(`pennant-mat-${spot.zone}-${spot.band}`, scene);
    const tex = pennantTexture(scene, color, spot.band);
    pennantMat.diffuseTexture = tex;
    pennantMat.specularColor = new Color3(0.03, 0.03, 0.03);
    pennantMat.backFaceCulling = false;
    pennantMats.push(pennantMat);
    const pennant = MeshBuilder.CreatePlane(
      `station-pad-${spot.zone}-${spot.band}`,
      { width: 0.86, height: 0.56 },
      scene,
    );
    pennant.position.set(0.44, 1.86, 0);
    pennant.rotation.y = spot.facing;
    pennant.material = pennantMat;
    pennant.parent = sRoot;
    pennant.isPickable = true; /* the flag is a tap target too */

    /* the light pillar — find me from the next hill */
    const pillar = MeshBuilder.CreateCylinder(
      `station-pillar-${spot.zone}-${spot.band}`,
      { diameterTop: 0.34, diameterBottom: 0.5, height: 13, tessellation: 10 },
      scene,
    );
    pillar.position.y = 6.5;
    pillar.material = pillarMat;
    pillar.parent = sRoot;
    pillar.isPickable = false;

    stations.push({ spot, root: sRoot, pad, padGlow, pillar, pennant, padMat, glowMat });
    zoneSet.add(spot.zone);
  }

  /* ---------- the acorn woods ---------- */
  const acornNodes = ACORN_SPOTS.map((a) => ({ spot: a, node: buildAcorn(scene, a.x, a.z) }));
  const collected = new Set<string>();

  let visibleZones: ReadonlySet<string> = new Set(zoneSet);

  /* stage 14 perf honesty: distance culling for the woods + the pads
     (the fog already hides everything past ~450u — drawing it is waste) */
  const ACORN_DRAW_RADIUS = 90;
  const STATION_DRAW_RADIUS = 260;

  return {
    refresh(unlockedZones: ReadonlySet<string>): void {
      visibleZones = unlockedZones;
      for (const s of stations) {
        const on = visibleZones.has(s.spot.zone);
        s.root.setEnabled(on);
      }
    },
    update(t, dt, px, pz): void {
      /* pads pulse softly, pennants wave, acorns bob — transforms only */
      const pulse = 1 + Math.sin(t * 2.4) * 0.07;
      for (const s of stations) {
        const show =
          visibleZones.has(s.spot.zone) &&
          Math.hypot(px - s.spot.x, pz - s.spot.z) < STATION_DRAW_RADIUS;
        if (s.root.isEnabled() !== show) s.root.setEnabled(show);
        if (!show) continue;
        s.padGlow.scaling.x = pulse;
        s.padGlow.scaling.z = pulse;
        s.pillar.visibility = 0.1 + Math.sin(t * 1.7 + s.spot.dist) * 0.035;
        s.pennant.rotation.y = s.spot.facing + Math.sin(t * 1.9 + s.spot.x) * 0.12;
      }
      for (const a of acornNodes) {
        const show =
          !collected.has(a.spot.id) &&
          Math.hypot(px - a.spot.x, pz - a.spot.z) < ACORN_DRAW_RADIUS;
        if (a.node.isEnabled() !== show) a.node.setEnabled(show);
        if (!show) continue;
        a.node.rotation.y = t * 0.8 + a.spot.x;
        a.node.position.y = terrainHeight(a.spot.x, a.spot.z) + Math.sin(t * 2.2 + a.spot.z) * 0.05;
      }
    },
    spots(project): ClearingSpot[] {
      const out: ClearingSpot[] = [];
      for (const s of stations) {
        if (!s.root.isEnabled()) continue;
        const p = project(new Vector3(s.spot.x, terrainHeight(s.spot.x, s.spot.z) + 0.1, s.spot.z));
        out.push({ zone: s.spot.zone, band: s.spot.band, x: p.x, y: p.y, on: p.on });
      }
      return out;
    },
    acornWithinReach(x, z, reach): { id: string } | null {
      for (const a of acornNodes) {
        if (!a.node.isEnabled()) continue;
        if (Math.hypot(x - a.spot.x, z - a.spot.z) <= reach) return { id: a.spot.id };
      }
      return null;
    },
    setCollectedAcorns(ids: ReadonlySet<string>): void {
      for (const id of ids) collected.add(id);
      for (const a of acornNodes) {
        if (collected.has(a.spot.id)) a.node.setEnabled(false);
      }
    },
    dispose(): void {
      root.dispose(false, true);
      for (const m of pennantMats) m.dispose();
      acornNutMat.dispose();
      acornCapMat.dispose();
      pillarMat.dispose();
      poleMat.dispose();
    },
  };
}
