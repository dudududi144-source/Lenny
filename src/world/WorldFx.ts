/* ============================================================
 * WorldFx — the world's sparkle layer (stage 15-D).
 *
 * The owner asked for professional graphics; the critic's ledger
 * (W6) asked for discipline. Both live here: every effect is
 * POOLED, THIN-INSTANCED (one draw call each) and allocation-free
 * in the hot loop — and every effect has a weak-tier story:
 *
 *   road sparkles   — glinting dust motes over the paths
 *                     (weak: none / standard: 18 / rich: 34)
 *   discovery burst — star confetti when a place is found or an
 *                     acorn lands (weak: none / standard: 10 / rich: 14)
 *   quest beacon    — a soft pulsing halo at the wayfinding target
 *                     (weak: the landmark's own beacon, unchanged /
 *                     standard+rich: the halo rides it)
 *
 * Draw-call budget on rich: 3 total, steady-state usually 1
 * (sparkles) + rare 1s bursts. Nothing here allocates per frame:
 * all matrices compose into scratch objects that live forever.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { mulberry32 } from './worldAcorns';
import { LANDMARKS, pathPoints } from './WorldLayout';
import { REGION_ROADS, terrainHeight } from './WorldRegions';
import type { QualityTier } from './FpsGovernor';

const hex = (s: string): Color3 => Color3.FromHexString(s);

/* tier budgets (documented here; applied through the same tier gates
   that drive WorldApp's glow/shadows — weak never enters this module) */
export const FX_BUDGETS = {
  standard: { sparkles: 18, burst: 10 },
  rich: { sparkles: 34, burst: 14 },
} as const;

const SPARKLE_SCAN_RADIUS = 30;
const SPARKLE_REFRESH_MS = 1600;
const SPARKLE_MOVE = 12;
const BURST_LIFE = 0.9;
const BURST_GRAVITY = 2.6;
const MAX_PARTICLES = FX_BUDGETS.rich.burst;

/* stage 16-c — god-ray landmarks (rich only): the tall silhouettes
   worth a column of light. Cheap BILLBOARDS, never new lights. */
const GODRAY_KINDS = new Set([
  'giant-tree',
  'ice-tower',
  'crystal-peak',
  'rainbow-tower',
  'lighthouse',
  'waterfall-rock',
  'mega-flower',
]);
const GODRAY_MAX = 7;

/** One soft shaft texture: vertical beam, feathered edges (painted
 *  once, shared by every shaft — zero per-landmark canvases). */
function godrayTexture(scene: Scene): DynamicTexture {
  const w = 128;
  const h = 256;
  const tex = new DynamicTexture('fx-godray-tex', { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(255,246,214,0.85)');
  v.addColorStop(0.55, 'rgba(255,240,196,0.38)');
  v.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const hgrad = ctx.createLinearGradient(0, 0, w, 0);
  hgrad.addColorStop(0, 'rgba(0,0,0,0)');
  hgrad.addColorStop(0.5, 'rgba(0,0,0,1)');
  hgrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hgrad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

export interface WorldFxHandle {
  setTier(tier: QualityTier): void;
  /** per frame: sparkle twinkle + live burst physics (zero allocs) */
  update(t: number, dt: number, px: number, pz: number): void;
  /** star confetti at a world point ('discovery' big / 'acorn' small) */
  burstAt(x: number, y: number, z: number, kind: 'discovery' | 'acorn'): void;
  /** the wayfinding target's halo (null hides it — weak keeps null) */
  setQuestTarget(x: number | null, z?: number, y?: number): void;
  dispose(): void;
}

export function buildWorldFx(scene: Scene): WorldFxHandle {
  const root = new TransformNode('fx-root', scene);

  /* ---------- shared materials (two, total) ---------- */
  const sparkleMat = new StandardMaterial('fx-sparkle-mat', scene);
  sparkleMat.emissiveColor = hex('#ffd76a').scale(1.05);
  sparkleMat.diffuseColor = Color3.Black();
  sparkleMat.specularColor = Color3.Black();
  sparkleMat.disableLighting = true;
  sparkleMat.alpha = 0.9;

  const burstMat = new StandardMaterial('fx-burst-mat', scene);
  burstMat.emissiveColor = hex('#ffe9a6').scale(1.15);
  burstMat.diffuseColor = Color3.Black();
  burstMat.specularColor = Color3.Black();
  burstMat.disableLighting = true;

  /* ---------- road sparkles: ONE master, thin instances ---------- */
  const sparkleMaster = MeshBuilder.CreatePlane('fx-sparkle', { width: 0.16, height: 0.16 }, scene);
  sparkleMaster.material = sparkleMat;
  sparkleMaster.parent = root;
  sparkleMaster.isPickable = false;
  sparkleMaster.setEnabled(false);

  /* road sample lattice (built once): hub path + the six region roads */
  const roadPts: Array<{ x: number; z: number }> = [...pathPoints()];
  for (const r of REGION_ROADS) roadPts.push(...r.points);

  /* scratch state — allocated once, mutated forever */
  let sparkleCount = 0;
  let sparkleMatBuf = new Float32Array(0);
  const sparklePos = new Float32Array(MAX_PARTICLES * 3);
  const sparklePhase = new Float32Array(MAX_PARTICLES);
  const candidateIdx = new Int32Array(96);
  const sparkleRng = mulberry32(0xf315d);
  let lastSparkleRefresh = -Infinity;
  let lastRefreshX = Infinity;
  let lastRefreshZ = Infinity;

  const refreshSparkles = (px: number, pz: number): void => {
    if (sparkleCount === 0) return;
    /* candidates within the scan radius (bounded slots, no allocation) */
    let n = 0;
    for (let i = 0; i < roadPts.length && n < candidateIdx.length; i++) {
      const p = roadPts[i];
      if (Math.hypot(p.x - px, p.z - pz) < SPARKLE_SCAN_RADIUS) candidateIdx[n++] = i;
    }
    if (n === 0) {
      for (let i = 0; i < sparkleCount; i++) sparklePos[i * 3 + 1] = -999;
    } else {
      for (let s = 0; s < sparkleCount; s++) {
        const p = roadPts[candidateIdx[Math.floor(sparkleRng() * n)]];
        const jx = (sparkleRng() - 0.5) * 2.4;
        const jz = (sparkleRng() - 0.5) * 2.4;
        const x = p.x + jx;
        const z = p.z + jz;
        sparklePos[s * 3] = x;
        sparklePos[s * 3 + 1] = terrainHeight(x, z) + 0.07;
        sparklePos[s * 3 + 2] = z;
        sparklePhase[s] = sparkleRng() * Math.PI * 2;
      }
    }
    lastRefreshX = px;
    lastRefreshZ = pz;
    lastSparkleRefresh = performance.now();
  };

  const writeSparkleMatrix = (i: number, scale: number): void => {
    const o = i * 16;
    if (sparklePos[i * 3 + 1] < -100) {
      /* parked: collapsed somewhere far below the world */
      sparkleMatBuf[o + 0] = 0.001;
      sparkleMatBuf[o + 5] = 0.001;
      sparkleMatBuf[o + 10] = 0.001;
      sparkleMatBuf[o + 14] = -999;
      return;
    }
    /* a quad laid flat on the ground (rotation -90° about X), the
       glint read from the child's high camera; scale carries the
       twinkle so no per-instance color buffer is ever needed */
    sparkleMatBuf[o + 0] = scale;
    sparkleMatBuf[o + 1] = 0;
    sparkleMatBuf[o + 2] = 0;
    sparkleMatBuf[o + 3] = 0;
    sparkleMatBuf[o + 4] = 0;
    sparkleMatBuf[o + 5] = 0;
    sparkleMatBuf[o + 6] = scale;
    sparkleMatBuf[o + 7] = 0;
    sparkleMatBuf[o + 8] = 0;
    sparkleMatBuf[o + 9] = -scale;
    sparkleMatBuf[o + 10] = 0;
    sparkleMatBuf[o + 11] = 0;
    sparkleMatBuf[o + 12] = sparklePos[i * 3];
    sparkleMatBuf[o + 13] = sparklePos[i * 3 + 1];
    sparkleMatBuf[o + 14] = sparklePos[i * 3 + 2];
    sparkleMatBuf[o + 15] = 1;
  };

  /* ---------- the burst pool: ONE master, thin instances ---------- */
  const burstMaster = MeshBuilder.CreatePolyhedron('fx-burst', { type: 1, size: 0.085 }, scene);
  burstMaster.material = burstMat;
  burstMaster.parent = root;
  burstMaster.isPickable = false;
  burstMaster.setEnabled(false);

  const burstOrigin = new Vector3(0, 0, 0);
  const burstVel = new Float32Array(MAX_PARTICLES * 3);
  const burstSpin = new Float32Array(MAX_PARTICLES);
  let burstCount = 0;
  let burstLiveCount = 0;
  let burstStart = -Infinity;
  let burstActive = false;
  let burstMatBuf = new Float32Array(0);
  const burstRng = mulberry32(0xf3b05);

  const scratchScale = new Vector3(1, 1, 1);
  const scratchQuat = new Quaternion();
  const scratchPos = new Vector3(0, 0, 0);
  const scratchMatrix = new Matrix();

  const writeBurstMatrices = (t: number): void => {
    const k = (t - burstStart) / BURST_LIFE;
    for (let i = 0; i < burstCount; i++) {
      if (i >= burstLiveCount) {
        /* a parked particle: collapsed, far below the world */
        burstMatBuf[i * 16 + 0] = 0.001;
        burstMatBuf[i * 16 + 5] = 0.001;
        burstMatBuf[i * 16 + 10] = 0.001;
        burstMatBuf[i * 16 + 14] = -999;
        continue;
      }
      /* ease-out fall: velocity carry + soft gravity, all precomputed shape */
      const g = BURST_GRAVITY * k * k;
      scratchPos.set(
        burstOrigin.x + burstVel[i * 3] * k,
        burstOrigin.y + burstVel[i * 3 + 1] * k - g,
        burstOrigin.z + burstVel[i * 3 + 2] * k,
      );
      const fade = 1 - k;
      const sc = Math.max(0.001, fade * (i % 2 === 0 ? 1 : 0.72));
      scratchScale.setAll(sc);
      Quaternion.RotationYawPitchRollToRef(burstSpin[i] * k, burstSpin[i] * 0.7 * k, burstSpin[i] * 1.3 * k, scratchQuat);
      Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
      scratchMatrix.copyToArray(burstMatBuf, i * 16);
    }
    burstMaster.thinInstanceBufferUpdated('matrix');
  };

  /* ---------- god-ray glow billboards (rich tier only, 16-c) ----------
     Two crossed soft-shaft quads behind each BIG landmark — the sun
     column a child reads as magic, drawn with one painted texture,
     ONE master, thin instances (1 draw call), no new lights, no
     per-frame work: the matrices are composed once and the whole
     master flips with the tier (instant off on a drop). */
  const godrayTex = godrayTexture(scene);
  const godrayMat = new StandardMaterial('fx-godray-mat', scene);
  godrayMat.emissiveTexture = godrayTex;
  godrayMat.opacityTexture = godrayTex;
  godrayMat.opacityTexture.getAlphaFromRGB = false;
  godrayMat.diffuseColor = Color3.Black();
  godrayMat.specularColor = Color3.Black();
  godrayMat.disableLighting = true;
  godrayMat.backFaceCulling = false;
  godrayMat.alpha = 0.5;

  const godrayMaster = MeshBuilder.CreatePlane('godray-master', { width: 1, height: 1 }, scene);
  godrayMaster.material = godrayMat;
  godrayMaster.parent = root;
  godrayMaster.isPickable = false;
  godrayMaster.alwaysSelectAsActiveMesh = true;
  godrayMaster.setEnabled(false); /* boot tier is weak */
  {
    const spots = LANDMARKS.filter((l) => GODRAY_KINDS.has(l.id)).slice(0, GODRAY_MAX);
    const buf = new Float32Array(spots.length * 2 * 16);
    let n = 0;
    for (const l of spots) {
      const base = terrainHeight(l.x, l.z);
      const hgt = Math.min(17, l.keep * 2.3);
      const wid = Math.min(13, l.keep * 1.6);
      for (const yaw of [Math.PI / 4, -Math.PI / 4]) {
        scratchScale.set(wid, hgt, 1);
        Quaternion.RotationYawPitchRollToRef(yaw, -0.1, 0, scratchQuat);
        scratchPos.set(l.x, base + hgt * 0.44, l.z);
        Matrix.ComposeToRef(scratchScale, scratchQuat, scratchPos, scratchMatrix);
        scratchMatrix.copyToArray(buf, n * 16);
        n++;
      }
    }
    godrayMaster.thinInstanceSetBuffer('matrix', buf.slice(0, n * 16), 16, true);
    godrayMaster.thinInstanceRefreshBoundingInfo();
  }
  const beacon = MeshBuilder.CreateTorus('fx-beacon', { diameter: 1.15, thickness: 0.075, tessellation: 24 }, scene);
  beacon.scaling.y = 0.32;
  const beaconMat = new StandardMaterial('fx-beacon-mat', scene);
  beaconMat.emissiveColor = hex('#ffd76a').scale(0.95);
  beaconMat.diffuseColor = Color3.Black();
  beaconMat.specularColor = Color3.Black();
  beaconMat.disableLighting = true;
  beaconMat.alpha = 0.55;
  beacon.material = beaconMat;
  beacon.isPickable = false;
  beacon.setEnabled(false);

  let tier: QualityTier = 'weak';

  const applyTier = (next: QualityTier): void => {
    tier = next;
    const wantSparkles = next === 'standard' ? FX_BUDGETS.standard.sparkles : next === 'rich' ? FX_BUDGETS.rich.sparkles : 0;
    if (wantSparkles !== sparkleCount) {
      sparkleCount = wantSparkles;
      if (sparkleCount > 0) {
        sparkleMatBuf = new Float32Array(sparkleCount * 16);
        for (let i = 0; i < sparkleCount; i++) sparklePos[i * 3 + 1] = -999;
        sparkleMaster.thinInstanceSetBuffer('matrix', sparkleMatBuf, 16, false);
        sparkleMaster.setEnabled(true);
        lastSparkleRefresh = -Infinity; /* force a refresh */
      } else {
        sparkleMaster.setEnabled(false);
      }
    }
    const wantBurst = next === 'standard' ? FX_BUDGETS.standard.burst : next === 'rich' ? FX_BUDGETS.rich.burst : 0;
    if (wantBurst !== burstCount) {
      burstCount = wantBurst;
      if (burstCount > 0) {
        burstMatBuf = new Float32Array(burstCount * 16);
        burstMaster.thinInstanceSetBuffer('matrix', burstMatBuf, 16, false);
      }
      burstActive = false;
      burstMaster.setEnabled(false);
    }
    if (next === 'weak') beacon.setEnabled(false);
    /* god-rays live ONLY on rich — and vanish the instant it drops */
    godrayMaster.setEnabled(next === 'rich');
  };

  return {
    setTier(next) {
      applyTier(next);
    },

    update(t, dt, px, pz) {
      /* --- road sparkles: reposition on cadence, twinkle every frame --- */
      if (sparkleCount > 0) {
        const now = performance.now();
        if (
          now - lastSparkleRefresh > SPARKLE_REFRESH_MS ||
          Math.hypot(px - lastRefreshX, pz - lastRefreshZ) > SPARKLE_MOVE
        ) {
          refreshSparkles(px, pz);
        }
        for (let i = 0; i < sparkleCount; i++) {
          const tw = 0.55 + 0.45 * Math.sin(t * 2.6 + sparklePhase[i]);
          writeSparkleMatrix(i, 0.5 + tw * 0.9);
        }
        sparkleMaster.thinInstanceBufferUpdated('matrix');
      }

      /* --- burst physics (only while a burst is alive) --- */
      if (burstActive) {
        const k = (t - burstStart) / BURST_LIFE;
        if (k >= 1) {
          burstActive = false;
          burstMaster.setEnabled(false);
        } else {
          writeBurstMatrices(t);
        }
      }

      /* --- beacon halo pulse (transform writes only) --- */
      if (beacon.isEnabled()) {
        const pulse = 1 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.3));
        beacon.scaling.x = pulse;
        beacon.scaling.z = pulse;
        beacon.rotation.y += dt * 0.7;
      }
    },

    burstAt(x, y, z, kind) {
      if (burstCount === 0) return; /* weak tier: the garden stays as it was */
      burstOrigin.set(x, y, z);
      burstLiveCount = kind === 'acorn' ? Math.min(6, burstCount) : burstCount;
      for (let i = 0; i < burstCount; i++) {
        if (i < burstLiveCount) {
          const a = burstRng() * Math.PI * 2;
          const up = 1.6 + burstRng() * 1.5;
          const sp = (kind === 'acorn' ? 0.9 : 1.35) * (0.7 + burstRng() * 0.6);
          burstVel[i * 3] = Math.cos(a) * sp;
          burstVel[i * 3 + 1] = up * (0.65 + burstRng() * 0.4);
          burstVel[i * 3 + 2] = Math.sin(a) * sp;
          burstSpin[i] = (burstRng() - 0.5) * 14;
        } else {
          /* unused particles parked far below and tiny */
          burstVel[i * 3] = 0;
          burstVel[i * 3 + 1] = 0;
          burstVel[i * 3 + 2] = 0;
          burstSpin[i] = 0;
        }
      }
      burstStart = performance.now() / 1000;
      burstActive = true;
      burstMaster.setEnabled(true);
      writeBurstMatrices(burstStart);
    },

    setQuestTarget(x, z, y) {
      if (x === null || z === undefined || y === undefined || tier === 'weak') {
        beacon.setEnabled(false);
        return;
      }
      beacon.position.set(x, y + 0.12, z);
      beacon.setEnabled(true);
    },

    dispose() {
      root.dispose(false, true);
      sparkleMat.dispose();
      burstMat.dispose();
      beaconMat.dispose();
      godrayMat.dispose();
      godrayTex.dispose();
    },
  };
}
