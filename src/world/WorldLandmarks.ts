/* ============================================================
 * WorldLandmarks — the places beyond the path (critic round B, W1).
 *
 * Eight low-poly landmark builds around the spiral: a big tree, a
 * pond, a mushroom circle, a windmill (its blades actually turn), a
 * rainbow, a firefly glade, a beehive, and a turtle-shaped rock.
 * Each carries a soft beacon until the child discovers it.
 *
 * Performance discipline (the WorldLanterns pattern, critic W6):
 *   - SEVEN shared materials for every landmark and beacon
 *   - zero per-frame allocations — bobs/spins write straight into
 *     transforms from module state, nothing is created in the loop
 *   - meshes pickable so a tap on the windmill resolves a walk to
 *     its rim (WorldInput widens the pick set, geometry resolves)
 *   - symmetric dispose
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { LANDMARKS } from './WorldLayout';
import { terrainHeight } from './WorldRegions';
const hex = (s: string): Color3 => Color3.FromHexString(s);

interface Bobber {
  mesh: Mesh;
  baseY: number;
  amp: number;
  speed: number;
  phase: number;
}

export interface LandmarkScreenSpot {
  id: string;
  x: number; /* canvas fractions 0..1 */
  y: number;
  on: boolean;
}

export interface LandmarksHandle {
  /** Found landmarks lose their beacons (and gain their DOM plates). */
  setFound(ids: ReadonlySet<string>): void;
  /** The daily journey's targets keep their beacons even when found. */
  setDailyTargets(ids: ReadonlyArray<string>): void;
  /** The active wayfinding quest's target — its beacon stands tall. */
  setQuestTarget(id: string | null): void;
  /** Per-frame life: windmill spin, firefly + beacon bob, distance culling. No allocs. */
  update(t: number, dt: number, px?: number, pz?: number): void;
  /** Canvas-fraction positions for the DOM name plates (120ms cadence). */
  spots(project: (p: Vector3) => { x: number; y: number; on: boolean }): LandmarkScreenSpot[];
  /** Meshes that must NOT feed the glow pass (keeps weak GPUs alive). */
  glowExclusions(): Mesh[];
  dispose(): void;
}

export function buildLandmarks(scene: Scene): LandmarksHandle {
  const root = new TransformNode('landmarks-root', scene);

  /* ---------- seven shared materials, made once ---------- */

  const barkMat = new StandardMaterial('lm-bark', scene);
  barkMat.diffuseColor = hex('#8a5a33');
  barkMat.specularColor = new Color3(0.03, 0.03, 0.02);

  const leafMat = new StandardMaterial('lm-leaf', scene);
  leafMat.diffuseColor = hex('#5fae5f');
  leafMat.specularColor = new Color3(0.02, 0.04, 0.02);

  const waterMat = new StandardMaterial('lm-water', scene);
  waterMat.diffuseColor = hex('#7fd4e8');
  waterMat.emissiveColor = hex('#3a8fa8').scale(0.35);
  waterMat.specularColor = new Color3(0.25, 0.3, 0.3);
  /* opaque on purpose — alpha blending costs a whole pass on weak GPUs */

  const stoneMat = new StandardMaterial('lm-stone', scene);
  stoneMat.diffuseColor = hex('#9a978f');
  stoneMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const goldMat = new StandardMaterial('lm-gold', scene);
  goldMat.diffuseColor = hex('#caa53d');
  goldMat.emissiveColor = hex('#ffd76a').scale(0.55);
  goldMat.specularColor = new Color3(0.05, 0.05, 0.02);

  const roseMat = new StandardMaterial('lm-rose', scene);
  roseMat.diffuseColor = hex('#e05a96');
  roseMat.emissiveColor = hex('#f2549a').scale(0.3);
  roseMat.specularColor = new Color3(0.05, 0.03, 0.04);

  const tealMat = new StandardMaterial('lm-teal', scene);
  tealMat.diffuseColor = hex('#3fc3ad');
  tealMat.emissiveColor = hex('#52e0c4').scale(0.3);
  tealMat.specularColor = new Color3(0.03, 0.05, 0.05);

  /* stage 14-C: warm sand for the dunes region (pyramid, arch, ship) */
  const sandMat = new StandardMaterial('lm-sand', scene);
  sandMat.diffuseColor = hex('#dcb877');
  sandMat.specularColor = new Color3(0.06, 0.05, 0.03);

  const allMats = [barkMat, leafMat, waterMat, stoneMat, goldMat, roseMat, tealMat, sandMat];
  const allMeshes: Mesh[] = [];

  /* the parts of the CURRENT landmark, merged into one mesh per place —
     ~45 draw calls become ~20 (the fps floor is a contract, W6) */
  let group: Mesh[] = [];
  const merged: Mesh[] = [];
  const mesh = (name: string, m: Mesh): Mesh => {
    m.parent = root;
    m.isPickable = false;
    allMeshes.push(m);
    group.push(m);
    return m;
  };

  /* ---------- the builds (each a few primitives) ---------- */

  let windmillBlades: TransformNode | null = null;
  /* stage 11 animated parts (kept out of the merged mesh, like the
     windmill blades): the swing's seat, the balloon, the campfire */
  let swingSeat: TransformNode | null = null;
  let balloonNode: TransformNode | null = null;
  let balloonTop: Mesh | null = null;
  let campfireFlame: TransformNode | null = null;
  /* stage 12: the watermill wheel turns with the river */
  let watermillWheel: TransformNode | null = null;

  for (const l of LANDMARKS) {
    group = [];
    /* stage 12: region landmarks stand on the rolling hills — every
       world-anchored position below is lifted by the ground height */
    const gy = terrainHeight(l.x, l.z);
    switch (l.id) {
      case 'big-tree': {
        const trunk = mesh(`landmark-${l.id}-trunk`, MeshBuilder.CreateCylinder(`landmark-${l.id}-trunk`, { diameterTop: 0.28, diameterBottom: 0.5, height: 1.9, tessellation: 7 }, scene));
        trunk.position.set(l.x, ( 0.95) + gy,  l.z);
        trunk.material = barkMat;
        const c1 = mesh(`landmark-${l.id}-f1`, MeshBuilder.CreateSphere(`landmark-${l.id}-f1`, { diameter: 1.9, segments: 7 }, scene));
        c1.position.set(l.x, ( 2.35) + gy,  l.z);
        c1.material = leafMat;
        const c2 = mesh(`landmark-${l.id}-f2`, MeshBuilder.CreateSphere(`landmark-${l.id}-f2`, { diameter: 1.3, segments: 7 }, scene));
        c2.position.set(l.x + 0.55, ( 1.95) + gy,  l.z + 0.2);
        c2.material = leafMat;
        const c3 = mesh(`landmark-${l.id}-f3`, MeshBuilder.CreateSphere(`landmark-${l.id}-f3`, { diameter: 1.15, segments: 7 }, scene));
        c3.position.set(l.x - 0.5, ( 2.0) + gy,  l.z - 0.25);
        c3.material = leafMat;
        break;
      }
      case 'pond': {
        const water = mesh(`landmark-${l.id}-water`, MeshBuilder.CreateDisc(`landmark-${l.id}-water`, { radius: 1.25, tessellation: 20 }, scene));
        water.rotation.x = Math.PI / 2;
        water.position.set(l.x, ( 0.035) + gy,  l.z);
        water.material = waterMat;
        const pad1 = mesh(`landmark-${l.id}-pad1`, MeshBuilder.CreateDisc(`landmark-${l.id}-pad1`, { radius: 0.22, tessellation: 10 }, scene));
        pad1.rotation.x = Math.PI / 2;
        pad1.position.set(l.x - 0.35, ( 0.055) + gy,  l.z + 0.25);
        pad1.material = leafMat;
        const pad2 = mesh(`landmark-${l.id}-pad2`, MeshBuilder.CreateDisc(`landmark-${l.id}-pad2`, { radius: 0.17, tessellation: 10 }, scene));
        pad2.rotation.x = Math.PI / 2;
        pad2.position.set(l.x + 0.4, ( 0.055) + gy,  l.z - 0.3);
        pad2.material = leafMat;
        break;
      }
      case 'mushrooms': {
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const mx = l.x + Math.cos(ang) * 0.75;
          const mz = l.z + Math.sin(ang) * 0.75;
          const stem = mesh(`landmark-${l.id}-stem${i}`, MeshBuilder.CreateCylinder(`landmark-${l.id}-stem${i}`, { diameter: 0.13, height: 0.3, tessellation: 7 }, scene));
          stem.position.set(mx, ( 0.15) + gy,  mz);
          stem.material = leafMat;
          const cap = mesh(`landmark-${l.id}-cap${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-cap${i}`, { diameter: 0.34, segments: 6, slice: 0.5 }, scene));
          cap.position.set(mx, ( 0.3) + gy,  mz);
          cap.material = roseMat;
          cap.scaling.y = 0.75;
        }
        break;
      }
      case 'windmill': {
        const tower = mesh(`landmark-${l.id}-tower`, MeshBuilder.CreateCylinder(`landmark-${l.id}-tower`, { diameterTop: 0.35, diameterBottom: 0.95, height: 2.6, tessellation: 8 }, scene));
        tower.position.set(l.x, ( 1.3) + gy,  l.z);
        tower.material = stoneMat;
        const roof = mesh(`landmark-${l.id}-roof`, MeshBuilder.CreateCylinder(`landmark-${l.id}-roof`, { diameterTop: 0.02, diameterBottom: 0.42, height: 0.5, tessellation: 8 }, scene));
        roof.position.set(l.x, ( 2.85) + gy,  l.z);
        roof.material = roseMat;
        windmillBlades = new TransformNode(`landmark-${l.id}-blades`, scene);
        windmillBlades.position.set(l.x, ( 2.25) + gy,  l.z + 0.28);
        for (let i = 0; i < 2; i++) {
          const blade = MeshBuilder.CreateBox(`landmark-${l.id}-blade${i}`, { width: 1.7, height: 0.12, depth: 0.04 }, scene);
          blade.material = barkMat;
          blade.parent = windmillBlades;
          blade.rotation.z = (i * Math.PI) / 2;
          blade.isPickable = false;
          allMeshes.push(blade);
        }
        break;
      }
      case 'rainbow': {
        /* three nested rings, half-buried — the arch reads instantly */
        const radii: Array<[number, StandardMaterial]> = [
          [2.6, roseMat],
          [2.25, goldMat],
          [1.9, tealMat],
        ];
        for (let i = 0; i < radii.length; i++) {
          const ring = mesh(`landmark-${l.id}-ring${i}`, MeshBuilder.CreateTorus(`landmark-${l.id}-ring${i}`, { diameter: radii[i][0] * 2, thickness: 0.2, tessellation: 28 }, scene));
          ring.rotation.z = Math.PI / 2; /* stand the ring on its edge */
          ring.position.set(l.x, ( 0) + gy,  l.z);
          ring.material = radii[i][1];
        }
        break;
      }
      case 'fireflies': {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.4;
          const fx = l.x + Math.cos(ang) * 0.8;
          const fz = l.z + Math.sin(ang) * 0.8;
          const dot = mesh(`landmark-${l.id}-dot${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-dot${i}`, { diameter: 0.09, segments: 5 }, scene));
          dot.position.set(fx, 0.5 + (i % 3) * 0.22, fz);
          dot.material = goldMat;
          dot.isPickable = false;
        }
        break;
      }
      case 'beehive': {
        const stub = mesh(`landmark-${l.id}-stub`, MeshBuilder.CreateCylinder(`landmark-${l.id}-stub`, { diameter: 0.22, height: 1.1, tessellation: 7 }, scene));
        stub.position.set(l.x, ( 0.55) + gy,  l.z);
        stub.material = barkMat;
        const hive1 = mesh(`landmark-${l.id}-h1`, MeshBuilder.CreateSphere(`landmark-${l.id}-h1`, { diameter: 0.85, segments: 7 }, scene));
        hive1.position.set(l.x, ( 1.35) + gy,  l.z);
        hive1.material = goldMat;
        hive1.scaling.y = 0.8;
        const hive2 = mesh(`landmark-${l.id}-h2`, MeshBuilder.CreateSphere(`landmark-${l.id}-h2`, { diameter: 0.6, segments: 7 }, scene));
        hive2.position.set(l.x, ( 1.85) + gy,  l.z);
        hive2.material = goldMat;
        hive2.scaling.y = 0.75;
        break;
      }
      case 'turtle-rock': {
        const shell = mesh(`landmark-${l.id}-shell`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-shell`, { radius: 0.95, subdivisions: 2 }, scene));
        shell.position.set(l.x, ( 0.45) + gy,  l.z);
        shell.scaling.set(1.35, 0.72, 1.0);
        shell.material = stoneMat;
        const head = mesh(`landmark-${l.id}-head`, MeshBuilder.CreateSphere(`landmark-${l.id}-head`, { diameter: 0.5, segments: 6 }, scene));
        head.position.set(l.x - 1.15, ( 0.3) + gy,  l.z);
        head.material = stoneMat;
        break;
      }
      case 'orchard': {
        /* three fruit trees in a row, red fruit catching the eye */
        for (let i = 0; i < 3; i++) {
          const tx = l.x - 0.9 + i * 0.9;
          const tz = l.z + (i % 2 === 0 ? 0.35 : -0.3);
          const trunk = mesh(`landmark-${l.id}-trunk${i}`, MeshBuilder.CreateCylinder(`landmark-${l.id}-trunk${i}`, { diameterTop: 0.12, diameterBottom: 0.2, height: 1.0, tessellation: 6 }, scene));
          trunk.position.set(tx, ( 0.5) + gy,  tz);
          trunk.material = barkMat;
          const crown = mesh(`landmark-${l.id}-cr${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-cr${i}`, { diameter: 0.95, segments: 7 }, scene));
          crown.position.set(tx, ( 1.25) + gy,  tz);
          crown.material = leafMat;
          for (let f = 0; f < 3; f++) {
            const fruit = mesh(`landmark-${l.id}-f${i}-${f}`, MeshBuilder.CreateSphere(`landmark-${l.id}-f${i}-${f}`, { diameter: 0.14, segments: 6 }, scene));
            const fa = (f / 3) * Math.PI * 2 + i;
            fruit.position.set(tx + Math.cos(fa) * 0.42, 1.2 + Math.sin(fa * 2) * 0.2, tz + Math.sin(fa) * 0.42);
            fruit.material = roseMat;
          }
        }
        break;
      }
      case 'hollow-log': {
        /* a lying log with a dark mouth — who lives inside? */
        const log = mesh(`landmark-${l.id}-log`, MeshBuilder.CreateCylinder(`landmark-${l.id}-log`, { diameter: 0.6, height: 2.0, tessellation: 10 }, scene));
        log.rotation.z = Math.PI / 2;
        log.rotation.y = 0.5;
        log.position.set(l.x, ( 0.3) + gy,  l.z);
        log.material = barkMat;
        const mouth = mesh(`landmark-${l.id}-mouth`, MeshBuilder.CreateDisc(`landmark-${l.id}-mouth`, { radius: 0.24, tessellation: 12 }, scene));
        mouth.position.set(l.x + Math.cos(0.5) * 0.98, 0.32, l.z - Math.sin(0.5) * 0.98);
        mouth.rotation.y = -0.5;
        mouth.material = stoneMat;
        break;
      }
      case 'swing': {
        /* an A-frame with a seat that actually swings */
        const postL = mesh(`landmark-${l.id}-pl`, MeshBuilder.CreateCylinder(`landmark-${l.id}-pl`, { diameter: 0.09, height: 1.7, tessellation: 6 }, scene));
        postL.position.set(l.x - 0.55, ( 0.85) + gy,  l.z);
        postL.rotation.z = 0.28;
        postL.material = barkMat;
        const postR = postL.clone(`landmark-${l.id}-pr`);
        postR.position.x = l.x + 0.55;
        postR.rotation.z = -0.28;
        postR.material = barkMat;
        postR.isPickable = false;
        allMeshes.push(postR);
        const beam = mesh(`landmark-${l.id}-beam`, MeshBuilder.CreateBox(`landmark-${l.id}-beam`, { width: 1.6, height: 0.09, depth: 0.09 }, scene));
        beam.position.set(l.x, ( 1.62) + gy,  l.z);
        beam.material = barkMat;
        swingSeat = new TransformNode(`landmark-${l.id}-seat`, scene);
        swingSeat.position.set(l.x, ( 1.6) + gy,  l.z);
        swingSeat.parent = root;
        const ropeL = MeshBuilder.CreateCylinder(`landmark-${l.id}-rl`, { diameter: 0.03, height: 0.8, tessellation: 5 }, scene);
        ropeL.position.set(-0.3, -0.4, 0);
        ropeL.material = barkMat;
        ropeL.isPickable = false;
        ropeL.parent = swingSeat;
        allMeshes.push(ropeL);
        const ropeR = ropeL.clone(`landmark-${l.id}-rr`);
        ropeR.position.x = 0.3;
        ropeR.parent = swingSeat;
        allMeshes.push(ropeR);
        const seat = MeshBuilder.CreateBox(`landmark-${l.id}-seat`, { width: 0.72, height: 0.07, depth: 0.3 }, scene);
        seat.position.set(0, -0.82, 0);
        seat.material = barkMat;
        seat.isPickable = false;
        seat.parent = swingSeat;
        allMeshes.push(seat);
        break;
      }
      case 'well': {
        const ringWall = mesh(`landmark-${l.id}-wall`, MeshBuilder.CreateCylinder(`landmark-${l.id}-wall`, { diameter: 0.9, height: 0.5, tessellation: 12 }, scene));
        ringWall.position.set(l.x, ( 0.25) + gy,  l.z);
        ringWall.material = stoneMat;
        const water = mesh(`landmark-${l.id}-water`, MeshBuilder.CreateDisc(`landmark-${l.id}-water`, { radius: 0.36, tessellation: 14 }, scene));
        water.rotation.x = Math.PI / 2;
        water.position.set(l.x, ( 0.42) + gy,  l.z);
        water.material = waterMat;
        const postA = mesh(`landmark-${l.id}-pa`, MeshBuilder.CreateBox(`landmark-${l.id}-pa`, { width: 0.08, height: 0.85, depth: 0.08 }, scene));
        postA.position.set(l.x - 0.4, ( 0.85) + gy,  l.z);
        postA.material = barkMat;
        const postB = postA.clone(`landmark-${l.id}-pb`);
        postB.position.x = l.x + 0.4;
        postB.material = barkMat;
        postB.isPickable = false;
        allMeshes.push(postB);
        const roofTop = mesh(`landmark-${l.id}-roof`, MeshBuilder.CreateCylinder(`landmark-${l.id}-roof`, { diameterTop: 0.02, diameterBottom: 1.05, height: 0.35, tessellation: 4 }, scene));
        roofTop.position.set(l.x, ( 1.42) + gy,  l.z);
        roofTop.rotation.y = Math.PI / 4;
        roofTop.material = roseMat;
        break;
      }
      case 'balloon': {
        /* a great striped balloon straining at its tether */
        balloonNode = new TransformNode(`landmark-${l.id}-node`, scene);
        balloonNode.position.set(l.x, ( 0) + gy,  l.z);
        balloonNode.parent = root;
        balloonTop = MeshBuilder.CreateSphere(`landmark-${l.id}-ball`, { diameter: 1.5, segments: 10 }, scene);
        balloonTop.scaling.y = 1.15;
        balloonTop.material = roseMat;
        balloonTop.isPickable = false;
        balloonTop.parent = balloonNode;
        balloonTop.position.y = 3.4;
        allMeshes.push(balloonTop);
        const band = MeshBuilder.CreateTorus(`landmark-${l.id}-band`, { diameter: 1.28, thickness: 0.09, tessellation: 18 }, scene);
        band.scaling.y = 3.6;
        band.position.y = 3.4;
        band.material = goldMat;
        band.isPickable = false;
        band.parent = balloonNode;
        allMeshes.push(band);
        const basket = MeshBuilder.CreateBox(`landmark-${l.id}-basket`, { width: 0.3, height: 0.22, depth: 0.3 }, scene);
        basket.position.y = 2.45;
        basket.material = barkMat;
        basket.isPickable = false;
        basket.parent = balloonNode;
        allMeshes.push(basket);
        const tether = MeshBuilder.CreateCylinder(`landmark-${l.id}-tether`, { diameter: 0.02, height: 2.4, tessellation: 5 }, scene);
        tether.position.y = 1.2;
        tether.material = barkMat;
        tether.isPickable = false;
        tether.parent = balloonNode;
        allMeshes.push(tether);
        break;
      }
      case 'sunflower': {
        const stem = mesh(`landmark-${l.id}-stem`, MeshBuilder.CreateCylinder(`landmark-${l.id}-stem`, { diameterTop: 0.07, diameterBottom: 0.12, height: 1.6, tessellation: 7 }, scene));
        stem.position.set(l.x, ( 0.8) + gy,  l.z);
        stem.material = leafMat;
        const leafA = mesh(`landmark-${l.id}-la`, MeshBuilder.CreateSphere(`landmark-${l.id}-la`, { diameter: 0.3, segments: 6 }, scene));
        leafA.scaling.set(1.4, 0.4, 0.7);
        leafA.position.set(l.x - 0.22, ( 0.85) + gy,  l.z);
        leafA.material = leafMat;
        const leafB = leafA.clone(`landmark-${l.id}-lb`);
        leafB.position.set(l.x + 0.22, ( 1.15) + gy,  l.z);
        leafB.material = leafMat;
        leafB.isPickable = false;
        allMeshes.push(leafB);
        const head = mesh(`landmark-${l.id}-head`, MeshBuilder.CreateDisc(`landmark-${l.id}-head`, { radius: 0.55, tessellation: 18 }, scene));
        head.rotation.x = -0.35;
        head.position.set(l.x, ( 1.75) + gy,  l.z);
        head.material = goldMat;
        const core = mesh(`landmark-${l.id}-core`, MeshBuilder.CreateSphere(`landmark-${l.id}-core`, { diameter: 0.34, segments: 8 }, scene));
        core.position.set(l.x, ( 1.78) + gy,  l.z + 0.04);
        core.material = barkMat;
        break;
      }
      case 'crystal-cave': {
        /* a rocky mouth with teal crystals glinting inside */
        const mound = mesh(`landmark-${l.id}-mound`, MeshBuilder.CreateSphere(`landmark-${l.id}-mound`, { diameter: 2.2, segments: 8, slice: 0.62 }, scene));
        mound.position.set(l.x, ( -0.25) + gy,  l.z);
        mound.material = stoneMat;
        for (let i = 0; i < 5; i++) {
          const ang = -1.1 + i * 0.55;
          const cr = mesh(`landmark-${l.id}-cr${i}`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-cr${i}`, { type: 1, size: 0.14 + (i % 2) * 0.07 }, scene));
          cr.position.set(l.x + Math.cos(ang) * 0.55, 0.18 + (i % 3) * 0.12, l.z - 0.45 + Math.sin(ang) * 0.2);
          cr.rotation.x = 0.4;
          cr.material = tealMat;
        }
        break;
      }
      case 'campfire': {
        /* a ring of stones and a living flame */
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2;
          const st = mesh(`landmark-${l.id}-st${i}`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-st${i}`, { radius: 0.14, subdivisions: 1 }, scene));
          st.position.set(l.x + Math.cos(ang) * 0.55, 0.08, l.z + Math.sin(ang) * 0.55);
          st.material = stoneMat;
        }
        const logs = mesh(`landmark-${l.id}-logs`, MeshBuilder.CreateCylinder(`landmark-${l.id}-logs`, { diameter: 0.16, height: 0.7, tessellation: 6 }, scene));
        logs.rotation.z = Math.PI / 2.3;
        logs.rotation.y = 0.6;
        logs.position.set(l.x, ( 0.1) + gy,  l.z);
        logs.material = barkMat;
        campfireFlame = new TransformNode(`landmark-${l.id}-flame`, scene);
        campfireFlame.position.set(l.x, ( 0.2) + gy,  l.z);
        campfireFlame.parent = root;
        const flame = MeshBuilder.CreateCylinder(`landmark-${l.id}-fl`, { diameterTop: 0.01, diameterBottom: 0.22, height: 0.5, tessellation: 7 }, scene);
        flame.position.y = 0.25;
        flame.material = goldMat;
        flame.isPickable = false;
        flame.parent = campfireFlame;
        allMeshes.push(flame);
        break;
      }
      case 'giant-tree': {
        /* the forest hero — a tree the clouds almost touch */
        const trunk = mesh(`landmark-${l.id}-trunk`, MeshBuilder.CreateCylinder(`landmark-${l.id}-trunk`, { diameterTop: 0.9, diameterBottom: 1.6, height: 6.5, tessellation: 8 }, scene));
        trunk.position.set(l.x, 3.25 + gy, l.z);
        trunk.material = barkMat;
        const c1 = mesh(`landmark-${l.id}-f1`, MeshBuilder.CreateSphere(`landmark-${l.id}-f1`, { diameter: 4.6, segments: 8 }, scene));
        c1.position.set(l.x, 7.6 + gy, l.z);
        c1.material = leafMat;
        const c2 = mesh(`landmark-${l.id}-f2`, MeshBuilder.CreateSphere(`landmark-${l.id}-f2`, { diameter: 3.0, segments: 7 }, scene));
        c2.position.set(l.x + 1.4, 6.4 + gy, l.z + 0.6);
        c2.material = leafMat;
        const c3 = mesh(`landmark-${l.id}-f3`, MeshBuilder.CreateSphere(`landmark-${l.id}-f3`, { diameter: 2.6, segments: 7 }, scene));
        c3.position.set(l.x - 1.3, 6.6 + gy, l.z - 0.7);
        c3.material = leafMat;
        break;
      }
      case 'wood-hut': {
        /* a tiny forester's hut — who lives here? */
        const body = mesh(`landmark-${l.id}-body`, MeshBuilder.CreateBox(`landmark-${l.id}-body`, { width: 1.6, height: 1.1, depth: 1.4 }, scene));
        body.position.set(l.x, 0.55 + gy, l.z);
        body.material = barkMat;
        const roof = mesh(`landmark-${l.id}-roof`, MeshBuilder.CreateCylinder(`landmark-${l.id}-roof`, { diameterTop: 0.02, diameterBottom: 2.1, height: 0.8, tessellation: 4 }, scene));
        roof.position.set(l.x, 1.5 + gy, l.z);
        roof.rotation.y = Math.PI / 4;
        roof.material = roseMat;
        const door = mesh(`landmark-${l.id}-door`, MeshBuilder.CreateBox(`landmark-${l.id}-door`, { width: 0.36, height: 0.62, depth: 0.06 }, scene));
        door.position.set(l.x, 0.31 + gy, l.z + 0.72);
        door.material = stoneMat;
        break;
      }
      case 'ice-tower': {
        /* the snow hero — a glittering spire of ice */
        const base = mesh(`landmark-${l.id}-b`, MeshBuilder.CreateCylinder(`landmark-${l.id}-b`, { diameterTop: 1.1, diameterBottom: 1.6, height: 1.4, tessellation: 8 }, scene));
        base.position.set(l.x, 0.7 + gy, l.z);
        base.material = tealMat;
        const mid = mesh(`landmark-${l.id}-m`, MeshBuilder.CreateCylinder(`landmark-${l.id}-m`, { diameterTop: 0.7, diameterBottom: 1.05, height: 1.9, tessellation: 8 }, scene));
        mid.position.set(l.x, 2.3 + gy, l.z);
        mid.material = tealMat;
        const spire = mesh(`landmark-${l.id}-s`, MeshBuilder.CreateCylinder(`landmark-${l.id}-s`, { diameterTop: 0.04, diameterBottom: 0.66, height: 2.6, tessellation: 8 }, scene));
        spire.position.set(l.x, 4.5 + gy, l.z);
        spire.material = tealMat;
        const tip = mesh(`landmark-${l.id}-t`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-t`, { type: 1, size: 0.2 }, scene));
        tip.position.set(l.x, 5.9 + gy, l.z);
        tip.material = goldMat;
        break;
      }
      case 'watermill': {
        /* the river hero — a wheel that turns with the water */
        const base = mesh(`landmark-${l.id}-base`, MeshBuilder.CreateBox(`landmark-${l.id}-base`, { width: 1.7, height: 1.2, depth: 1.3 }, scene));
        base.position.set(l.x, 0.6 + gy, l.z);
        base.material = stoneMat;
        const roof = mesh(`landmark-${l.id}-roof`, MeshBuilder.CreateCylinder(`landmark-${l.id}-roof`, { diameterTop: 0.02, diameterBottom: 1.9, height: 0.7, tessellation: 4 }, scene));
        roof.position.set(l.x, 1.75 + gy, l.z);
        roof.rotation.y = Math.PI / 4;
        roof.material = barkMat;
        watermillWheel = new TransformNode(`landmark-${l.id}-wheel`, scene);
        watermillWheel.position.set(l.x + 1.15, 1.35 + gy, l.z);
        const rim = MeshBuilder.CreateTorus(`landmark-${l.id}-rim`, { diameter: 2.2, thickness: 0.14, tessellation: 20 }, scene);
        rim.material = barkMat;
        rim.isPickable = false;
        rim.parent = watermillWheel;
        allMeshes.push(rim);
        for (let i = 0; i < 4; i++) {
          const spoke = MeshBuilder.CreateBox(`landmark-${l.id}-sp${i}`, { width: 0.1, height: 2.1, depth: 0.08 }, scene);
          spoke.material = barkMat;
          spoke.rotation.z = (i * Math.PI) / 4;
          spoke.isPickable = false;
          spoke.parent = watermillWheel;
          allMeshes.push(spoke);
        }
        break;
      }
      case 'mega-flower': {
        /* the flower-hills hero — a bloom the size of a wading pool */
        const stem = mesh(`landmark-${l.id}-stem`, MeshBuilder.CreateCylinder(`landmark-${l.id}-stem`, { diameterTop: 0.16, diameterBottom: 0.3, height: 3.4, tessellation: 8 }, scene));
        stem.position.set(l.x, 1.7 + gy, l.z);
        stem.material = leafMat;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const petal = mesh(`landmark-${l.id}-p${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-p${i}`, { diameter: 1.15, segments: 7 }, scene));
          petal.scaling.set(1.35, 0.4, 0.85);
          petal.position.set(l.x + Math.cos(ang) * 1.15, 3.75 + gy, l.z + Math.sin(ang) * 1.15);
          petal.material = roseMat;
        }
        const core = mesh(`landmark-${l.id}-core`, MeshBuilder.CreateSphere(`landmark-${l.id}-core`, { diameter: 1.3, segments: 8 }, scene));
        core.position.set(l.x, 3.75 + gy, l.z);
        core.material = goldMat;
        break;
      }
      case 'obelisk': {
        /* the dunes hero — a needle of sandstone with a golden cap */
        const body = mesh(`landmark-${l.id}-body`, MeshBuilder.CreateCylinder(`landmark-${l.id}-body`, { diameterTop: 0.5, diameterBottom: 1.0, height: 5.2, tessellation: 4 }, scene));
        body.position.set(l.x, 2.6 + gy, l.z);
        body.rotation.y = Math.PI / 4;
        body.material = stoneMat;
        const cap = mesh(`landmark-${l.id}-cap`, MeshBuilder.CreateCylinder(`landmark-${l.id}-cap`, { diameterTop: 0.02, diameterBottom: 0.55, height: 0.7, tessellation: 4 }, scene));
        cap.position.set(l.x, 5.5 + gy, l.z);
        cap.rotation.y = Math.PI / 4;
        cap.material = goldMat;
        break;
      }
      case 'oasis': {
        /* a pool of water between the dunes, two leaning palms */
        const water = mesh(`landmark-${l.id}-water`, MeshBuilder.CreateDisc(`landmark-${l.id}-water`, { radius: 1.5, tessellation: 18 }, scene));
        water.rotation.x = Math.PI / 2;
        water.position.set(l.x, 0.035 + gy, l.z);
        water.material = waterMat;
        for (const side of [-1, 1]) {
          const trunk = mesh(`landmark-${l.id}-tr${side}`, MeshBuilder.CreateCylinder(`landmark-${l.id}-tr${side}`, { diameterTop: 0.1, diameterBottom: 0.2, height: 2.4, tessellation: 6 }, scene));
          trunk.position.set(l.x + side * 1.7, 1.2 + gy, l.z + 0.4);
          trunk.rotation.z = -side * 0.22;
          trunk.material = barkMat;
          for (let k = 0; k < 4; k++) {
            const ang = (k / 4) * Math.PI * 2 + side;
            const frond = mesh(`landmark-${l.id}-fr${side}-${k}`, MeshBuilder.CreateSphere(`landmark-${l.id}-fr${side}-${k}`, { diameter: 0.75, segments: 6 }, scene));
            frond.scaling.set(1.5, 0.3, 0.6);
            frond.position.set(l.x + side * 1.7 + Math.cos(ang) * 0.62, 2.5 + gy, l.z + 0.4 + Math.sin(ang) * 0.5);
            frond.material = leafMat;
          }
        }
        break;
      }
      case 'stone-arch': {
        /* the rocky hero — an ancient gate of standing stones */
        const pilL = mesh(`landmark-${l.id}-pl`, MeshBuilder.CreateBox(`landmark-${l.id}-pl`, { width: 0.55, height: 3.4, depth: 0.6 }, scene));
        pilL.position.set(l.x - 1.05, 1.7 + gy, l.z);
        pilL.rotation.z = 0.03;
        pilL.material = stoneMat;
        const pilR = mesh(`landmark-${l.id}-pr`, MeshBuilder.CreateBox(`landmark-${l.id}-pr`, { width: 0.55, height: 3.4, depth: 0.6 }, scene));
        pilR.position.set(l.x + 1.05, 1.7 + gy, l.z);
        pilR.rotation.z = -0.03;
        pilR.material = stoneMat;
        const lintel = mesh(`landmark-${l.id}-li`, MeshBuilder.CreateBox(`landmark-${l.id}-li`, { width: 3.1, height: 0.55, depth: 0.7 }, scene));
        lintel.position.set(l.x, 3.65 + gy, l.z);
        lintel.material = stoneMat;
        const rock1 = mesh(`landmark-${l.id}-r1`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-r1`, { radius: 0.4, subdivisions: 1 }, scene));
        rock1.position.set(l.x - 2.0, 0.2 + gy, l.z + 0.8);
        rock1.material = stoneMat;
        const rock2 = mesh(`landmark-${l.id}-r2`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-r2`, { radius: 0.3, subdivisions: 1 }, scene));
        rock2.position.set(l.x + 2.1, 0.15 + gy, l.z - 0.6);
        rock2.material = stoneMat;
        break;
      }
      /* ---------- stage 14-C: twenty more silhouettes, one per line ---------- */
      case 'watch-tower': {
        /* the forest hero — a tall lookout, ~12u of stacked stone */
        const base = mesh(`landmark-${l.id}-b`, MeshBuilder.CreateCylinder(`landmark-${l.id}-b`, { diameter: 3.4, height: 1.1, tessellation: 10 }, scene));
        base.position.set(l.x, 0.55 + gy, l.z);
        base.material = stoneMat;
        const shaft = mesh(`landmark-${l.id}-s`, MeshBuilder.CreateCylinder(`landmark-${l.id}-s`, { diameterBottom: 2.6, diameterTop: 2.0, height: 8.4, tessellation: 10 }, scene));
        shaft.position.set(l.x, 5.0 + gy, l.z);
        shaft.material = stoneMat;
        const rail = mesh(`landmark-${l.id}-r`, MeshBuilder.CreateCylinder(`landmark-${l.id}-r`, { diameter: 2.9, height: 0.5, tessellation: 10 }, scene));
        rail.position.set(l.x, 9.7 + gy, l.z);
        rail.material = barkMat;
        const roof = mesh(`landmark-${l.id}-rf`, MeshBuilder.CreateCylinder(`landmark-${l.id}-rf`, { diameterTop: 0, diameterBottom: 3.2, height: 1.8, tessellation: 10 }, scene));
        roof.position.set(l.x, 10.8 + gy, l.z);
        roof.material = leafMat;
        break;
      }
      case 'giant-mushrooms': {
        /* the forest hero — three friendly giants, tallest ~9u */
        const specs: Array<[number, number, number, number]> = [
          [1.7, 4.6, 2.6, 0], [1.1, 3.1, 2.9, 2.6], [0.9, 2.4, 2.2, -2.4],
        ]; /* [stemR, capY, capR, zOff] */
        for (let i = 0; i < specs.length; i++) {
          const [sr, cy, cr, zo] = specs[i];
          const stem = mesh(`landmark-${l.id}-s${i}`, MeshBuilder.CreateCylinder(`landmark-${l.id}-s${i}`, { diameterBottom: sr * 1.25, diameterTop: sr, height: cy * 0.78, tessellation: 9 }, scene));
          stem.position.set(l.x + zo * 0.4, (cy * 0.78) / 2 + gy, l.z + zo);
          stem.material = goldMat;
          const cap = mesh(`landmark-${l.id}-c${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-c${i}`, { diameterX: cr * 2, diameterY: cr * 1.1, diameterZ: cr * 2, segments: 6 }, scene));
          cap.position.set(l.x + zo * 0.4, cy + gy, l.z + zo);
          cap.material = roseMat;
        }
        break;
      }
      case 'hollow-stump': {
        /* a big old stump you can peek into, ~4.5u */
        const body = mesh(`landmark-${l.id}-b`, MeshBuilder.CreateCylinder(`landmark-${l.id}-b`, { diameterBottom: 3.4, diameterTop: 2.9, height: 4.2, tessellation: 12 }, scene));
        body.position.set(l.x, 2.1 + gy, l.z);
        body.material = barkMat;
        const rim = mesh(`landmark-${l.id}-r`, MeshBuilder.CreateTorus(`landmark-${l.id}-r`, { diameter: 2.9, thickness: 0.5, tessellation: 12 }, scene));
        rim.position.set(l.x, 4.2 + gy, l.z);
        rim.rotation.x = Math.PI / 2;
        rim.material = barkMat;
        const hole = mesh(`landmark-${l.id}-h`, MeshBuilder.CreateDisc(`landmark-${l.id}-h`, { radius: 1.2, tessellation: 12 }, scene));
        hole.position.set(l.x, 4.16 + gy, l.z);
        hole.rotation.x = Math.PI / 2;
        hole.material = stoneMat;
        break;
      }
      case 'wood-arch': {
        /* two leaning logs holding a fallen branch — the forest gate, ~6u */
        const p1 = mesh(`landmark-${l.id}-p1`, MeshBuilder.CreateCylinder(`landmark-${l.id}-p1`, { diameter: 0.8, height: 5.6, tessellation: 8 }, scene));
        p1.position.set(l.x - 1.7, 2.8 + gy, l.z);
        p1.rotation.z = 0.07;
        p1.material = barkMat;
        const p2 = mesh(`landmark-${l.id}-p2`, MeshBuilder.CreateCylinder(`landmark-${l.id}-p2`, { diameter: 0.8, height: 5.6, tessellation: 8 }, scene));
        p2.position.set(l.x + 1.7, 2.8 + gy, l.z);
        p2.rotation.z = -0.07;
        p2.material = barkMat;
        const top = mesh(`landmark-${l.id}-t`, MeshBuilder.CreateCylinder(`landmark-${l.id}-t`, { diameter: 0.9, height: 4.2, tessellation: 8 }, scene));
        top.position.set(l.x, 5.9 + gy, l.z);
        top.rotation.z = Math.PI / 2;
        top.material = barkMat;
        const tuft = mesh(`landmark-${l.id}-tf`, MeshBuilder.CreateSphere(`landmark-${l.id}-tf`, { diameter: 1.4, segments: 5 }, scene));
        tuft.position.set(l.x - 1.2, 6.2 + gy, l.z);
        tuft.material = leafMat;
        break;
      }
      case 'ice-arch': {
        /* the snow hero — a frozen gate of glittering ice, ~7u */
        const iL = mesh(`landmark-${l.id}-il`, MeshBuilder.CreateBox(`landmark-${l.id}-il`, { width: 0.9, height: 6.0, depth: 0.9 }, scene));
        iL.position.set(l.x - 1.6, 3.0 + gy, l.z);
        iL.rotation.z = 0.05;
        iL.material = tealMat;
        const iR = mesh(`landmark-${l.id}-ir`, MeshBuilder.CreateBox(`landmark-${l.id}-ir`, { width: 0.9, height: 5.4, depth: 0.9 }, scene));
        iR.position.set(l.x + 1.6, 2.7 + gy, l.z);
        iR.rotation.z = -0.06;
        iR.material = tealMat;
        const iT = mesh(`landmark-${l.id}-it`, MeshBuilder.CreateBox(`landmark-${l.id}-it`, { width: 4.4, height: 0.9, depth: 1.0 }, scene));
        iT.position.set(l.x, 6.4 + gy, l.z);
        iT.material = tealMat;
        const iS = mesh(`landmark-${l.id}-is`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-is`, { type: 1, size: 0.5 }, scene));
        iS.position.set(l.x + 2.6, 0.5 + gy, l.z + 1.1);
        iS.material = tealMat;
        break;
      }
      case 'igloo': {
        /* a snow home with its entrance tunnel, ~4u */
        const dome = mesh(`landmark-${l.id}-d`, MeshBuilder.CreateSphere(`landmark-${l.id}-d`, { diameterX: 6.4, diameterY: 3.6, diameterZ: 6.4, segments: 7, slice: 0.5 }, scene));
        dome.position.set(l.x, 0.05 + gy, l.z);
        dome.material = tealMat;
        const tun = mesh(`landmark-${l.id}-t`, MeshBuilder.CreateCylinder(`landmark-${l.id}-t`, { diameter: 1.7, height: 2.4, tessellation: 9, cap: Mesh.CAP_ALL }, scene));
        tun.position.set(l.x, 0.85 + gy, l.z + 3.4);
        tun.rotation.x = Math.PI / 2;
        tun.material = tealMat;
        break;
      }
      case 'ice-crystal': {
        /* three frozen spikes catching the light, ~6.5u */
        const c1 = mesh(`landmark-${l.id}-c1`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-c1`, { type: 1, size: 1.5 }, scene));
        c1.position.set(l.x, 2.6 + gy, l.z);
        c1.scaling.y = 2.2;
        c1.material = tealMat;
        const c2 = mesh(`landmark-${l.id}-c2`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-c2`, { type: 1, size: 1.0 }, scene));
        c2.position.set(l.x + 1.9, 1.4 + gy, l.z + 0.7);
        c2.scaling.y = 1.7;
        c2.rotation.z = 0.22;
        c2.material = tealMat;
        const c3 = mesh(`landmark-${l.id}-c3`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-c3`, { type: 1, size: 0.8 }, scene));
        c3.position.set(l.x - 1.6, 1.1 + gy, l.z - 0.8);
        c3.scaling.y = 1.5;
        c3.rotation.z = -0.18;
        c3.material = tealMat;
        break;
      }
      case 'waterfall-rock': {
        /* the river hero — a cliff the water sings down, ~10u */
        const cliff = mesh(`landmark-${l.id}-cl`, MeshBuilder.CreateBox(`landmark-${l.id}-cl`, { width: 5.4, height: 9.4, depth: 3.0 }, scene));
        cliff.position.set(l.x, 4.7 + gy, l.z - 0.6);
        cliff.rotation.y = 0.12;
        cliff.material = stoneMat;
        const fall = mesh(`landmark-${l.id}-f`, MeshBuilder.CreatePlane(`landmark-${l.id}-f`, { width: 2.6, height: 8.6 }, scene));
        fall.position.set(l.x, 4.3 + gy, l.z + 1.05);
        fall.material = waterMat;
        const pool = mesh(`landmark-${l.id}-p`, MeshBuilder.CreateDisc(`landmark-${l.id}-p`, { radius: 2.6, tessellation: 14 }, scene));
        pool.position.set(l.x, 0.06 + gy, l.z + 2.2);
        pool.rotation.x = Math.PI / 2;
        pool.material = waterMat;
        const mist = mesh(`landmark-${l.id}-m`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-m`, { radius: 0.9, subdivisions: 1 }, scene));
        mist.position.set(l.x, 1.1 + gy, l.z + 2.2);
        mist.material = waterMat;
        break;
      }
      case 'ferry-boat': {
        /* the river hero — a little boat waiting at the bank, ~9u */
        const hull = mesh(`landmark-${l.id}-h`, MeshBuilder.CreateCylinder(`landmark-${l.id}-h`, { diameterTop: 3.4, diameterBottom: 1.6, height: 1.5, tessellation: 7, cap: Mesh.CAP_ALL }, scene));
        hull.position.set(l.x, 0.75 + gy, l.z);
        hull.rotation.y = 0.5;
        hull.material = barkMat;
        const deck = mesh(`landmark-${l.id}-d`, MeshBuilder.CreateBox(`landmark-${l.id}-d`, { width: 2.8, height: 0.25, depth: 1.7 }, scene));
        deck.position.set(l.x, 1.6 + gy, l.z);
        deck.rotation.y = 0.5;
        deck.material = barkMat;
        const mast = mesh(`landmark-${l.id}-m`, MeshBuilder.CreateCylinder(`landmark-${l.id}-m`, { diameter: 0.22, height: 6.4, tessellation: 7 }, scene));
        mast.position.set(l.x, 4.6 + gy, l.z);
        mast.material = barkMat;
        const sail = mesh(`landmark-${l.id}-s`, MeshBuilder.CreatePlane(`landmark-${l.id}-s`, { width: 2.9, height: 3.4 }, scene));
        sail.position.set(l.x + 1.15, 5.4 + gy, l.z - 0.65);
        sail.rotation.y = 0.5;
        sail.material = roseMat;
        break;
      }
      case 'willow-tree': {
        /* the river's curtain tree — trunk + falling canopy, ~8u */
        const trunk = mesh(`landmark-${l.id}-t`, MeshBuilder.CreateCylinder(`landmark-${l.id}-t`, { diameterBottom: 1.5, diameterTop: 0.9, height: 5.2, tessellation: 9 }, scene));
        trunk.position.set(l.x, 2.6 + gy, l.z);
        trunk.rotation.z = 0.06;
        trunk.material = barkMat;
        const crown = mesh(`landmark-${l.id}-c`, MeshBuilder.CreateSphere(`landmark-${l.id}-c`, { diameterX: 8.4, diameterY: 5.4, diameterZ: 8.4, segments: 6 }, scene));
        crown.position.set(l.x, 6.6 + gy, l.z);
        crown.material = leafMat;
        const skirt = mesh(`landmark-${l.id}-sk`, MeshBuilder.CreateCylinder(`landmark-${l.id}-sk`, { diameterTop: 8.0, diameterBottom: 5.2, height: 2.6, tessellation: 12, cap: Mesh.NO_CAP }, scene));
        skirt.position.set(l.x, 3.4 + gy, l.z);
        skirt.material = leafMat;
        break;
      }
      case 'giant-tulip': {
        /* the flower hero — one tulip taller than the fox's whole day, ~8u */
        const stem = mesh(`landmark-${l.id}-st`, MeshBuilder.CreateCylinder(`landmark-${l.id}-st`, { diameterBottom: 0.75, diameterTop: 0.45, height: 5.6, tessellation: 8 }, scene));
        stem.position.set(l.x, 2.8 + gy, l.z);
        stem.material = leafMat;
        const leafA = mesh(`landmark-${l.id}-la`, MeshBuilder.CreateBox(`landmark-${l.id}-la`, { width: 0.3, height: 3.2, depth: 1.1 }, scene));
        leafA.position.set(l.x - 0.9, 2.0 + gy, l.z);
        leafA.rotation.z = 0.5;
        leafA.material = leafMat;
        const cup = mesh(`landmark-${l.id}-c`, MeshBuilder.CreateCylinder(`landmark-${l.id}-c`, { diameterBottom: 1.1, diameterTop: 2.6, height: 2.8, tessellation: 8, cap: Mesh.CAP_ALL }, scene));
        cup.position.set(l.x, 7.0 + gy, l.z);
        cup.material = roseMat;
        const petA = mesh(`landmark-${l.id}-pa`, MeshBuilder.CreateSphere(`landmark-${l.id}-pa`, { diameterX: 2.2, diameterY: 1.1, diameterZ: 0.5, segments: 5 }, scene));
        petA.position.set(l.x, 8.2 + gy, l.z - 1.1);
        petA.rotation.x = -0.4;
        petA.material = roseMat;
        const petB = mesh(`landmark-${l.id}-pb`, MeshBuilder.CreateSphere(`landmark-${l.id}-pb`, { diameterX: 0.5, diameterY: 1.1, diameterZ: 2.2, segments: 5 }, scene));
        petB.position.set(l.x - 1.1, 8.2 + gy, l.z);
        petB.rotation.z = 0.4;
        petB.material = roseMat;
        break;
      }
      case 'dandelion-tower': {
        /* a seed-head on a stalk — the wind's tower, ~7u */
        const stalk = mesh(`landmark-${l.id}-st`, MeshBuilder.CreateCylinder(`landmark-${l.id}-st`, { diameterBottom: 0.4, diameterTop: 0.22, height: 5.4, tessellation: 7 }, scene));
        stalk.position.set(l.x, 2.7 + gy, l.z);
        stalk.material = leafMat;
        const head = mesh(`landmark-${l.id}-h`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-h`, { radius: 1.9, subdivisions: 1 }, scene));
        head.position.set(l.x, 7.1 + gy, l.z);
        head.material = goldMat;
        const seed1 = mesh(`landmark-${l.id}-s1`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-s1`, { type: 1, size: 0.24 }, scene));
        seed1.position.set(l.x + 2.3, 8.0 + gy, l.z + 0.6);
        seed1.material = goldMat;
        const seed2 = mesh(`landmark-${l.id}-s2`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-s2`, { type: 1, size: 0.2 }, scene));
        seed2.position.set(l.x - 2.0, 8.4 + gy, l.z - 0.9);
        seed2.material = goldMat;
        break;
      }
      case 'petal-arch': {
        /* an arch of pink petals — walk through it slowly, ~5.5u */
        const aL = mesh(`landmark-${l.id}-al`, MeshBuilder.CreateCylinder(`landmark-${l.id}-al`, { diameter: 0.55, height: 4.4, tessellation: 7 }, scene));
        aL.position.set(l.x - 1.4, 2.2 + gy, l.z);
        aL.rotation.z = 0.32;
        aL.material = roseMat;
        const aR = mesh(`landmark-${l.id}-ar`, MeshBuilder.CreateCylinder(`landmark-${l.id}-ar`, { diameter: 0.55, height: 4.4, tessellation: 7 }, scene));
        aR.position.set(l.x + 1.4, 2.2 + gy, l.z);
        aR.rotation.z = -0.32;
        aR.material = roseMat;
        const crown = mesh(`landmark-${l.id}-cr`, MeshBuilder.CreateTorus(`landmark-${l.id}-cr`, { diameter: 3.4, thickness: 0.5, tessellation: 12 }, scene));
        crown.position.set(l.x, 4.9 + gy, l.z);
        crown.rotation.x = Math.PI / 2;
        crown.material = roseMat;
        break;
      }
      case 'rose-ring': {
        /* a circle of rose bushes around one open middle, ~6u across */
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2;
          const bx = l.x + Math.cos(ang) * 2.9;
          const bz = l.z + Math.sin(ang) * 2.9;
          const bush = mesh(`landmark-${l.id}-b${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-b${i}`, { diameterX: 1.9, diameterY: 1.4, diameterZ: 1.9, segments: 5 }, scene));
          bush.position.set(bx, 0.6 + gy, bz);
          bush.material = leafMat;
          const bloom = mesh(`landmark-${l.id}-f${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-f${i}`, { diameterX: 0.85, diameterY: 0.6, diameterZ: 0.85, segments: 5 }, scene));
          bloom.position.set(bx, 1.35 + gy, bz);
          bloom.material = roseMat;
        }
        break;
      }
      case 'sand-pyramid': {
        /* the dunes hero — three stepped pyramids of sand, tallest ~9u */
        const p1 = mesh(`landmark-${l.id}-p1`, MeshBuilder.CreateCylinder(`landmark-${l.id}-p1`, { diameterTop: 0, diameterBottom: 7.2, height: 8.8, tessellation: 4 }, scene));
        p1.position.set(l.x, 4.4 + gy, l.z);
        p1.rotation.y = Math.PI / 4;
        p1.material = sandMat;
        const p2 = mesh(`landmark-${l.id}-p2`, MeshBuilder.CreateCylinder(`landmark-${l.id}-p2`, { diameterTop: 0, diameterBottom: 4.4, height: 5.2, tessellation: 4 }, scene));
        p2.position.set(l.x + 5.6, 2.6 + gy, l.z + 2.4);
        p2.rotation.y = Math.PI / 4;
        p2.material = sandMat;
        const p3 = mesh(`landmark-${l.id}-p3`, MeshBuilder.CreateCylinder(`landmark-${l.id}-p3`, { diameterTop: 0, diameterBottom: 2.8, height: 3.0, tessellation: 4 }, scene));
        p3.position.set(l.x - 4.6, 1.5 + gy, l.z + 3.4);
        p3.rotation.y = Math.PI / 4;
        p3.material = sandMat;
        break;
      }
      case 'dune-arch': {
        /* the wind carved a gate through the sand, ~6u */
        const dL = mesh(`landmark-${l.id}-dl`, MeshBuilder.CreateCylinder(`landmark-${l.id}-dl`, { diameterBottom: 1.6, diameterTop: 1.2, height: 5.4, tessellation: 8 }, scene));
        dL.position.set(l.x - 1.9, 2.7 + gy, l.z);
        dL.rotation.z = 0.05;
        dL.material = sandMat;
        const dR = mesh(`landmark-${l.id}-dr`, MeshBuilder.CreateCylinder(`landmark-${l.id}-dr`, { diameterBottom: 1.5, diameterTop: 1.1, height: 4.8, tessellation: 8 }, scene));
        dR.position.set(l.x + 1.9, 2.4 + gy, l.z);
        dR.rotation.z = -0.07;
        dR.material = sandMat;
        const dT = mesh(`landmark-${l.id}-dt`, MeshBuilder.CreateCylinder(`landmark-${l.id}-dt`, { diameter: 1.3, height: 4.6, tessellation: 8 }, scene));
        dT.position.set(l.x, 5.8 + gy, l.z);
        dT.rotation.z = Math.PI / 2;
        dT.material = sandMat;
        break;
      }
      case 'buried-ship': {
        /* the dunes hero — an old hull the sand keeps, ~10u long */
        const hull = mesh(`landmark-${l.id}-h`, MeshBuilder.CreateCylinder(`landmark-${l.id}-h`, { diameterTop: 4.4, diameterBottom: 2.2, height: 9.2, tessellation: 6, cap: Mesh.CAP_ALL }, scene));
        hull.position.set(l.x, 1.4 + gy, l.z);
        hull.rotation.z = Math.PI / 2;
        hull.rotation.y = 0.35;
        hull.material = barkMat;
        const ribA = mesh(`landmark-${l.id}-ra`, MeshBuilder.CreateBox(`landmark-${l.id}-ra`, { width: 0.4, height: 3.2, depth: 0.4 }, scene));
        ribA.position.set(l.x + 1.4, 2.6 + gy, l.z - 1.6);
        ribA.rotation.z = 0.4;
        ribA.material = barkMat;
        const ribB = mesh(`landmark-${l.id}-rb`, MeshBuilder.CreateBox(`landmark-${l.id}-rb`, { width: 0.4, height: 2.4, depth: 0.4 }, scene));
        ribB.position.set(l.x - 1.6, 2.1 + gy, l.z + 1.4);
        ribB.rotation.z = -0.35;
        ribB.material = barkMat;
        const dune = mesh(`landmark-${l.id}-d`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-d`, { radius: 2.6, subdivisions: 1 }, scene));
        dune.position.set(l.x - 4.2, 0.3 + gy, l.z + 2.8);
        dune.scaling.y = 0.45;
        dune.material = sandMat;
        break;
      }
      case 'ruined-gate': {
        /* the rocky hero — a mountain gate that lost its top, ~11u */
        const gL = mesh(`landmark-${l.id}-gl`, MeshBuilder.CreateBox(`landmark-${l.id}-gl`, { width: 1.7, height: 10.4, depth: 1.7 }, scene));
        gL.position.set(l.x - 2.4, 5.2 + gy, l.z);
        gL.rotation.z = 0.04;
        gL.material = stoneMat;
        const gR = mesh(`landmark-${l.id}-gr`, MeshBuilder.CreateBox(`landmark-${l.id}-gr`, { width: 1.7, height: 7.2, depth: 1.7 }, scene));
        gR.position.set(l.x + 2.4, 3.6 + gy, l.z);
        gR.rotation.z = -0.06;
        gR.material = stoneMat;
        const fall = mesh(`landmark-${l.id}-f`, MeshBuilder.CreateBox(`landmark-${l.id}-f`, { width: 3.6, height: 0.9, depth: 1.4 }, scene));
        fall.position.set(l.x + 1.2, 0.45 + gy, l.z + 2.6);
        fall.rotation.y = 0.7;
        fall.material = stoneMat;
        const block = mesh(`landmark-${l.id}-b`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-b`, { radius: 0.9, subdivisions: 1 }, scene));
        block.position.set(l.x - 1.4, 0.5 + gy, l.z + 3.1);
        block.material = stoneMat;
        break;
      }
      case 'crystal-cluster': {
        /* the rocky's glitter — a family of snow-remembering crystals, ~7u */
        const k1 = mesh(`landmark-${l.id}-k1`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-k1`, { type: 1, size: 1.6 }, scene));
        k1.position.set(l.x, 2.8 + gy, l.z);
        k1.scaling.y = 2.1;
        k1.material = tealMat;
        const k2 = mesh(`landmark-${l.id}-k2`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-k2`, { type: 1, size: 1.1 }, scene));
        k2.position.set(l.x + 2.1, 1.5 + gy, l.z + 0.8);
        k2.scaling.y = 1.6;
        k2.rotation.z = 0.24;
        k2.material = goldMat;
        const k3 = mesh(`landmark-${l.id}-k3`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-k3`, { type: 1, size: 0.9 }, scene));
        k3.position.set(l.x - 1.9, 1.2 + gy, l.z - 0.9);
        k3.scaling.y = 1.5;
        k3.rotation.z = -0.2;
        k3.material = tealMat;
        const k4 = mesh(`landmark-${l.id}-k4`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-k4`, { type: 1, size: 0.6 }, scene));
        k4.position.set(l.x + 0.6, 0.6 + gy, l.z - 1.9);
        k4.scaling.y = 1.3;
        k4.material = goldMat;
        break;
      }
      case 'stone-circle': {
        /* the rocky hero — ancient stones waiting in a ring, ~8u tall ring */
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const sx = l.x + Math.cos(ang) * 3.4;
          const sz = l.z + Math.sin(ang) * 3.4;
          const hgt = 3.4 + (i % 3) * 1.5;
          const stone = mesh(`landmark-${l.id}-s${i}`, MeshBuilder.CreateBox(`landmark-${l.id}-s${i}`, { width: 1.05, height: hgt, depth: 0.75 }, scene));
          stone.position.set(sx, hgt / 2 + gy, sz);
          stone.rotation.y = ang;
          stone.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.05;
          stone.material = stoneMat;
        }
        const heart = mesh(`landmark-${l.id}-h`, MeshBuilder.CreateDisc(`landmark-${l.id}-h`, { radius: 1.3, tessellation: 12 }, scene));
        heart.position.set(l.x, 0.05 + gy, l.z);
        heart.rotation.x = Math.PI / 2;
        heart.material = goldMat;
        break;
      }
      /* ---------- stage 14-E: the far reaches ---------- */
      case 'honey-tree': {
        /* a golden-leaved tree at the far west, ~8u */
        const trunk = mesh(`landmark-${l.id}-t`, MeshBuilder.CreateCylinder(`landmark-${l.id}-t`, { diameterBottom: 1.3, diameterTop: 0.8, height: 4.8, tessellation: 8 }, scene));
        trunk.position.set(l.x, 2.4 + gy, l.z);
        trunk.rotation.z = 0.05;
        trunk.material = barkMat;
        const crown = mesh(`landmark-${l.id}-c`, MeshBuilder.CreateSphere(`landmark-${l.id}-c`, { diameterX: 6.8, diameterY: 5.0, diameterZ: 6.8, segments: 6 }, scene));
        crown.position.set(l.x, 6.4 + gy, l.z);
        crown.material = goldMat;
        const drop = mesh(`landmark-${l.id}-d`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-d`, { radius: 0.32, subdivisions: 1 }, scene));
        drop.position.set(l.x + 1.6, 3.4 + gy, l.z + 1.1);
        drop.material = goldMat;
        break;
      }
      case 'moon-pond': {
        /* a night-remembering pond with its little moon, ~4u across */
        const rim = mesh(`landmark-${l.id}-r`, MeshBuilder.CreateTorus(`landmark-${l.id}-r`, { diameter: 4.4, thickness: 0.4, tessellation: 14 }, scene));
        rim.position.set(l.x, 0.12 + gy, l.z);
        rim.scaling.y = 0.4;
        rim.material = stoneMat;
        const water = mesh(`landmark-${l.id}-w`, MeshBuilder.CreateDisc(`landmark-${l.id}-w`, { radius: 2.1, tessellation: 18 }, scene));
        water.position.set(l.x, 0.08 + gy, l.z);
        water.rotation.x = Math.PI / 2;
        water.material = tealMat;
        const moon = mesh(`landmark-${l.id}-m`, MeshBuilder.CreateSphere(`landmark-${l.id}-m`, { diameter: 1.5, segments: 7 }, scene));
        moon.position.set(l.x, 0.35 + gy, l.z);
        moon.material = goldMat;
        break;
      }
      case 'snow-friend': {
        /* a snow friend with a carrot smile, ~4.5u */
        const base = mesh(`landmark-${l.id}-b`, MeshBuilder.CreateSphere(`landmark-${l.id}-b`, { diameterX: 3.0, diameterY: 2.4, diameterZ: 3.0, segments: 6 }, scene));
        base.position.set(l.x, 1.1 + gy, l.z);
        base.material = tealMat;
        const head = mesh(`landmark-${l.id}-h`, MeshBuilder.CreateSphere(`landmark-${l.id}-h`, { diameter: 2.0, segments: 6 }, scene));
        head.position.set(l.x, 3.1 + gy, l.z);
        head.material = tealMat;
        const nose = mesh(`landmark-${l.id}-n`, MeshBuilder.CreateCylinder(`landmark-${l.id}-n`, { diameterBottom: 0.1, diameterTop: 0.22, height: 0.9, tessellation: 6 }, scene));
        nose.position.set(l.x, 3.2 + gy, l.z + 1.1);
        nose.rotation.x = Math.PI / 2;
        nose.material = goldMat;
        const eyeL = mesh(`landmark-${l.id}-el`, MeshBuilder.CreateSphere(`landmark-${l.id}-el`, { diameter: 0.22, segments: 4 }, scene));
        eyeL.position.set(l.x - 0.35, 3.5 + gy, l.z + 0.9);
        eyeL.material = stoneMat;
        const eyeR = mesh(`landmark-${l.id}-er`, MeshBuilder.CreateSphere(`landmark-${l.id}-er`, { diameter: 0.22, segments: 4 }, scene));
        eyeR.position.set(l.x + 0.35, 3.5 + gy, l.z + 0.9);
        eyeR.material = stoneMat;
        break;
      }
      case 'reed-hut': {
        /* a river-reed hut with a soft roof, ~5u */
        const wall = mesh(`landmark-${l.id}-w`, MeshBuilder.CreateCylinder(`landmark-${l.id}-w`, { diameterBottom: 3.0, diameterTop: 1.6, height: 3.6, tessellation: 9 }, scene));
        wall.position.set(l.x, 1.8 + gy, l.z);
        wall.material = leafMat;
        const door = mesh(`landmark-${l.id}-d`, MeshBuilder.CreatePlane(`landmark-${l.id}-d`, { width: 0.9, height: 1.5 }, scene));
        door.position.set(l.x, 0.75 + gy, l.z + 1.5);
        door.material = barkMat;
        const top = mesh(`landmark-${l.id}-t`, MeshBuilder.CreateSphere(`landmark-${l.id}-t`, { diameterX: 2.0, diameterY: 1.2, diameterZ: 2.0, segments: 5 }, scene));
        top.position.set(l.x, 3.9 + gy, l.z);
        top.material = goldMat;
        const reed = mesh(`landmark-${l.id}-r`, MeshBuilder.CreateCylinder(`landmark-${l.id}-r`, { diameter: 0.1, height: 1.6, tessellation: 5 }, scene));
        reed.position.set(l.x + 2.1, 0.8 + gy, l.z + 1.4);
        reed.material = leafMat;
        break;
      }
      case 'sun-clock': {
        /* an ancient stone sundial, ~4u */
        const base = mesh(`landmark-${l.id}-b`, MeshBuilder.CreateCylinder(`landmark-${l.id}-b`, { diameter: 3.2, height: 0.7, tessellation: 12 }, scene));
        base.position.set(l.x, 0.35 + gy, l.z);
        base.material = stoneMat;
        const pillar = mesh(`landmark-${l.id}-p`, MeshBuilder.CreateCylinder(`landmark-${l.id}-p`, { diameterBottom: 0.5, diameterTop: 0.3, height: 3.4, tessellation: 8 }, scene));
        pillar.position.set(l.x, 2.2 + gy, l.z);
        pillar.rotation.z = 0.2;
        pillar.material = stoneMat;
        const ring = mesh(`landmark-${l.id}-rg`, MeshBuilder.CreateTorus(`landmark-${l.id}-rg`, { diameter: 1.4, thickness: 0.16, tessellation: 12 }, scene));
        ring.position.set(l.x + 0.5, 3.6 + gy, l.z);
        ring.rotation.y = 0.4;
        ring.material = goldMat;
        break;
      }
      case 'star-stone': {
        /* a fallen star — a five-pointed monolith, ~7u */
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const arm = mesh(`landmark-${l.id}-a${i}`, MeshBuilder.CreateBox(`landmark-${l.id}-a${i}`, { width: 0.7, height: 5.2, depth: 0.5 }, scene));
          arm.position.set(l.x + Math.cos(ang) * 1.4, 2.2 + gy, l.z + Math.sin(ang) * 1.4);
          arm.rotation.y = -ang;
          arm.rotation.z = 0.14;
          arm.material = stoneMat;
        }
        const core = mesh(`landmark-${l.id}-c`, MeshBuilder.CreatePolyhedron(`landmark-${l.id}-c`, { type: 1, size: 1.0 }, scene));
        core.position.set(l.x, 4.6 + gy, l.z);
        core.material = goldMat;
        break;
      }
    }

    /* merge the place's static parts into ONE mesh (multi-material keeps
       every look) — the fps floor is a contract, not a wish (critic W6).
       The firefly dots stay separate: they bob individually. */
    if (l.id !== 'fireflies' && group.length > 1) {
      const mergedMesh = Mesh.MergeMeshes(group, true, false, undefined, false, true);
      if (mergedMesh) {
        mergedMesh.name = `landmark-${l.id}`;
        mergedMesh.parent = root;
        mergedMesh.isPickable = true; /* a tap on the place resolves a walk to its rim */
        mergedMesh.position.setAll(0); /* sources carried absolute positions */
        merged.push(mergedMesh);
      }
    } else if (group.length > 0) {
      /* unmerged groups (single mesh or firefly dots) become pickable here */
      for (const m of group) m.isPickable = true;
    }
    group = [];
  }

  /* disposed sources leave the dispose list; merged meshes join it */
  const liveMeshes = allMeshes.filter((m) => !m.isDisposed()).concat(merged);

  /* stage 12: per-landmark culling — 24 places × 1-2 meshes each would
     double the draw calls; only the neighborhood is drawn (SwiftShader
     keeps its floor, the continent keeps its secrets until visited) */
  const cullByLandmark = new Map<string, Mesh[]>();
  for (const l of LANDMARKS) cullByLandmark.set(l.id, []);
  for (const m of liveMeshes) {
    for (const l of LANDMARKS) {
      if (m.name.startsWith(`landmark-${l.id}`)) {
        cullByLandmark.get(l.id)!.push(m);
        break;
      }
    }
  }

  const LANDMARK_VISIBILITY = 120;

  /* ---------- beacons: one shared gold look, hidden once found ---------- */

  const beacons = new Map<string, Mesh>();
  const bobbers: Bobber[] = [];
  /* stage 14-C: every region now has interior heroes too */
  const HEROES = new Set<string>([
    'giant-tree', 'wood-hut', 'ice-tower', 'watermill', 'mega-flower', 'obelisk', 'oasis', 'stone-arch',
    'watch-tower', 'giant-mushrooms', 'waterfall-rock', 'ferry-boat', 'giant-tulip', 'sand-pyramid',
    'buried-ship', 'ruined-gate', 'crystal-cluster', 'stone-circle',
    'honey-tree', 'snow-friend', 'star-stone',
  ]);
  for (const l of LANDMARKS) {
    const bgy = terrainHeight(l.x, l.z);
    const bh = HEROES.has(l.id) ? 5.2 : 2.9;
    const b = MeshBuilder.CreatePolyhedron(`landmark-beacon-${l.id}`, { type: 1, size: 0.22 }, scene);
    b.position.set(l.x, bh + bgy, l.z);
    b.material = goldMat;
    b.isPickable = false;
    b.parent = root;
    beacons.set(l.id, b);
    bobbers.push({ mesh: b, baseY: bh + bgy, amp: 0.14, speed: 1.6 + bobbers.length * 0.13, phase: bobbers.length * 1.31 });
  }
  /* firefly dots bob too — reuse the same pre-built table */
  for (const m of liveMeshes) {
    if (m.name.startsWith('landmark-fireflies-dot')) {
      bobbers.push({ mesh: m, baseY: m.position.y, amp: 0.1, speed: 1.1 + bobbers.length * 0.09, phase: bobbers.length * 0.97 });
    }
  }
  /* the beacons cull with their place (a far beacon is invisible anyway) */
  for (const [id, b] of beacons) cullByLandmark.get(id)!.push(b);

  let questTarget: string | null = null;
  /* stage 12: the daily journey's three targets keep their beacons */
  let dailyTargets = new Set<string>();
  let foundIds = new Set<string>();

  return {
    setFound(ids: ReadonlySet<string>): void {
      foundIds = new Set(ids);
      for (const [id, b] of beacons) {
        b.setEnabled(!ids.has(id) || dailyTargets.has(id));
      }
    },
    setDailyTargets(ids: ReadonlyArray<string>): void {
      dailyTargets = new Set(ids);
      for (const [id, b] of beacons) {
        b.setEnabled(!foundIds.has(id) || dailyTargets.has(id));
      }
    },
    setQuestTarget(id: string | null): void {
      questTarget = id;
      for (const [lid, b] of beacons) {
        const tall = lid === id;
        b.scaling.setAll(tall ? 2.1 : 1);
      }
    },
    update(t: number, dt: number, px?: number, pz?: number): void {
      if (windmillBlades) windmillBlades.rotation.y += dt * 0.55;
      if (watermillWheel) watermillWheel.rotation.z += dt * 0.8;
      /* stage 11: the swing swings, the balloon strains upward, the
         campfire breathes — small living motions, transform-only */
      if (swingSeat) swingSeat.rotation.x = Math.sin(t * 1.3) * 0.28;
      if (balloonNode && balloonTop) {
        balloonNode.position.y = Math.sin(t * 0.7) * 0.18;
        balloonTop.rotation.z = Math.sin(t * 0.5) * 0.06;
      }
      if (campfireFlame) {
        const flick = 0.85 + Math.abs(Math.sin(t * 7.3)) * 0.3;
        campfireFlame.scaling.y = flick;
        campfireFlame.rotation.y += dt * 2.2;
      }
      for (let i = 0; i < bobbers.length; i++) {
        const b = bobbers[i];
        b.mesh.position.y = b.baseY + Math.sin(t * b.speed + b.phase) * b.amp;
      }
      if (questTarget) {
        const b = beacons.get(questTarget);
        if (b && b.isEnabled()) b.rotation.y += dt * 1.4;
      }
      /* stage 12: cull far landmarks (called with the walker's position) */
      if (px !== undefined && pz !== undefined) {
        for (const l of LANDMARKS) {
          const show = Math.hypot(l.x - px, l.z - pz) < LANDMARK_VISIBILITY;
          for (const m of cullByLandmark.get(l.id) ?? []) {
            if (m.isEnabled() !== show) m.setEnabled(show);
          }
        }
      }
    },
    spots(project): LandmarkScreenSpot[] {
      const out: LandmarkScreenSpot[] = [];
      for (const l of LANDMARKS) {
        const p = project(new Vector3(l.x, 2.9 + terrainHeight(l.x, l.z), l.z));
        out.push({ id: l.id, x: p.x, y: p.y, on: p.on });
      }
      return out;
    },
    glowExclusions: () => liveMeshes,
    dispose(): void {
      for (const m of liveMeshes) m.dispose();
      for (const [, b] of beacons) b.dispose();
      if (windmillBlades) windmillBlades.dispose();
      if (swingSeat) swingSeat.dispose();
      if (balloonNode) balloonNode.dispose();
      if (campfireFlame) campfireFlame.dispose();
      if (watermillWheel) watermillWheel.dispose();
      root.dispose(false, true);
      for (const m of allMats) m.dispose();
    },
  };
}
