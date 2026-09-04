/* ============================================================
 * WorldFlora — the continent breathes (stage 14, the graphics pass).
 *
 * The owner asked for "מקצועי יותר בגרפיקה". What made the world
 * read as a prototype was the BARENESS between the places: miles of
 * flat painted ground with nothing living on it. This module adds,
 * all from painted textures (zero assets, the garden's law):
 *
 *   - CLOUDS: ten soft billboards drifting high over the continent,
 *     giving the sky depth and the walker a sense of scale
 *   - GRASS TUFTS: ~640 little cross-planes scattered over every
 *     walkable acre (rejection-sampled off the roads and places)
 *   - WILD FLOWERS: ~260 tiny color-popped quads in three tints
 *
 * All static geometry goes through THIN INSTANCES — six draw calls
 * total, nothing per frame but the clouds' slow drift (transforms
 * only, zero allocations). The fps governor's budget stays intact.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { mulberry32 } from './worldAcorns';
import { LANDMARKS, WORLD_ISLANDS } from './WorldLayout';
import { STATIONS } from './WorldStations';
import { nearestRegion, REGION_ROADS, terrainHeight } from './WorldRegions';

/* ---------- painted textures ---------- */

function grassTexture(scene: Scene): DynamicTexture {
  const s = 64;
  const tex = new DynamicTexture('flora-grass-tex', { width: s, height: s }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, s, s);
  /* three blades rising from the base */
  const blade = (x: number, lean: number, h: number, w: number): void => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - w, s);
    ctx.quadraticCurveTo(x - w + lean * 0.4, s - h * 0.55, x + lean, s - h);
    ctx.quadraticCurveTo(x + w + lean * 0.4, s - h * 0.55, x + w, s);
    ctx.closePath();
    ctx.fill();
  };
  blade(20, -7, 40, 4.5);
  blade(32, 2, 52, 5);
  blade(44, 8, 36, 4.5);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

function flowerTexture(scene: Scene): DynamicTexture {
  const s = 48;
  const tex = new DynamicTexture('flora-flower-tex', { width: s, height: s }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2;
  const cy = s / 2;
  /* white petals — the instance color tints them */
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 8, 5.5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe9a6';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

function cloudTexture(scene: Scene): DynamicTexture {
  const w = 256;
  const h = 128;
  const tex = new DynamicTexture('flora-cloud-tex', { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const paint = (tint: string): void => {
    ctx.clearRect(0, 0, w, h);
    const puff = (x: number, y: number, r: number): void => {
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, `${tint}eb`); /* 0.92 alpha */
      g.addColorStop(1, `${tint}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    puff(90, 78, 44);
    puff(128, 62, 54);
    puff(168, 80, 40);
    puff(116, 88, 36);
    tex.update();
  };
  paint('#ffffff');
  tex.hasAlpha = true;
  (tex as DynamicTexture & { repaint?: (t: string) => void }).repaint = paint;
  return tex;
}

/* ---------- placement (pure, deterministic) ---------- */

interface FloraSpot {
  x: number;
  z: number;
  rot: number;
  scale: number;
}

const FLOWER_TINTS: Color4[] = [
  new Color4(1, 0.62, 0.72, 1), /* rose */
  new Color4(1, 0.86, 0.45, 1), /* honey */
  new Color4(0.68, 0.9, 0.62, 1), /* meadow */
];

function roadDist(x: number, z: number): number {
  let best = Infinity;
  for (const road of REGION_ROADS) {
    for (const p of road.points) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < best) best = d;
    }
  }
  return best;
}

/** A spot clear of everything the child walks through (roads, places, pads). */
function clearSpot(x: number, z: number, minRoad: number): boolean {
  if (roadDist(x, z) < minRoad) return false;
  for (const l of LANDMARKS) {
    if (Math.hypot(x - l.x, z - l.z) < l.keep + 0.7) return false;
  }
  for (const p of WORLD_ISLANDS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius + 0.8) return false;
  }
  for (const s of STATIONS) {
    if (Math.hypot(x - s.x, z - s.z) < 1.6) return false;
  }
  return true;
}

function scatter(count: number, seed: number, rMin: number, rMax: number, minRoad: number, guard: number): FloraSpot[] {
  const rng = mulberry32(seed);
  const out: FloraSpot[] = [];
  let tries = 0;
  while (out.length < count && tries < guard) {
    tries++;
    const a = rng() * Math.PI * 2;
    const r = rMin + rng() * (rMax - rMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearSpot(x, z, minRoad)) continue;
    out.push({ x, z, rot: rng() * Math.PI, scale: 0.75 + rng() * 0.7 });
  }
  return out;
}

/* ---------- the handle ---------- */

export interface FloraHandle {
  /** Per-frame drift for the clouds (transforms only). */
  update(t: number, dt: number): void;
  /** Hour tint for the clouds (standard+; null restores the white sky of weak). */
  setCloudTint(hex: string | null): void;
  /** standard+ decorations: the high parallax cloud layer. Weak = today's sky.
   *  (stage 16-c — instant off on a tier drop.) */
  setAtmosphere(on: boolean): void;
  dispose(): void;
}

export function buildFlora(scene: Scene): FloraHandle {
  const root = new TransformNode('flora-root', scene);

  /* ---------- clouds ---------- */
  const cloudTex = cloudTexture(scene);
  const cloudMat = new StandardMaterial('flora-cloud-mat', scene);
  cloudMat.emissiveTexture = cloudTex;
  cloudMat.opacityTexture = cloudTex;
  cloudMat.opacityTexture.getAlphaFromRGB = false;
  cloudMat.diffuseColor = Color3.Black();
  cloudMat.specularColor = Color3.Black();
  cloudMat.disableLighting = true;
  cloudMat.backFaceCulling = false;
  cloudMat.alpha = 0.88;

  const cloudRng = mulberry32(0xc10);
  const clouds: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const w = 26 + cloudRng() * 34;
    const c = MeshBuilder.CreatePlane(`flora-cloud-${i}`, { width: w, height: w * 0.42 }, scene);
    const a = cloudRng() * Math.PI * 2;
    const r = 60 + cloudRng() * 260;
    c.position.set(Math.cos(a) * r, 62 + cloudRng() * 34, Math.sin(a) * r);
    c.billboardMode = Mesh.BILLBOARDMODE_ALL;
    c.material = cloudMat;
    c.isPickable = false;
    c.parent = root;
    clouds.push(c);
  }

  /* ---------- the high parallax layer (standard+, 16-c) ----------
     A second deck of broad, fainter streaks sailing ~60u HIGHER and
     visibly FASTER than the lower deck — two depths, so the sky
     finally reads as volume instead of a wallpaper of puffs. Same
     texture (one repaint tints both decks), one extra material, no
     per-frame allocation. Weak never builds it: EXACTLY today's sky. */
  const cloudHighMat = new StandardMaterial('flora-cloud-high-mat', scene);
  cloudHighMat.emissiveTexture = cloudTex;
  cloudHighMat.opacityTexture = cloudTex;
  cloudHighMat.opacityTexture.getAlphaFromRGB = false;
  cloudHighMat.diffuseColor = Color3.Black();
  cloudHighMat.specularColor = Color3.Black();
  cloudHighMat.disableLighting = true;
  cloudHighMat.backFaceCulling = false;
  cloudHighMat.alpha = 0.52;

  const highClouds: Mesh[] = [];
  const highRng = mulberry32(0xc11);
  for (let i = 0; i < 7; i++) {
    const w = 54 + highRng() * 44;
    const c = MeshBuilder.CreatePlane(`flora-cloud-high-${i}`, { width: w, height: w * 0.34 }, scene);
    const a = highRng() * Math.PI * 2;
    const r = 70 + highRng() * 290;
    c.position.set(Math.cos(a) * r, 122 + highRng() * 30, Math.sin(a) * r);
    c.billboardMode = Mesh.BILLBOARDMODE_ALL;
    c.material = cloudHighMat;
    c.isPickable = false;
    c.parent = root;
    c.setEnabled(false); /* the boot tier is weak — the sky starts as it was */
    highClouds.push(c);
  }

  /* ---------- grass tufts (one master, thin instances) ---------- */
  const grassTex = grassTexture(scene);
  const grassMat = new StandardMaterial('flora-grass-mat', scene);
  grassMat.diffuseTexture = grassTex;
  grassMat.opacityTexture = grassTex;
  grassMat.opacityTexture.getAlphaFromRGB = false;
  grassMat.emissiveColor = new Color3(0.12, 0.16, 0.1);
  grassMat.specularColor = new Color3(0.02, 0.03, 0.02);
  grassMat.backFaceCulling = false;
  grassMat.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
  grassMat.alphaCutOff = 0.45;

  const tufts = scatter(640, 0xf100d, 13, 296, 2.1, 9000);
  const grassMaster = MeshBuilder.CreatePlane('flora-grass-master', { width: 0.9, height: 0.62 }, scene);
  grassMaster.material = grassMat;
  grassMaster.parent = root;
  grassMaster.isPickable = false;
  {
    const matrices: Float32Array = new Float32Array(tufts.length * 16);
    tufts.forEach((s, i) => {
      const y = terrainHeight(s.x, s.z);
      const m = Matrix.Compose(
        new Vector3(s.scale, s.scale, s.scale),
        /* a crossed pair reads from every side without doubling the count */
        Quaternion.RotationYawPitchRoll(s.rot, 0, 0),
        new Vector3(s.x, y + 0.28 * s.scale, s.z),
      );
      m.copyToArray(matrices, i * 16);
    });
    grassMaster.thinInstanceSetBuffer('matrix', matrices, 16, true);
    grassMaster.thinInstanceRefreshBoundingInfo();
  }

  /* ---------- wild flowers (one master, tinted thin instances) ----------
     Stage 15-D: tints are REGION-FLAVORED — near a named region the
     flowers lean toward that region's tint (read through the public
     WorldRegions API, so unknown ids can never break this), falling
     back to the classic three tints in the hub meadow. */
  const flowerTex = flowerTexture(scene);
  const flowerMat = new StandardMaterial('flora-flower-mat', scene);
  flowerMat.diffuseTexture = flowerTex;
  flowerMat.opacityTexture = flowerTex;
  flowerMat.opacityTexture.getAlphaFromRGB = false;
  flowerMat.emissiveColor = new Color3(0.1, 0.1, 0.08);
  flowerMat.specularColor = new Color3(0.02, 0.02, 0.02);
  flowerMat.backFaceCulling = false;
  flowerMat.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
  flowerMat.alphaCutOff = 0.45;

  const flowers = scatter(260, 0xf10b2, 15, 250, 2.4, 9000);
  const flowerMaster = MeshBuilder.CreatePlane('flora-flower-master', { width: 0.42, height: 0.42 }, scene);
  flowerMaster.material = flowerMat;
  flowerMaster.parent = root;
  flowerMaster.isPickable = false;
  {
    const matrices: Float32Array = new Float32Array(flowers.length * 16);
    const colors: Float32Array = new Float32Array(flowers.length * 4);
    const rng = mulberry32(0xf10b3);
    flowers.forEach((s, i) => {
      const y = terrainHeight(s.x, s.z);
      const m = Matrix.Compose(
        new Vector3(s.scale, s.scale, s.scale),
        Quaternion.RotationYawPitchRoll(s.rot, 0, 0),
        new Vector3(s.x, y + 0.2 * s.scale, s.z),
      );
      m.copyToArray(matrices, i * 16);
      const tint = FLOWER_TINTS[Math.floor(rng() * FLOWER_TINTS.length)];
      const near = nearestRegion(s.x, s.z, 340);
      let r = tint.r;
      let g = tint.g;
      let b = tint.b;
      if (near) {
        /* a 45% lean toward the region's hue — flavored, not uniform */
        const rc = Color3.FromHexString(near.region.tint);
        r = r + (rc.r - r) * 0.45;
        g = g + (rc.g - g) * 0.45;
        b = b + (rc.b - b) * 0.45;
      }
      colors[i * 4] = r;
      colors[i * 4 + 1] = g;
      colors[i * 4 + 2] = b;
      colors[i * 4 + 3] = tint.a;
    });
    flowerMaster.thinInstanceSetBuffer('matrix', matrices, 16, true);
    flowerMaster.thinInstanceSetBuffer('color', colors, 4, true);
    flowerMaster.thinInstanceRefreshBoundingInfo();
    flowerMaster.useVertexColors = true;
  }

  /* the hour's cloud tint (null = the historical white) — a repaint
     only when the tint actually changes, never per frame */
  let cloudTint: string | null = null;

  return {
    update(t, dt) {
      /* the clouds drift east, very slowly — transforms only */
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.position.x += dt * (1.1 + (i % 3) * 0.35);
        if (c.position.x > 340) c.position.x = -340;
        c.rotation.z = Math.sin(t * 0.1 + i) * 0.02;
      }
      /* the high deck: same drift, ~2.4x the speed — the parallax */
      for (let i = 0; i < highClouds.length; i++) {
        const c = highClouds[i];
        if (!c.isEnabled()) continue;
        c.position.x += dt * (2.6 + (i % 3) * 0.5);
        if (c.position.x > 420) c.position.x = -420;
        c.rotation.z = Math.sin(t * 0.13 + i * 1.7) * 0.03;
      }
    },
    setCloudTint(hex: string | null): void {
      if (hex === cloudTint) return;
      cloudTint = hex;
      const paint = (cloudTex as DynamicTexture & { repaint?: (t: string) => void }).repaint;
      paint?.(hex ?? '#ffffff');
    },
    setAtmosphere(on: boolean): void {
      for (const c of highClouds) c.setEnabled(on);
    },
    dispose(): void {
      root.dispose(false, true);
      cloudMat.dispose();
      cloudHighMat.dispose();
      cloudTex.dispose();
      grassMat.dispose();
      grassTex.dispose();
      flowerMat.dispose();
      flowerTex.dispose();
    },
  };
}
