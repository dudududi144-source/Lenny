/* ============================================================
 * WorldRegions — the continent beyond the garden (stage 12, 14-C).
 *
 * STAGE 11 built a journey-scale garden ring. The owner's verdict:
 * still condensed — "השביל מכונס בתוך עצמו" (the path folds into
 * itself). STAGE 12 opened the world. STAGE 14-C made it VAST —
 * the owner asked five times and got incremental nudges; this is
 * the real one:
 *
 *   - SIX named REGIONS 340–450 units out (radii 112–130): each is
 *     a DESTINATION with an interior worth exploring — its own gate
 *     on a real road, its own scenery palette, landmarks, friends.
 *   - The zone ISLANDS (the game stages) live inside the regions —
 *     reaching the next stage is a JOURNEY now, with a road,
 *     signposts and a compass (Croc-style stage geography).
 *   - TERRAIN: gentle rolling hills rise beyond the flat garden,
 *     and a river carves its valley through the river region —
 *     the walker's ground height follows the land.
 *   - VISTA: a mountain silhouette ring on the horizon and slow
 *     drifting clouds, so the world reads BIG from anywhere.
 *
 * Pure math first (unit-pinned), Babylon rendering second. This
 * module imports nothing from WorldLayout — the dependency points
 * one way (WorldLayout → here) so the geometry stays honest.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Scene } from '@babylonjs/core/scene';
import { mulberry32 } from '../audio/MusicEngine';

const hex = (s: string): Color3 => Color3.FromHexString(s);

/* ============================================================
 * THE PURE HALF — every number here is unit-pinned.
 * ============================================================ */

export type RegionId = 'forest' | 'snow' | 'river' | 'flower' | 'dunes' | 'rocky';

export interface RegionDef {
  id: RegionId;
  name: string; /* Hebrew with niqqud — the road sign + the discovery plate */
  line: string; /* Lenny's first-arrival line */
  x: number;
  z: number;
  radius: number;
  /** painted-patch tint on the ground + the gate flag */
  tint: string;
}

/** The six regions of the continent — ~60° apart, 340–450 units out
 *  (stage 14-C: regions are DESTINATIONS now, patches with interiors). */
export const REGIONS: RegionDef[] = [
  {
    id: 'forest',
    name: 'יַעַר הַקְּסָמִים',
    line: 'יַעַר הַקְּסָמִים! הַצֵּל הַצִּנּוֹן וְהַפְּטְרִיּוֹת — כָּאן מִתְחַבֵּא כָּל מִינֵי קְסָמִים.',
    x: -330,
    z: -290,
    radius: 130,
    tint: '#2f6b3f',
  },
  {
    id: 'snow',
    name: 'אֶרֶץ הַשֶּׁלֶג',
    line: 'אֶרֶץ הַשֶּׁלֶג! רְכּוּת, קוֹר, וְנַחַת רַגְלַיִם שֶׁל שְׁתִיקָה לְבֵנָה.',
    x: -335,
    z: 90,
    radius: 118,
    tint: '#e6eef5',
  },
  {
    id: 'river',
    name: 'עֵמֶק הַנָּהָר',
    line: 'עֵמֶק הַנָּהָר! הַמַּיִם יוֹדְעִים אֶת הַדֶּרֶךְ — הֵם שָׁרִים בַּדֶּרֶךְ.',
    x: -100,
    z: 390,
    radius: 122,
    tint: '#4b97ad',
  },
  {
    id: 'flower',
    name: 'גִּבְעוֹת הַפְּרָחִים',
    line: 'גִּבְעוֹת הַפְּרָחִים! כָּל גִּבְעָה בְּצֶבַע אַחֵר — תִּפְתְּחוּ אֶת הָעֵינַיִם.',
    x: 195,
    z: 395,
    radius: 122,
    tint: '#d97fae',
  },
  {
    id: 'dunes',
    name: 'דְּיוּנוֹת הַחוֹל',
    line: 'דְּיוּנוֹת הַחוֹל! הָרוּחַ מְצַיֶּרֶת פֹּה גַּלִּים חֲדָשִׁים כָּל יוֹם.',
    x: 350,
    z: 150,
    radius: 112,
    tint: '#e3c184',
  },
  {
    id: 'rocky',
    name: 'הַרֵי הַסֶּלַע',
    line: 'הַרֵי הַסֶּלַע! אֲבָנִים עַתִּיקוֹת שׁוֹמְרוֹת פֹּה סוֹדִים יְשָׁנִים.',
    x: 370,
    z: -245,
    radius: 126,
    tint: '#93907f',
  },
];

export function regionById(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id)!;
}

/** The region whose painted patch contains the point (or null). */
export function regionAt(x: number, z: number): RegionDef | null {
  for (const r of REGIONS) {
    if (Math.hypot(x - r.x, z - r.z) <= r.radius) return r;
  }
  return null;
}

/** The nearest region within `maxDist` of the point's patch edge (or null). */
export function nearestRegion(x: number, z: number, maxDist: number): { region: RegionDef; dist: number } | null {
  let best: { region: RegionDef; dist: number } | null = null;
  for (const r of REGIONS) {
    const d = Math.max(0, Math.hypot(x - r.x, z - r.z) - r.radius);
    if (d <= maxDist && (best === null || d < best.dist)) best = { region: r, dist: d };
  }
  return best;
}

/* ---------- terrain: the land itself (pure) ---------- */

/**
 * The ground height of the continent.
 *   - The hub garden (r < 148) stays FLAT — the stage-11 world never moves.
 *   - Rolling hills rise smoothly between 148 and 210 (smoothstep ramp).
 *     14-C: the hill FIELDS are broader than stage 12 (a continent has
 *     broad shoulders, and the coarse ground mesh follows them better).
 *   - The river carves a soft valley along its spline (depth ~2.9 at the
 *     center line, gaussian falloff), gated by the same ramp.
 * Continuity is unit-pinned: the fox never meets a cliff.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < 148) return 0;
  /* smoothstep ramp 148 → 210 */
  const k = Math.max(0, Math.min(1, (r - 148) / 62));
  const ramp = k * k * (3 - 2 * k);

  const hills =
    2.4 * Math.sin(x * 0.012 + 0.8) * Math.cos(z * 0.011 - 0.4) +
    1.5 * Math.sin(x * 0.023) * Math.sin(z * 0.02 + 1.2) +
    0.8 * Math.sin((x + z) * 0.007);

  /* river valley: distance to the river's control polyline (dense enough
     for a soft carve — the worst seam error between controls is tiny) */
  let dRiver = Infinity;
  for (const p of RIVER_CONTROL) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < dRiver) dRiver = d;
  }
  const carve = 2.9 * Math.exp(-(dRiver * dRiver) / 110) - 0.18;

  return ramp * (hills - Math.max(0, carve));
}

/** Water surface of the river (the ribbon sits in the carved valley). */
export const RIVER_WATER_Y = -1.15;

/** The river's control polyline — enters from the far north, flows
    through the river region (beside its heart, so the road's end
    stays dry), and fades out toward the hub ramp. */
export const RIVER_CONTROL: Array<{ x: number; z: number }> = [
  { x: 30, z: 620 },
  { x: -20, z: 545 },
  { x: -62, z: 462 },
  { x: -72, z: 388 },
  { x: -52, z: 320 },
  { x: -20, z: 262 },
  { x: 4, z: 224 },
];

/** Sampled river polyline (Catmull-Rom, 10 per segment) — the water ribbon. */
export function riverPoints(): Array<{ x: number; z: number }> {
  return catmullRom(RIVER_CONTROL, 10);
}

/* ---------- roads: the hub is connected to every region (pure) ---------- */

export interface RegionRoad {
  region: RegionId;
  /** gate arch placement — where the road enters the region's patch */
  gate: { x: number; z: number; facing: number };
  /** sampled polyline hub-ring → gate → region heart (Catmull-Rom) */
  points: Array<{ x: number; z: number }>;
}

/** Road control points for one region: hub ring → two wiggled mids → gate → heart. */
function roadControl(region: RegionDef): Array<{ x: number; z: number }> {
  const dist = Math.hypot(region.x, region.z);
  const theta = Math.atan2(region.z, region.x);
  const toHubX = -region.x / dist;
  const toHubZ = -region.z / dist;
  /* per-region wiggle so the six roads never read as bare spokes */
  const wig: Record<RegionId, [number, number]> = {
    forest: [-0.09, 0.05],
    snow: [-0.08, 0.05],
    river: [0.1, -0.06],
    flower: [-0.09, 0.05],
    dunes: [0.08, -0.05],
    rocky: [0.08, -0.06],
  };
  const [w1, w2] = wig[region.id];
  const start = { x: Math.cos(theta) * 56, z: Math.sin(theta) * 56 };
  const mid1 = { x: Math.cos(theta + w1) * (dist * 0.45), z: Math.sin(theta + w1) * (dist * 0.45) };
  const mid2 = { x: Math.cos(theta + w2) * (dist * 0.78), z: Math.sin(theta + w2) * (dist * 0.78) };
  const gate = { x: region.x + toHubX * region.radius, z: region.z + toHubZ * region.radius };
  const heart = { x: region.x, z: region.z };
  return [start, mid1, mid2, gate, heart];
}

/** Deterministic region roads (built once, consumed by render + tests). */
export const REGION_ROADS: RegionRoad[] = REGIONS.map((region) => {
  const ctrl = roadControl(region);
  const points = catmullRom(ctrl, 12);
  const gatePt = ctrl[3];
  const prev = ctrl[2];
  return {
    region: region.id,
    gate: { x: gatePt.x, z: gatePt.z, facing: Math.atan2(region.z - prev.z, region.x - prev.x) },
    points,
  };
});

export function roadOf(region: RegionId): RegionRoad {
  return REGION_ROADS.find((r) => r.region === region)!;
}

/** Walking distance in child steps from the hub ring to a region's heart. */
export function regionSteps(region: RegionId): number {
  const pts = roadOf(region).points;
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return Math.max(8, Math.round(d * 1.2));
}

/* ---------- small pure spline (self-contained: no WorldLayout import) ---------- */

function catmullRom(points: Array<{ x: number; z: number }>, perSeg: number): Array<{ x: number; z: number }> {
  if (points.length < 2) return [...points];
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        z:
          0.5 *
          (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/* ============================================================
 * THE RENDER HALF — patches, gates, region scenery, vista.
 * ============================================================ */

/** Stable seed per region (render determinism). */
function regionSeed(id: RegionId): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface RegionsHandle {
  /** per-frame: cull far region scenery, drift the clouds. No allocs. */
  update(t: number, dt: number, px: number, pz: number): void;
  /** world anchors of the region name plates (the shell projects them) */
  plateAnchors(): Array<{ id: RegionId; x: number; z: number }>;
  dispose(): void;
}

/** How far from the walker a region stays visible (draw-call stewardship).
 *  14-C: raised 155 → 330 — distant regions must SILHOUETTE on the
 *  horizon; that is what makes a world read vast. */
const REGION_VISIBILITY = 330;

interface BuiltRegion {
  def: RegionDef;
  root: TransformNode;
  /** meshes toggled by distance (the merged scenery + the painted patch) */
  cullables: Mesh[];
  center: { x: number; z: number };
}

export function buildRegions(scene: Scene): RegionsHandle {
  const root = new TransformNode('regions-root', scene);

  const woodMat = new StandardMaterial('rg-wood', scene);
  woodMat.diffuseColor = hex('#8a6a44');
  woodMat.specularColor = new Color3(0.03, 0.03, 0.02);
  const trunkMat = new StandardMaterial('rg-trunk', scene);
  trunkMat.diffuseColor = hex('#6d4a2c');
  trunkMat.specularColor = new Color3(0.03, 0.02, 0.02);
  const pineMat = new StandardMaterial('rg-pine', scene);
  pineMat.diffuseColor = hex('#2e6b46');
  pineMat.specularColor = new Color3(0.02, 0.04, 0.02);
  const pineSnowMat = new StandardMaterial('rg-pine-snow', scene);
  pineSnowMat.diffuseColor = hex('#7e9b84');
  pineSnowMat.specularColor = new Color3(0.03, 0.04, 0.04);
  const whiteMat = new StandardMaterial('rg-white', scene);
  whiteMat.diffuseColor = hex('#f2f6f8');
  whiteMat.specularColor = new Color3(0.05, 0.06, 0.07);
  const rockMat = new StandardMaterial('rg-rock', scene);
  rockMat.diffuseColor = hex('#8d8a80');
  rockMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const cactusMat = new StandardMaterial('rg-cactus', scene);
  cactusMat.diffuseColor = hex('#4f8f56');
  cactusMat.specularColor = new Color3(0.02, 0.04, 0.02);
  const sandMat = new StandardMaterial('rg-sand', scene);
  sandMat.diffuseColor = hex('#e0c489');
  sandMat.specularColor = new Color3(0.06, 0.05, 0.03);
  const waterMat = new StandardMaterial('rg-water', scene);
  waterMat.diffuseColor = hex('#6fb9cf');
  waterMat.emissiveColor = hex('#2f7c96').scale(0.35);
  waterMat.specularColor = new Color3(0.2, 0.28, 0.3);
  const bushMat = new StandardMaterial('rg-bush', scene);
  bushMat.diffuseColor = hex('#5a9a4c');
  bushMat.specularColor = new Color3(0.02, 0.04, 0.02);
  const flowerA = new StandardMaterial('rg-flower-a', scene);
  flowerA.diffuseColor = hex('#e58bb5');
  flowerA.specularColor = new Color3(0.04, 0.02, 0.03);
  const flowerB = new StandardMaterial('rg-flower-b', scene);
  flowerB.diffuseColor = hex('#f2c14e');
  flowerB.specularColor = new Color3(0.04, 0.03, 0.02);
  const flowerC = new StandardMaterial('rg-flower-c', scene);
  flowerC.diffuseColor = hex('#eef2f7');
  flowerC.specularColor = new Color3(0.03, 0.03, 0.04);
  const mountainMat = new StandardMaterial('rg-mountain', scene);
  mountainMat.diffuseColor = hex('#7c86a0');
  mountainMat.specularColor = new Color3(0.04, 0.04, 0.06);
  const capMat = new StandardMaterial('rg-cap', scene);
  capMat.diffuseColor = hex('#eef3f8');
  capMat.specularColor = new Color3(0.05, 0.05, 0.06);
  const cloudMat = new StandardMaterial('rg-cloud', scene);
  cloudMat.diffuseColor = hex('#ffffff');
  cloudMat.emissiveColor = hex('#e8eef5').scale(0.35);
  cloudMat.alpha = 0.92;
  cloudMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const allMats = [
    woodMat, trunkMat, pineMat, pineSnowMat, whiteMat, rockMat, cactusMat, sandMat,
    waterMat, bushMat, flowerA, flowerB, flowerC, mountainMat, capMat, cloudMat,
  ];
  const regionColorMats = new Map<RegionId, StandardMaterial>();
  for (const r of REGIONS) {
    const m = new StandardMaterial(`rg-tint-${r.id}`, scene);
    m.diffuseColor = hex(r.tint);
    m.emissiveColor = hex(r.tint).scale(0.12);
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    m.alpha = 0.6;
    regionColorMats.set(r.id, m);
    allMats.push(m);
  }

  /* ---------- the river ribbon (one mesh, shown only up north) ---------- */
  const riverPts = riverPoints();
  const riverLeft: Vector3[] = [];
  const riverRight: Vector3[] = [];
  for (let i = 0; i < riverPts.length; i++) {
    const prev = riverPts[Math.max(0, i - 1)];
    const next = riverPts[Math.min(riverPts.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    riverLeft.push(new Vector3(riverPts[i].x + nx * 5.2, RIVER_WATER_Y, riverPts[i].z + nz * 5.2));
    riverRight.push(new Vector3(riverPts[i].x - nx * 5.2, RIVER_WATER_Y, riverPts[i].z - nz * 5.2));
  }
  const river = MeshBuilder.CreateRibbon('rg-river', { pathArray: [riverLeft, riverRight] }, scene);
  river.material = waterMat;
  river.isPickable = false;

  /* ---------- one built region at a time ---------- */
  const built: BuiltRegion[] = [];

  for (const region of REGIONS) {
    const rRoot = new TransformNode(`region-${region.id}`, scene);
    rRoot.parent = root;
    const rng = mulberry32(regionSeed(region.id));
    const road = roadOf(region.id).points;

    /** deterministic prop spot, never on the road, never inside the hub ramp */
    const propAt = (): { x: number; z: number } | null => {
      for (let tries = 0; tries < 14; tries++) {
        const a = rng() * Math.PI * 2;
        const rr = Math.sqrt(rng()) * region.radius * 0.94;
        const x = region.x + Math.cos(a) * rr;
        const z = region.z + Math.sin(a) * rr;
        let onRoad = false;
        for (const p of road) {
          if (Math.hypot(p.x - x, p.z - z) < 7) {
            onRoad = true;
            break;
          }
        }
        if (onRoad) continue;
        if (Math.hypot(x, z) < 170) continue;
        return { x, z };
      }
      return null;
    };

    /** lift = height ABOVE the terrain (props are planted, not buried) */
    const parts: Mesh[] = [];
    const put = (m: Mesh, mat: StandardMaterial, x: number, z: number, lift: number): void => {
      m.material = mat;
      m.position.set(x, terrainHeight(x, z) + lift, z);
      m.isPickable = false;
      parts.push(m);
    };

    if (region.id === 'forest') {
      for (let i = 0; i < 44; i++) {
        const p = propAt();
        if (!p) continue;
        const h = 2.4 + rng() * 2.8;
        const trunk = MeshBuilder.CreateCylinder(`rg-f-tr${i}`, { diameterTop: 0.16, diameterBottom: 0.3, height: h, tessellation: 6 }, scene);
        put(trunk, trunkMat, p.x, p.z, h / 2 - 0.12);
        const crown1 = MeshBuilder.CreateCylinder(`rg-f-c1${i}`, { diameterTop: 0, diameterBottom: 1.7, height: 2.0, tessellation: 7 }, scene);
        put(crown1, pineMat, p.x, p.z, h + 0.4);
        const crown2 = MeshBuilder.CreateCylinder(`rg-f-c2${i}`, { diameterTop: 0, diameterBottom: 1.2, height: 1.6, tessellation: 7 }, scene);
        put(crown2, pineMat, p.x, p.z, h + 1.7);
      }
      for (let i = 0; i < 16; i++) {
        const p = propAt();
        if (!p) continue;
        const cap = MeshBuilder.CreateSphere(`rg-f-mu${i}`, { diameter: 0.5 + rng() * 0.3, segments: 6, slice: 0.5 }, scene);
        put(cap, flowerA, p.x, p.z, 0.18);
      }
    } else if (region.id === 'snow') {
      for (let i = 0; i < 34; i++) {
        const p = propAt();
        if (!p) continue;
        const h = 2.2 + rng() * 2.2;
        const trunk = MeshBuilder.CreateCylinder(`rg-s-tr${i}`, { diameterTop: 0.14, diameterBottom: 0.26, height: h, tessellation: 6 }, scene);
        put(trunk, trunkMat, p.x, p.z, h / 2 - 0.12);
        const crown = MeshBuilder.CreateCylinder(`rg-s-c${i}`, { diameterTop: 0, diameterBottom: 1.6, height: 2.4, tessellation: 7 }, scene);
        put(crown, pineSnowMat, p.x, p.z, h + 0.7);
      }
      for (let i = 0; i < 13; i++) {
        const p = propAt();
        if (!p) continue;
        const lump = MeshBuilder.CreateSphere(`rg-s-l${i}`, { diameter: 0.9 + rng() * 0.9, segments: 7 }, scene);
        put(lump, whiteMat, p.x, p.z, 0.16);
      }
      /* one snowman near the region heart — a friend made of snow */
      const smx = region.x + 16;
      const smz = region.z - 12;
      const base = MeshBuilder.CreateSphere('rg-sm-b', { diameter: 1.1, segments: 8 }, scene);
      put(base, whiteMat, smx, smz, 0.42);
      const head = MeshBuilder.CreateSphere('rg-sm-h', { diameter: 0.7, segments: 8 }, scene);
      put(head, whiteMat, smx, smz, 1.22);
    } else if (region.id === 'river') {
      for (let i = 0; i < 26; i++) {
        const p = propAt();
        if (!p) continue;
        for (let k = 0; k < 3; k++) {
          const reed = MeshBuilder.CreateCylinder(`rg-r-re${i}-${k}`, { diameterTop: 0.02, diameterBottom: 0.06, height: 0.7 + rng() * 0.5, tessellation: 5 }, scene);
          put(reed, bushMat, p.x + (rng() - 0.5) * 0.7, p.z + (rng() - 0.5) * 0.7, 0.35);
        }
      }
      for (let i = 0; i < 12; i++) {
        const p = propAt();
        if (!p) continue;
        const pad = MeshBuilder.CreateCylinder(`rg-r-lily${i}`, { diameter: 0.6, height: 0.04, tessellation: 9 }, scene);
        put(pad, bushMat, p.x, p.z, 0.02);
      }
    } else if (region.id === 'flower') {
      for (let i = 0; i < 48; i++) {
        const p = propAt();
        if (!p) continue;
        const bush = MeshBuilder.CreateSphere(`rg-fl-b${i}`, { diameter: 0.7 + rng() * 0.6, segments: 7 }, scene);
        const kind = rng();
        put(bush, kind < 0.4 ? flowerA : kind < 0.75 ? flowerB : flowerC, p.x, p.z, 0.18);
      }
      for (let i = 0; i < 16; i++) {
        const p = propAt();
        if (!p) continue;
        const tuft = MeshBuilder.CreateCylinder(`rg-fl-t${i}`, { diameterTop: 0.04, diameterBottom: 0.12, height: 0.4, tessellation: 5 }, scene);
        put(tuft, bushMat, p.x, p.z, 0.2);
      }
    } else if (region.id === 'dunes') {
      for (let i = 0; i < 26; i++) {
        const p = propAt();
        if (!p) continue;
        const h = 1.1 + rng() * 1.2;
        const body = MeshBuilder.CreateCylinder(`rg-d-c${i}`, { diameterTop: 0.28, diameterBottom: 0.34, height: h, tessellation: 8 }, scene);
        put(body, cactusMat, p.x, p.z, h / 2 - 0.08);
        if (rng() < 0.6) {
          const arm = MeshBuilder.CreateCylinder(`rg-d-a${i}`, { diameterTop: 0.14, diameterBottom: 0.18, height: h * 0.5, tessellation: 6 }, scene);
          put(arm, cactusMat, p.x + 0.32, p.z, h * 0.55);
        }
      }
      for (let i = 0; i < 14; i++) {
        const p = propAt();
        if (!p) continue;
        const rock = MeshBuilder.CreateIcoSphere(`rg-d-r${i}`, { radius: 0.35 + rng() * 0.45, subdivisions: 1 }, scene);
        put(rock, sandMat, p.x, p.z, 0.14);
      }
    } else {
      /* rocky */
      for (let i = 0; i < 30; i++) {
        const p = propAt();
        if (!p) continue;
        const boulder = MeshBuilder.CreateIcoSphere(`rg-k-b${i}`, { radius: 0.5 + rng() * 0.9, subdivisions: 1 }, scene);
        boulder.scaling.y = 0.7 + rng() * 0.3;
        put(boulder, rockMat, p.x, p.z, 0.22);
      }
      for (let i = 0; i < 8; i++) {
        const p = propAt();
        if (!p) continue;
        /* a small cairn: three stacked stones */
        for (let k = 0; k < 3; k++) {
          const st = MeshBuilder.CreateIcoSphere(`rg-k-c${i}-${k}`, { radius: 0.3 - k * 0.07, subdivisions: 1 }, scene);
          put(st, rockMat, p.x, p.z, 0.18 + k * 0.36);
        }
      }
    }

    /* ---------- the gate: two posts + lintel (a real gate the fox
       walks through — 14-C proportion ladder: gate ≈ 4.7u tall) ---------- */
    const gate = roadOf(region.id).gate;
    const gy = terrainHeight(gate.x, gate.z);
    const sideX = Math.cos(gate.facing + Math.PI / 2);
    const sideZ = Math.sin(gate.facing + Math.PI / 2);
    const postL = MeshBuilder.CreateCylinder(`rg-gate-pl-${region.id}`, { diameter: 0.42, height: 4.6, tessellation: 7 }, scene);
    postL.position.set(gate.x + sideX * 2.3, gy + 2.2, gate.z + sideZ * 2.3);
    postL.material = woodMat;
    postL.isPickable = false;
    parts.push(postL);
    const postR = MeshBuilder.CreateCylinder(`rg-gate-pr-${region.id}`, { diameter: 0.42, height: 4.6, tessellation: 7 }, scene);
    postR.position.set(gate.x - sideX * 2.3, gy + 2.2, gate.z - sideZ * 2.3);
    postR.material = woodMat;
    postR.isPickable = false;
    parts.push(postR);
    const lintel = MeshBuilder.CreateBox(`rg-gate-l-${region.id}`, { width: 5.4, height: 0.4, depth: 0.5 }, scene);
    lintel.position.set(gate.x, gy + 4.68, gate.z);
    lintel.rotation.y = gate.facing;
    lintel.material = woodMat;
    lintel.isPickable = false;
    parts.push(lintel);

    /* merge the region's static life into ONE mesh (multi-material) */
    const cullables: Mesh[] = [];
    if (parts.length > 1) {
      const merged = Mesh.MergeMeshes(parts, true, false, undefined, false, true);
      if (merged) {
        merged.name = `region-mesh-${region.id}`;
        merged.parent = rRoot;
        merged.isPickable = false;
        merged.position.setAll(0);
        cullables.push(merged);
      }
    } else if (parts.length === 1) {
      parts[0].parent = rRoot;
      cullables.push(parts[0]);
    }

    /* the painted ground patch — its own mesh (alpha-blended, terrain-following)
       14-C: offset raised 0.045 → 0.09 (the coarser ground mesh sags a
       little between its vertices; the patch must never sink under it) */
    const patch = MeshBuilder.CreateGround(`rg-patch-${region.id}`, { width: region.radius * 2.1, height: region.radius * 2.1, subdivisions: 26 }, scene);
    const pos = patch.getVerticesData(VertexBuffer.PositionKind);
    if (pos) {
      for (let v = 0; v < pos.length; v += 3) {
        pos[v + 1] = terrainHeight(region.x + pos[v], region.z + pos[v + 2]) + 0.09;
      }
      patch.updateVerticesData(VertexBuffer.PositionKind, pos);
    }
    patch.position.set(region.x, 0, region.z);
    patch.material = regionColorMats.get(region.id)!;
    patch.isPickable = false;
    patch.parent = rRoot;
    cullables.push(patch);

    built.push({ def: region, root: rRoot, cullables, center: { x: region.x, z: region.z } });
  }

  /* ---------- the vista: mountain ring + drifting clouds ----------
     14-C: pushed out with the continent — the mountains must haunt
     the horizon of a 600-unit world. */
  const mountainParts: Mesh[] = [];
  const mrng = mulberry32(20260912);
  for (let i = 0; i < 11; i++) {
    const ang = (i / 11) * Math.PI * 2 + mrng() * 0.3;
    const d = 780 + mrng() * 160;
    const h = 150 + mrng() * 120;
    const w = 150 + mrng() * 80;
    const x = Math.cos(ang) * d;
    const z = Math.sin(ang) * d;
    const peak = MeshBuilder.CreateCylinder(`rg-mt-${i}`, { diameterTop: 0, diameterBottom: w, height: h, tessellation: 7 }, scene);
    peak.position.set(x, h / 2 - 12, z);
    peak.material = mountainMat;
    peak.isPickable = false;
    mountainParts.push(peak);
    if (i % 3 === 0) {
      const cap = MeshBuilder.CreateCylinder(`rg-mtc-${i}`, { diameterTop: 0, diameterBottom: w * 0.34, height: h * 0.24, tessellation: 7 }, scene);
      cap.position.set(x, h - 12 - h * 0.12, z);
      cap.material = capMat;
      cap.isPickable = false;
      mountainParts.push(cap);
    }
  }
  const mountains = mountainParts.length > 1 ? Mesh.MergeMeshes(mountainParts, true, false, undefined, false, true) : (mountainParts[0] ?? null);
  if (mountains) {
    mountains.name = 'rg-mountains';
    mountains.parent = root;
    mountains.isPickable = false;
    mountains.position.setAll(0);
  }

  const cloudParts: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = mrng() * Math.PI * 2;
    const d = 120 + mrng() * 440;
    const y = 60 + mrng() * 30;
    const cx = Math.cos(ang) * d;
    const cz = Math.sin(ang) * d;
    const s = 9 + mrng() * 11;
    for (let k = 0; k < 3; k++) {
      const puff = MeshBuilder.CreateSphere(`rg-cl-${i}-${k}`, { diameter: s * (1 - k * 0.22), segments: 6 }, scene);
      puff.position.set(cx + (k - 1) * s * 0.7, y + (k % 2) * s * 0.2, cz);
      puff.material = cloudMat;
      puff.isPickable = false;
      cloudParts.push(puff);
    }
  }
  const clouds = cloudParts.length > 1 ? Mesh.MergeMeshes(cloudParts, true, false, undefined, false, true) : (cloudParts[0] ?? null);
  if (clouds) {
    clouds.name = 'rg-clouds';
    clouds.parent = root;
    clouds.isPickable = false;
    clouds.position.setAll(0);
  }

  /* ---------- handle ---------- */
  return {
    update(t, dt, px, pz) {
      void t;
      /* clouds drift: one slow spin of the single merged mesh */
      if (clouds) clouds.rotation.y += dt * 0.0045;
      /* region scenery culls by distance — SwiftShader keeps its floor */
      for (const b of built) {
        const show = Math.hypot(px - b.center.x, pz - b.center.z) < REGION_VISIBILITY;
        for (const m of b.cullables) {
          if (m.isEnabled() !== show) m.setEnabled(show);
        }
      }
      /* the river ribbon only matters up north where the river flows */
      if (river.isEnabled() !== pz > 70) river.setEnabled(pz > 70);
    },
    plateAnchors() {
      return REGIONS.map((r) => ({ id: r.id, x: r.x, z: r.z }));
    },
    dispose() {
      river.dispose();
      for (const b of built) b.root.dispose(false, true);
      mountains?.dispose();
      clouds?.dispose();
      root.dispose(false, true);
      for (const m of allMats) m.dispose();
    },
  };
}
