/* ============================================================
 * WorldMeadow — the almost-infinite ring (stage 11).
 *
 * Beyond the curated garden (WORLD_WALK_RADIUS) the meadow rolls
 * on: deterministic, seeded chunks of flowers, trees, rocks, rare
 * restful finds, and golden sparkles to collect — streamed in
 * around the walker and dissolved behind her, forever.
 *
 * The law of the meadow:
 *   - DETERMINISTIC: chunk (cx, cz) is the same world on every
 *     visit, on every device, after every reload (mulberry32 seeded
 *     by a hash of the coords). The meadow is a place, not noise.
 *   - HONEST: sparkles collected stay collected (WorldCollect).
 *   - CHEAP: one merged mesh per chunk (the WorldLandmarks merge
 *     discipline), low tessellation, shared materials, hard load /
 *     dispose radii, and NO work at all inside the curated garden.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { mulberry32 } from '../audio/MusicEngine';
import { WORLD_WALK_RADIUS, WANDER_RADIUS } from './WorldLayout';

const hex = (s: string): Color3 => Color3.FromHexString(s);

/* ---------- the pure, testable half ---------- */

export const MEADOW_CHUNK = 16;
/** chunks load around the walker / dissolve behind her — tight radii
    so streaming stays a whisper: the meadow builds itself as the child
    genuinely heads out, never all at once while she plays the garden */
export const MEADOW_LOAD_RADIUS = 46;
export const MEADOW_DROP_RADIUS = 62;
/** the meadow begins beyond the curated ring (a margin keeps the
    garden's own decoration from doubling with chunk flowers) */
export const MEADOW_START = WORLD_WALK_RADIUS + 7;

export function chunkKey(cx: number, cz: number): string {
  return `${cx}:${cz}`;
}

export function chunkCenter(cx: number, cz: number): { x: number; z: number } {
  return { x: (cx + 0.5) * MEADOW_CHUNK, z: (cz + 0.5) * MEADOW_CHUNK };
}

export function chunkOf(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / MEADOW_CHUNK), cz: Math.floor(z / MEADOW_CHUNK) };
}

/** Stable int hash of chunk coords — the seed of the chunk's world.
    Addition (not XOR) of the two scaled coords: XOR is commutative,
    and swapped chunks would seed identical worlds. */
export function chunkHash(cx: number, cz: number): number {
  let h = (Math.imul(cx, 0x27d4eb2d) + Math.imul(cz, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x9e3779b9) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export type MeadowFindKind = 'bench' | 'pondlet' | 'standing-stone' | 'none';

/** The rare restful find of a chunk (deterministic; ~1 in 9 chunks). */
export function chunkFind(cx: number, cz: number): MeadowFindKind {
  const r = chunkHash(cx, cz) % 100;
  if (r < 4) return 'bench';
  if (r < 8) return 'pondlet';
  if (r < 11) return 'standing-stone';
  return 'none';
}

export interface MeadowSparkle {
  id: string;
  x: number;
  z: number;
}

/**
 * The chunk's golden sparkles (deterministic, 0-3 per chunk, kept
 * off the exact chunk center where the find would sit).
 */
export function chunkSparkles(cx: number, cz: number): MeadowSparkle[] {
  const rng = mulberry32(chunkHash(cx, cz) ^ 0x9e3779b9);
  const count = Math.floor(rng() * 4); /* 0..3 */
  const out: MeadowSparkle[] = [];
  for (let i = 0; i < count; i++) {
    const x = (cx + 0.12 + rng() * 0.76) * MEADOW_CHUNK;
    const z = (cz + 0.12 + rng() * 0.76) * MEADOW_CHUNK;
    out.push({ id: `${chunkKey(cx, cz)}:${i}`, x, z });
  }
  return out;
}

/** True when a point belongs to the meadow (not the curated garden). */
export function isMeadowPoint(x: number, z: number): boolean {
  return Math.hypot(x, z) > MEADOW_START;
}

/* ---------- the Babylon half ---------- */

interface MeadowSparkleLive extends MeadowSparkle {
  mesh: Mesh;
  baseY: number;
  taken: boolean;
}

interface Chunk {
  key: string;
  root: TransformNode;
  mesh: Mesh | null;
  sparkles: MeadowSparkleLive[];
  find: MeadowFindKind;
  findMesh: Mesh | null;
  findBaseY: number;
}

export interface MeadowHandle {
  /** stream: called every frame with the walker's position (cheap no-op until 500ms cadence) */
  update(t: number, dt: number, px: number, pz: number): void;
  /** the sparkle within reach of the walker, or null (marks it taken) */
  sparkleWithinReach(px: number, pz: number, reach: number): MeadowSparkle | null;
  /** sparkles already collected elsewhere — never show them again */
  setTaken(ids: ReadonlySet<string>): void;
  /** how many sparkles are currently visible & waiting */
  waitingCount(): number;
  dispose(): void;
}

export function buildMeadow(scene: Scene, taken: ReadonlySet<string> = new Set()): MeadowHandle {
  const takenIds = new Set<string>(taken);
  const chunks = new Map<string, Chunk>();
  let lastStreamAt = -1;

  /* ---------- shared materials (made once, like every module) ---------- */
  const stemMat = new StandardMaterial('md-stem', scene);
  stemMat.diffuseColor = hex('#4d9a4f');
  stemMat.specularColor = new Color3(0.02, 0.03, 0.02);
  const petalA = new StandardMaterial('md-petal-a', scene);
  petalA.diffuseColor = hex('#f2b6c4');
  petalA.specularColor = new Color3(0.04, 0.02, 0.03);
  const petalB = new StandardMaterial('md-petal-b', scene);
  petalB.diffuseColor = hex('#f7e6a2');
  petalB.specularColor = new Color3(0.04, 0.03, 0.02);
  const petalC = new StandardMaterial('md-petal-c', scene);
  petalC.diffuseColor = hex('#cfe3f7');
  petalC.specularColor = new Color3(0.03, 0.03, 0.04);
  const trunkMat = new StandardMaterial('md-trunk', scene);
  trunkMat.diffuseColor = hex('#8a5a33');
  trunkMat.specularColor = new Color3(0.03, 0.03, 0.02);
  const leafMat = new StandardMaterial('md-leaf', scene);
  leafMat.diffuseColor = hex('#5fae5f');
  leafMat.specularColor = new Color3(0.02, 0.04, 0.02);
  const rockMat = new StandardMaterial('md-rock', scene);
  rockMat.diffuseColor = hex('#9a978f');
  rockMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const sparkleMat = new StandardMaterial('md-sparkle', scene);
  sparkleMat.diffuseColor = hex('#caa53d');
  sparkleMat.emissiveColor = hex('#ffd76a').scale(0.75);
  sparkleMat.specularColor = new Color3(0.05, 0.05, 0.02);
  const woodMat = new StandardMaterial('md-wood', scene);
  woodMat.diffuseColor = hex('#a9764a');
  woodMat.specularColor = new Color3(0.03, 0.03, 0.02);
  const waterMat = new StandardMaterial('md-water', scene);
  waterMat.diffuseColor = hex('#8fd4e8');
  waterMat.emissiveColor = hex('#3a8fa8').scale(0.3);
  waterMat.specularColor = new Color3(0.2, 0.28, 0.3);
  const allMats = [stemMat, petalA, petalB, petalC, trunkMat, leafMat, rockMat, sparkleMat, woodMat, waterMat];

  const disposeChunk = (c: Chunk): void => {
    c.mesh?.dispose();
    c.findMesh?.dispose();
    for (const s of c.sparkles) s.mesh.dispose();
    c.root.dispose(false, true);
  };

  const buildChunk = (cx: number, cz: number): void => {
    const key = chunkKey(cx, cz);
    const root = new TransformNode(`meadow-${key}`, scene);
    const rng = mulberry32(chunkHash(cx, cz));
    const parts: Mesh[] = [];

    /* the walker never sees a chunk's raw edge: decorate the whole cell */
    const flowers = 8 + Math.floor(rng() * 7); /* 8..14 */
    for (let i = 0; i < flowers; i++) {
      const x = (cx + rng()) * MEADOW_CHUNK;
      const z = (cz + rng()) * MEADOW_CHUNK;
      const stem = MeshBuilder.CreateCylinder(`md-f${i}`, { diameter: 0.05, height: 0.26, tessellation: 5 }, scene);
      stem.position.set(x, 0.13, z);
      stem.material = stemMat;
      const head = MeshBuilder.CreateSphere(`md-fh${i}`, { diameter: 0.14 + rng() * 0.08, segments: 5 }, scene);
      head.position.set(x, 0.3, z);
      const kind = rng();
      head.material = kind < 0.4 ? petalA : kind < 0.75 ? petalB : petalC;
      parts.push(stem, head);
    }
    const tufts = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < tufts; i++) {
      const x = (cx + rng()) * MEADOW_CHUNK;
      const z = (cz + rng()) * MEADOW_CHUNK;
      const tuft = MeshBuilder.CreateCylinder(`md-t${i}`, { diameterTop: 0.02, diameterBottom: 0.09, height: 0.16, tessellation: 5 }, scene);
      tuft.position.set(x, 0.08, z);
      tuft.rotation.z = (rng() - 0.5) * 0.5;
      tuft.material = leafMat;
      parts.push(tuft);
    }
    const trees = Math.floor(rng() * 3); /* 0..2 */
    for (let i = 0; i < trees; i++) {
      const x = (cx + 0.15 + rng() * 0.7) * MEADOW_CHUNK;
      const z = (cz + 0.15 + rng() * 0.7) * MEADOW_CHUNK;
      const h = 1.2 + rng() * 1.1;
      const trunk = MeshBuilder.CreateCylinder(`md-tr${i}`, { diameterTop: 0.1, diameterBottom: 0.18, height: h, tessellation: 6 }, scene);
      trunk.position.set(x, h / 2, z);
      trunk.material = trunkMat;
      const crown = MeshBuilder.CreateSphere(`md-cr${i}`, { diameter: 0.9 + rng() * 0.7, segments: 6 }, scene);
      crown.position.set(x, h + 0.25, z);
      crown.material = leafMat;
      parts.push(trunk, crown);
    }
    const rocks = Math.floor(rng() * 3);
    for (let i = 0; i < rocks; i++) {
      const x = (cx + rng()) * MEADOW_CHUNK;
      const z = (cz + rng()) * MEADOW_CHUNK;
      const rock = MeshBuilder.CreateIcoSphere(`md-r${i}`, { radius: 0.14 + rng() * 0.22, subdivisions: 1 }, scene);
      rock.position.set(x, 0.08, z);
      rock.material = rockMat;
      parts.push(rock);
    }

    /* the rare restful find — one per lucky chunk */
    const find = chunkFind(cx, cz);
    const findMesh: Mesh | null = null;
    let findBaseY = 0;
    if (find !== 'none') {
      const fx = (cx + 0.5) * MEADOW_CHUNK;
      const fz = (cz + 0.5) * MEADOW_CHUNK;
      if (find === 'bench') {
        const seat = MeshBuilder.CreateBox('md-bench', { width: 0.9, height: 0.07, depth: 0.3 }, scene);
        seat.position.set(fx, 0.26, fz);
        seat.material = woodMat;
        const legL = MeshBuilder.CreateBox('md-bench-l', { width: 0.07, height: 0.24, depth: 0.26 }, scene);
        legL.position.set(fx - 0.36, 0.12, fz);
        legL.material = woodMat;
        const legR = legL.clone('md-bench-r');
        legR.position.x = fx + 0.36;
        parts.push(seat, legL, legR);
      } else if (find === 'pondlet') {
        const water = MeshBuilder.CreateDisc('md-pond', { radius: 1.0, tessellation: 14 }, scene);
        water.rotation.x = Math.PI / 2;
        water.position.set(fx, 0.03, fz);
        water.material = waterMat;
        parts.push(water);
      } else {
        const stone = MeshBuilder.CreateCylinder('md-stone', { diameterTop: 0.1, diameterBottom: 0.3, height: 0.9, tessellation: 6 }, scene);
        stone.position.set(fx, 0.45, fz);
        stone.rotation.z = 0.06;
        stone.material = rockMat;
        parts.push(stone);
        findBaseY = 0.9;
      }
    }

    /* merge the chunk's static life into ONE mesh (the fps floor is a
       contract): multi-material keeps every look */
    let mesh: Mesh | null = null;
    if (parts.length > 1) {
      const merged = Mesh.MergeMeshes(parts, true, false, undefined, false, true);
      if (merged) {
        merged.name = `meadow-mesh-${key}`;
        merged.parent = root;
        merged.isPickable = false;
        merged.position.setAll(0);
        mesh = merged;
      }
    } else if (parts.length === 1) {
      parts[0].isPickable = false;
      mesh = parts[0];
      mesh.parent = root;
    }

    /* the chunk's sparkles — live, bobbable, collectible */
    const sparkles: MeadowSparkleLive[] = [];
    for (const s of chunkSparkles(cx, cz)) {
      const meshS = MeshBuilder.CreatePolyhedron(`md-sp-${s.id}`, { type: 1, size: 0.14 }, scene);
      meshS.position.set(s.x, 0.5, s.z);
      meshS.material = sparkleMat;
      meshS.isPickable = false;
      meshS.parent = root;
      const isTaken = takenIds.has(s.id);
      meshS.setEnabled(!isTaken);
      sparkles.push({ ...s, mesh: meshS, baseY: 0.5, taken: isTaken });
    }

    chunks.set(key, { key, root, mesh, sparkles, find, findMesh, findBaseY });
  };

  const wanted = (px: number, pz: number): Set<string> => {
    const need = new Set<string>();
    const c = chunkOf(px, pz);
    const reach = Math.ceil(MEADOW_LOAD_RADIUS / MEADOW_CHUNK);
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        const cx = c.cx + dx;
        const cz = c.cz + dz;
        const ctr = chunkCenter(cx, cz);
        const d = Math.hypot(ctr.x, ctr.z);
        if (d < MEADOW_START - MEADOW_CHUNK) continue;
        if (Math.hypot(ctr.x - px, ctr.z - pz) > MEADOW_LOAD_RADIUS) continue;
        if (d > WANDER_RADIUS + MEADOW_CHUNK) continue;
        need.add(chunkKey(cx, cz));
      }
    }
    return need;
  };

  let sparkleSpin = 0;

  return {
    update(t, dt, px, pz) {
      void dt;
      /* stream at 2Hz, BUILD BUDGETED (stage 11): at most three chunk
         merges per tick — geometry work never blocks the frame (a
         hitch on a children's tablet is a fall, not a wait) */
      if (t - lastStreamAt > 0.5) {
        lastStreamAt = t;
        const need = wanted(px, pz);
        for (const [key, c] of chunks) {
          if (!need.has(key)) {
            disposeChunk(c);
            chunks.delete(key);
          }
        }
        let built = 0;
        for (const key of need) {
          if (built >= 3) break;
          if (!chunks.has(key)) {
            const [cx, cz] = key.split(':').map(Number) as [number, number];
            buildChunk(cx, cz);
            built++;
          }
        }
      }
      /* sparkle bob + spin: pure transform writes */
      sparkleSpin += dt * 1.8;
      for (const [, c] of chunks) {
        for (const s of c.sparkles) {
          if (s.taken) continue;
          s.mesh.position.y = s.baseY + Math.sin(t * 2.4 + s.x) * 0.08;
          s.mesh.rotation.y = sparkleSpin;
        }
      }
    },
    sparkleWithinReach(px, pz, reach) {
      for (const [, c] of chunks) {
        for (const s of c.sparkles) {
          if (s.taken) continue;
          if (Math.hypot(s.x - px, s.z - pz) <= reach) {
            s.taken = true;
            s.mesh.setEnabled(false);
            takenIds.add(s.id);
            return s;
          }
        }
      }
      return null;
    },
    setTaken(ids) {
      for (const id of ids) takenIds.add(id);
      for (const [, c] of chunks) {
        for (const s of c.sparkles) {
          if (takenIds.has(s.id) && !s.taken) {
            s.taken = true;
            s.mesh.setEnabled(false);
          }
        }
      }
    },
    waitingCount() {
      let n = 0;
      for (const [, c] of chunks) for (const s of c.sparkles) if (!s.taken) n++;
      return n;
    },
    dispose() {
      for (const [, c] of chunks) disposeChunk(c);
      chunks.clear();
      for (const m of allMats) m.dispose();
    },
  };
}
