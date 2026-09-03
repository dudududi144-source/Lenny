/* ============================================================
 * WorldIslands — the ten zone islands of the 3D garden (Stage 7,
 * commit 2). Low-poly, zero external assets.
 *
 * Every island = raised platform (category color from data/garden.ts)
 * + a hand-built low-poly marker that tells the zone's story:
 *
 *   light-path        glowing stone (the journey starts here)
 *   memory-hill       standing stone
 *   attention-stream  little boat platform
 *   thinking-forest   three low-poly trees
 *   space-sky         floating star (bobs forever)
 *   words-valley      big open book
 *   feelings-garden   giant flower
 *   creativity-meadow standing paintbrush
 *   rhythm-square     drum
 *   breath-pool       living water pool (shimmering)
 *
 * Locked zones are fog islands: platform alpha 0.5, a floating lock,
 * dimmed label — and the unlock state is read straight from the
 * untouched ProgressStore.isUnlocked(). When a gate opens in the
 * saved data, the fog lifts with a soft animation.
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
import { finishedCount, isUnlocked, type GardenData } from '../games/core/ProgressStore';
import { WORLD_ISLANDS, PATH_WIDTH, pathPoints } from './WorldLayout';

const MAX_BLOOM = 8;
const LOCKED_ALPHA = 0.5;

/* the breath-pool shimmer endpoints — module consts so the per-frame
   lerp writes straight into the material (zero allocations, forever) */
const POOL_EMI_A = Color3.FromHexString('#1d3a2a');
const POOL_EMI_B = Color3.FromHexString('#2f5a44');
/* label emissive states — hoisted so setNear never allocates */
const NEAR_LABEL_EMISSIVE = new Color3(0.3, 0.3, 0.12);
const LABEL_EMISSIVE_OFF = new Color3(0, 0, 0);

interface Bobber {
  mesh: Mesh;
  base: number;
  amp: number;
  speed: number;
}

interface IslandParts {
  zone: ZoneId;
  platformMat: StandardMaterial;
  markerMats: StandardMaterial[];
  labelMat: StandardMaterial;
  lock: Mesh;
  bobbers: Bobber[];
  unlocked: boolean;
  finished: number;
  flowers: Mesh[];
  growing: Array<{ mesh: Mesh; start: number }>;
}

/* ---------- color helpers ---------- */

/** Category color mixed toward meadow green — a garden, not candy. */
function islandTint(uiColor: string): Color3 {
  const c = Color3.FromHexString(uiColor);
  const green = Color3.FromHexString('#79c356');
  return Color3.Lerp(c, green, 0.34);
}

function darken(c: Color3, k: number): Color3 {
  return new Color3(c.r * k, c.g * k, c.b * k);
}

/* ---------- label + lock textures ---------- */

function labelTexture(scene: Scene, text: string): DynamicTexture {
  /* audit 9-b #4: niqqud marks were specks at 62px on 512px — bigger
     canvas + bigger glyphs + a dark rounded plate give the vowel marks
     the pixel room the mission depends on. */
  const w = 768;
  const hgt = 192;
  const tex = new DynamicTexture(`label-${text}`, { width: w, height: hgt }, scene, true);
  const draw = (): void => {
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, w, hgt);
    /* the font goes on BEFORE the plate measures the text (critic W14:
       measuring with the canvas default font mis-sized the plate) */
    ctx.font = '700 84px Heebo, "Segoe UI", Arial, sans-serif';
    /* rounded dark plate — the label separates from any sky/grass */
    const pw = Math.min(w - 24, w / 2 + ctx.measureText(text).width / 2 + 48);
    ctx.fillStyle = 'rgba(16, 32, 20, 0.62)';
    ctx.beginPath();
    const r = 36, px = (w - pw) / 2, py = 16, ph = hgt - 32;
    ctx.moveTo(px + r, py);
    ctx.arcTo(px + pw, py, px + pw, py + ph, r);
    ctx.arcTo(px + pw, py + ph, px, py + ph, r);
    ctx.arcTo(px, py + ph, px, py, r);
    ctx.arcTo(px, py, px + pw, py, r);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(20,40,24,0.9)';
    ctx.strokeText(text, w / 2, hgt / 2 + 4);
    ctx.fillStyle = '#fffdf4';
    ctx.fillText(text, w / 2, hgt / 2 + 4);
    tex.update();
  };
  draw();
  /* Hebrew with niqqud deserves the real webfont when it is ready */
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(draw);
  }
  tex.hasAlpha = true;
  return tex;
}

function lockTexture(scene: Scene): DynamicTexture {
  const size = 128;
  const tex = new DynamicTexture('lock-tex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,250,235,0.95)';
  ctx.fillStyle = 'rgba(40,48,44,0.55)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.42, size * 0.2, Math.PI, 0);
  ctx.stroke();
  const bw = size * 0.52;
  const bx = (size - bw) / 2;
  const by = size * 0.42;
  const bh = size * 0.36;
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,250,235,0.95)';
  ctx.beginPath();
  ctx.arc(size / 2, by + bh * 0.55, 5, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/* ---------- materials ---------- */

function mat(scene: Scene, name: string, color: Color3, emissive = 0): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.emissiveColor = color.scale(emissive);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  return m;
}

/* ---------- markers (one tiny scene per zone) ---------- */

function buildMarker(
  scene: Scene,
  zone: ZoneId,
  root: TransformNode,
): { mats: StandardMaterial[]; bobbers: Bobber[] } {
  const mats: StandardMaterial[] = [];
  const bobbers: Bobber[] = [];
  const add = (m: StandardMaterial): StandardMaterial => {
    mats.push(m);
    return m;
  };

  if (zone === 'light-path') {
    const stone = MeshBuilder.CreatePolyhedron('lp-stone', { type: 3, size: 0.34 }, scene);
    stone.position.y = 0.42;
    stone.material = add(mat(scene, 'lp-m', Color3.FromHexString('#ffd76a'), 0.85));
    stone.parent = root;
  } else if (zone === 'memory-hill') {
    const stone = MeshBuilder.CreateBox('mh-stone', { width: 0.55, height: 0.95, depth: 0.4 }, scene);
    stone.position.y = 0.55;
    stone.rotation.z = 0.09;
    stone.material = add(mat(scene, 'mh-m', Color3.FromHexString('#8a8fa3'), 0.06));
    stone.parent = root;
  } else if (zone === 'attention-stream') {
    const hull = MeshBuilder.CreateCylinder(
      'as-hull',
      { diameterTop: 0.95, diameterBottom: 0.6, height: 0.3, tessellation: 6 },
      scene,
    );
    hull.scaling.z = 1.5;
    hull.position.y = 0.18;
    const hullMat = add(mat(scene, 'as-hull-m', Color3.FromHexString('#b07a4a'), 0.04));
    hull.material = hullMat;
    hull.parent = root;
    const mast = MeshBuilder.CreateCylinder('as-mast', { diameter: 0.06, height: 1.05 }, scene);
    mast.position.set(0, 0.8, 0.1);
    mast.material = hullMat;
    mast.parent = root;
    const sail = MeshBuilder.CreatePlane('as-sail', { width: 0.62, height: 0.7 }, scene);
    sail.position.set(0.02, 0.95, -0.16);
    sail.rotation.y = Math.PI / 2;
    sail.rotation.x = -0.22;
    const sailMat = add(mat(scene, 'as-sail-m', Color3.FromHexString('#f4f1e6'), 0.12));
    sailMat.backFaceCulling = false;
    sail.material = sailMat;
    sail.parent = root;
  } else if (zone === 'thinking-forest') {
    const spots: Array<[number, number]> = [
      [-0.55, -0.2],
      [0.5, -0.45],
      [0.05, 0.5],
    ];
    spots.forEach(([x, z], i) => {
      const trunk = MeshBuilder.CreateCylinder(`tf-trunk-${i}`, { diameter: 0.16, height: 0.5 }, scene);
      trunk.position.set(x, 0.25, z);
      trunk.material = add(mat(scene, `tf-trunk-m-${i}`, Color3.FromHexString('#8a5a33'), 0.02));
      trunk.parent = root;
      const crown = MeshBuilder.CreateCylinder(
        `tf-crown-${i}`,
        { diameterTop: 0, diameterBottom: 0.75, height: 1.05, tessellation: 6 },
        scene,
      );
      crown.position.set(x, 0.95, z);
      crown.material = add(mat(scene, `tf-crown-m-${i}`, Color3.FromHexString('#3f8f4f'), 0.1));
      crown.parent = root;
    });
  } else if (zone === 'space-sky') {
    const star = MeshBuilder.CreatePolyhedron('ss-star', { type: 1, size: 0.3 }, scene);
    star.position.y = 1.55;
    star.material = add(mat(scene, 'ss-m', Color3.FromHexString('#cfa9ff'), 0.9));
    star.parent = root;
    bobbers.push({ mesh: star, base: 1.55, amp: 0.16, speed: 1.5 });
  } else if (zone === 'words-valley') {
    const base = MeshBuilder.CreateBox('wv-base', { width: 1.15, height: 0.14, depth: 0.8 }, scene);
    base.position.y = 0.1;
    base.material = add(mat(scene, 'wv-base-m', Color3.FromHexString('#8a5a33'), 0.02));
    base.parent = root;
    const pageMat = add(mat(scene, 'wv-page-m', Color3.FromHexString('#f7f2e2'), 0.12));
    const pageL = MeshBuilder.CreateBox('wv-page-l', { width: 0.52, height: 0.06, depth: 0.72 }, scene);
    pageL.position.set(-0.28, 0.22, 0);
    pageL.rotation.z = 0.22;
    pageL.material = pageMat;
    pageL.parent = root;
    const pageR = MeshBuilder.CreateBox('wv-page-r', { width: 0.52, height: 0.06, depth: 0.72 }, scene);
    pageR.position.set(0.28, 0.22, 0);
    pageR.rotation.z = -0.22;
    pageR.material = pageMat;
    pageR.parent = root;
  } else if (zone === 'feelings-garden') {
    const stem = MeshBuilder.CreateCylinder('fg-stem', { diameter: 0.11, height: 0.85 }, scene);
    stem.position.y = 0.42;
    stem.material = add(mat(scene, 'fg-stem-m', Color3.FromHexString('#3f8f4f'), 0.02));
    stem.parent = root;
    const head = MeshBuilder.CreateSphere(
      'fg-head',
      { diameterX: 1.05, diameterY: 0.42, diameterZ: 1.05, segments: 8 },
      scene,
    );
    head.position.y = 0.98;
    head.material = add(mat(scene, 'fg-head-m', Color3.FromHexString('#ff8bd4'), 0.4));
    head.parent = root;
    const heart = MeshBuilder.CreateSphere('fg-heart', { diameter: 0.34, segments: 6 }, scene);
    heart.position.y = 1.02;
    heart.material = add(mat(scene, 'fg-heart-m', Color3.FromHexString('#ffe9a6'), 0.55));
    heart.parent = root;
  } else if (zone === 'creativity-meadow') {
    const handle = MeshBuilder.CreateCylinder(
      'cm-handle',
      { diameterTop: 0.1, diameterBottom: 0.13, height: 1.0 },
      scene,
    );
    handle.position.y = 0.62;
    handle.material = add(mat(scene, 'cm-handle-m', Color3.FromHexString('#c98a4b'), 0.03));
    handle.parent = root;
    const ferrule = MeshBuilder.CreateCylinder('cm-ferrule', { diameter: 0.14, height: 0.12 }, scene);
    ferrule.position.y = 1.16;
    ferrule.material = add(mat(scene, 'cm-ferrule-m', Color3.FromHexString('#d9d9d9'), 0.08));
    ferrule.parent = root;
    const tip = MeshBuilder.CreateCylinder(
      'cm-tip',
      { diameterTop: 0.02, diameterBottom: 0.13, height: 0.28 },
      scene,
    );
    tip.position.y = 1.35;
    tip.material = add(mat(scene, 'cm-tip-m', Color3.FromHexString('#f2549a'), 0.45));
    tip.parent = root;
  } else if (zone === 'rhythm-square') {
    const body = MeshBuilder.CreateCylinder('rs-body', { diameter: 0.85, height: 0.6, tessellation: 14 }, scene);
    body.position.y = 0.32;
    body.material = add(mat(scene, 'rs-body-m', Color3.FromHexString('#a0522d'), 0.03));
    body.parent = root;
    const skin = MeshBuilder.CreateCylinder('rs-skin', { diameter: 0.88, height: 0.05, tessellation: 14 }, scene);
    skin.position.y = 0.64;
    skin.material = add(mat(scene, 'rs-skin-m', Color3.FromHexString('#f4ecd8'), 0.3));
    skin.parent = root;
  } else if (zone === 'breath-pool') {
    const rim = MeshBuilder.CreateTorus('bp-rim', { diameter: 1.5, thickness: 0.12, tessellation: 20 }, scene);
    rim.position.y = 0.1;
    rim.scaling.y = 0.45;
    rim.material = add(mat(scene, 'bp-rim-m', Color3.FromHexString('#9db8a0'), 0.04));
    rim.parent = root;
    const water = MeshBuilder.CreateCylinder('bp-water', { diameter: 1.42, height: 0.08, tessellation: 20 }, scene);
    water.position.y = 0.12;
    const shimmerMat = add(mat(scene, 'bp-water-m', Color3.FromHexString('#7fd4e8'), 0.5));
    water.material = shimmerMat;
    water.parent = root;
    bobbers.push({ mesh: water, base: 0.12, amp: 0.015, speed: 1.1 });
  }

  return { mats, bobbers };
}

/* ---------- bloom flowers (one per finished game, capped) ---------- */

const FLOWER_SIZE = 0.42;

/** A tiny painted flower: petals in the zone color, warm heart. */
function flowerTexture(scene: Scene, zone: ZoneId, uiColor: string): DynamicTexture {
  const size = 128;
  const tex = new DynamicTexture(`flower-${zone}`, { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  /* petals */
  ctx.fillStyle = uiColor;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * size * 0.2, cy + Math.sin(a) * size * 0.2, size * 0.16, size * 0.1, a, 0, Math.PI * 2);
    ctx.fill();
  }
  /* heart */
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

function flowerMat(scene: Scene, zone: ZoneId, uiColor: string): StandardMaterial {
  const tex = flowerTexture(scene, zone, uiColor);
  const m = new StandardMaterial(`flower-mat-${zone}`, scene);
  m.emissiveTexture = tex;
  m.opacityTexture = tex;
  m.opacityTexture.getAlphaFromRGB = false;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  m.backFaceCulling = false;
  return m;
}

/* ---------- the path ribbon ---------- */

function buildPathRibbon(scene: Scene): Mesh {
  const pts = pathPoints();
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const hw = PATH_WIDTH / 2;
    left.push(new Vector3(pts[i].x + nx * hw, 0.045, pts[i].z + nz * hw));
    right.push(new Vector3(pts[i].x - nx * hw, 0.045, pts[i].z - nz * hw));
  }
  const ribbon = MeshBuilder.CreateRibbon('garden-path', { pathArray: [left, right] }, scene);
  const m = new StandardMaterial('path-mat', scene);
  m.diffuseColor = Color3.FromHexString('#dfc894');
  m.specularColor = new Color3(0.02, 0.02, 0.02);
  m.alpha = 0.96;
  ribbon.material = m;
  ribbon.isPickable = false;
  return ribbon;
}

/* ---------- public handle ---------- */

export interface ZoneWorldState {
  id: string;
  unlocked: boolean;
  bloom: number;
}

export interface IslandsHandle {
  refresh(data: GardenData, grewZones?: ReadonlySet<string>): void;
  /** The platform mesh of a zone (for shadows). */
  platformMesh(zone: ZoneId): Mesh | null;
  zones(): ZoneWorldState[];
  setNear(zone: ZoneId | null): void;
  islandTopY(): number;
  dispose(): void;
}

export function buildIslands(scene: Scene): IslandsHandle {
  const islandsRoot = new TransformNode('islands-root', scene);
  const ribbon = buildPathRibbon(scene);
  ribbon.parent = islandsRoot;

  const lockTex = lockTexture(scene);
  const lockMat = new StandardMaterial('lock-mat', scene);
  lockMat.emissiveTexture = lockTex;
  lockMat.opacityTexture = lockTex;
  lockMat.opacityTexture.getAlphaFromRGB = false;
  lockMat.diffuseColor = Color3.Black();
  lockMat.specularColor = Color3.Black();
  lockMat.disableLighting = true;
  lockMat.backFaceCulling = false;

  const flowerMats: StandardMaterial[] = [];
  const platformMeshes = new Map<ZoneId, Mesh>();
  const parts: IslandParts[] = ZONES.map((zoneDef, i) => {
    const place = WORLD_ISLANDS[i];
    const root = new TransformNode(`island-${zoneDef.id}`, scene);
    root.position.set(place.x, 0, place.z);
    root.parent = islandsRoot;

    const tint = islandTint(zoneDef.uiColor);
    const platformMat = new StandardMaterial(`plat-${zoneDef.id}`, scene);
    platformMat.diffuseColor = tint;
    platformMat.specularColor = new Color3(0.04, 0.05, 0.04);

    const platform = MeshBuilder.CreateCylinder(
      `plat-mesh-${zoneDef.id}`,
      { diameter: place.radius * 2, height: 0.6, tessellation: 26 },
      scene,
    );
    platform.position.y = 0.3;
    platform.material = platformMat;
    platform.parent = root;
    platform.isPickable = true;
    platform.receiveShadows = true;
    platformMeshes.set(zoneDef.id, platform);

    const rim = MeshBuilder.CreateTorus(
      `rim-${zoneDef.id}`,
      { diameter: place.radius * 2 + 0.24, thickness: 0.14, tessellation: 26 },
      scene,
    );
    rim.position.y = 0.56;
    rim.scaling.y = 0.5;
    const rimMat = new StandardMaterial(`rim-mat-${zoneDef.id}`, scene);
    rimMat.diffuseColor = darken(tint, 0.72);
    rimMat.specularColor = new Color3(0.02, 0.02, 0.02);
    rim.material = rimMat;
    rim.parent = root;
    rim.isPickable = false;

    const marker = buildMarker(scene, zoneDef.id, root);
    const flowerMaterial = flowerMat(scene, zoneDef.id, zoneDef.uiColor);
    flowerMats.push(flowerMaterial);

    const labelMat = new StandardMaterial(`label-mat-${zoneDef.id}`, scene);
    const labelTex = labelTexture(scene, zoneDef.name);
    labelMat.emissiveTexture = labelTex;
    labelMat.opacityTexture = labelTex;
    labelMat.opacityTexture.getAlphaFromRGB = false;
    labelMat.diffuseColor = Color3.Black();
    labelMat.specularColor = Color3.Black();
    labelMat.disableLighting = true;
    labelMat.backFaceCulling = false;
    const label = MeshBuilder.CreatePlane(`label-${zoneDef.id}`, { width: 2.4, height: 0.6 }, scene);
    label.position.set(0, 2.55, 0);
    label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    label.material = labelMat;
    label.parent = root;
    label.isPickable = false;

    const lock = MeshBuilder.CreatePlane(`lock-${zoneDef.id}`, { width: 0.85, height: 0.85 }, scene);
    lock.position.set(0, 1.55, 0);
    lock.billboardMode = Mesh.BILLBOARDMODE_ALL;
    lock.material = lockMat;
    lock.parent = root;
    lock.isPickable = true;
    lock.setEnabled(false);

    const flowers: Mesh[] = [];
    for (let i = 0; i < MAX_BLOOM; i++) {
      const f = MeshBuilder.CreatePlane(`flower-${zoneDef.id}-${i}`, { size: FLOWER_SIZE }, scene);
      f.material = flowerMaterial;
      f.rotation.x = -Math.PI / 2;
      const a = i * 2.39996;
      const rr = 0.45 + (i % 4) * 0.34;
      f.position.set(Math.cos(a) * rr, 0.64, Math.sin(a) * rr);
      f.parent = root;
      f.isPickable = false;
      f.setEnabled(false);
      f.scaling.setAll(0.001);
      flowers.push(f);
    }

    return {
      zone: zoneDef.id,
      platformMat,
      markerMats: [...marker.mats, rimMat],
      labelMat,
      lock,
      bobbers: marker.bobbers,
      unlocked: true,
      finished: 0,
      flowers,
      growing: [],
    };
  });

  /* the shimmer pool is found once at build time — never per frame */
  const poolPart = parts.find((p) => p.zone === 'breath-pool') ?? null;

  /* ---------- per-frame life + fog tweens ---------- */

  interface Tween {
    mat: StandardMaterial;
    from: number;
    to: number;
    start: number;
    dur: number;
  }
  const tweens: Tween[] = [];
  const baseEmissive = new Map<StandardMaterial, Color3>();
  for (const p of parts) for (const m of p.markerMats) baseEmissive.set(m, m.emissiveColor.clone());

  let near: ZoneId | null = null;

  const sceneObs = scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    for (const p of parts) {
      for (const b of p.bobbers) {
        b.mesh.position.y = b.base + Math.sin(t * b.speed * 2) * b.amp;
      }
    }
    /* the breath-pool water shimmers (one material, tiny cost, zero
       allocations — the lerp writes straight into the material) */
    if (poolPart) {
      const k = (Math.sin(t * 1.3) + 1) / 2;
      const emi = poolPart.platformMat.emissiveColor;
      emi.r = POOL_EMI_A.r + (POOL_EMI_B.r - POOL_EMI_A.r) * k;
      emi.g = POOL_EMI_A.g + (POOL_EMI_B.g - POOL_EMI_A.g) * k;
      emi.b = POOL_EMI_A.b + (POOL_EMI_B.b - POOL_EMI_A.b) * k;
    }
    const now = performance.now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, (now - tw.start) / tw.dur);
      const e = 1 - Math.pow(1 - k, 2.2); /* ease-out */
      tw.mat.alpha = tw.from + (tw.to - tw.from) * e;
      if (k >= 1) tweens.splice(i, 1);
    }
    /* bloom-in: the new flowers open with a springy 1.2s grow */
    for (const p of parts) {
      for (let i = p.growing.length - 1; i >= 0; i--) {
        const g = p.growing[i];
        const k = Math.min(1, (now - g.start) / 1200);
        const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); /* ease-out-back */
        g.mesh.scaling.setAll(Math.max(0.001, back));
        if (k >= 1) {
          g.mesh.scaling.setAll(1);
          p.growing.splice(i, 1);
        }
      }
    }
  });

  function applyLock(p: IslandParts, locked: boolean, animate: boolean): void {
    const now = performance.now();
    const targetAlpha = locked ? LOCKED_ALPHA : 1;
    const from = p.platformMat.alpha;
    if (animate && Math.abs(from - targetAlpha) > 0.01) {
      tweens.push({ mat: p.platformMat, from, to: targetAlpha, start: now, dur: 1200 });
      tweens.push({ mat: p.labelMat, from: p.labelMat.alpha, to: locked ? 0.45 : 1, start: now, dur: 1200 });
    } else {
      p.platformMat.alpha = targetAlpha;
      p.labelMat.alpha = locked ? 0.45 : 1;
    }
    for (const m of p.markerMats) {
      const base = baseEmissive.get(m)!;
      m.emissiveColor = locked ? base.scale(0.12) : base;
      m.alpha = locked ? 0.62 : 1;
    }
    p.lock.setEnabled(locked);
  }

  return {
    refresh(data: GardenData, grewZones?: ReadonlySet<string>): void {
      const now = performance.now();
      for (const p of parts) {
        const unlocked = isUnlocked(data, p.zone);
        const prevFinished = p.finished;
        p.finished = finishedCount(data, p.zone);
        if (unlocked !== p.unlocked) {
          applyLock(p, !unlocked, true); /* the fog lifts softly */
          p.unlocked = unlocked;
        }
        /* bloom field: one open flower per finished game (capped);
           newly-grown ones open with the payoff animation */
        const count = p.unlocked ? Math.min(p.finished, MAX_BLOOM) : 0;
        for (let i = 0; i < p.flowers.length; i++) {
          const want = i < count;
          if (want && !p.flowers[i].isEnabled()) {
            p.flowers[i].setEnabled(true);
            const grew = grewZones?.has(p.zone) === true && p.finished > prevFinished;
            if (grew) p.growing.push({ mesh: p.flowers[i], start: now + i * 130 });
            else p.flowers[i].scaling.setAll(1);
          } else if (!want && p.flowers[i].isEnabled()) {
            p.flowers[i].setEnabled(false);
            p.flowers[i].scaling.setAll(0.001);
          }
        }
      }
    },
    zones(): ZoneWorldState[] {
      return parts.map((p) => ({
        id: p.zone,
        unlocked: p.unlocked,
        bloom: Math.min(p.finished, MAX_BLOOM),
      }));
    },
    platformMesh(zone: ZoneId): Mesh | null {
      return platformMeshes.get(zone) ?? null;
    },
    setNear(zone: ZoneId | null): void {
      if (zone === near) return;
      near = zone;
      for (const p of parts) {
        p.labelMat.emissiveColor = p.zone === zone ? NEAR_LABEL_EMISSIVE : LABEL_EMISSIVE_OFF;
      }
    },
    islandTopY: () => 0.6,
    dispose(): void {
      scene.onBeforeRenderObservable.remove(sceneObs);
      islandsRoot.dispose(false, true);
      lockMat.dispose();
      for (const p of parts) {
        p.platformMat.dispose();
        p.labelMat.dispose();
        for (const m of p.markerMats) m.dispose();
      }
      lockTex.dispose();
      for (const m of flowerMats) m.dispose();
    },
  };
}
