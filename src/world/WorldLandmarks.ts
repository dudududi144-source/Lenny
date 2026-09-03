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
  /** The active wayfinding quest's target — its beacon stands tall. */
  setQuestTarget(id: string | null): void;
  /** Per-frame life: windmill spin, firefly + beacon bob. No allocs. */
  update(t: number, dt: number): void;
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

  const allMats = [barkMat, leafMat, waterMat, stoneMat, goldMat, roseMat, tealMat];
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

  for (const l of LANDMARKS) {
    group = [];
    switch (l.id) {
      case 'big-tree': {
        const trunk = mesh(`landmark-${l.id}-trunk`, MeshBuilder.CreateCylinder(`landmark-${l.id}-trunk`, { diameterTop: 0.28, diameterBottom: 0.5, height: 1.9, tessellation: 7 }, scene));
        trunk.position.set(l.x, 0.95, l.z);
        trunk.material = barkMat;
        const c1 = mesh(`landmark-${l.id}-f1`, MeshBuilder.CreateSphere(`landmark-${l.id}-f1`, { diameter: 1.9, segments: 7 }, scene));
        c1.position.set(l.x, 2.35, l.z);
        c1.material = leafMat;
        const c2 = mesh(`landmark-${l.id}-f2`, MeshBuilder.CreateSphere(`landmark-${l.id}-f2`, { diameter: 1.3, segments: 7 }, scene));
        c2.position.set(l.x + 0.55, 1.95, l.z + 0.2);
        c2.material = leafMat;
        const c3 = mesh(`landmark-${l.id}-f3`, MeshBuilder.CreateSphere(`landmark-${l.id}-f3`, { diameter: 1.15, segments: 7 }, scene));
        c3.position.set(l.x - 0.5, 2.0, l.z - 0.25);
        c3.material = leafMat;
        break;
      }
      case 'pond': {
        const water = mesh(`landmark-${l.id}-water`, MeshBuilder.CreateDisc(`landmark-${l.id}-water`, { radius: 1.25, tessellation: 20 }, scene));
        water.rotation.x = Math.PI / 2;
        water.position.set(l.x, 0.035, l.z);
        water.material = waterMat;
        const pad1 = mesh(`landmark-${l.id}-pad1`, MeshBuilder.CreateDisc(`landmark-${l.id}-pad1`, { radius: 0.22, tessellation: 10 }, scene));
        pad1.rotation.x = Math.PI / 2;
        pad1.position.set(l.x - 0.35, 0.055, l.z + 0.25);
        pad1.material = leafMat;
        const pad2 = mesh(`landmark-${l.id}-pad2`, MeshBuilder.CreateDisc(`landmark-${l.id}-pad2`, { radius: 0.17, tessellation: 10 }, scene));
        pad2.rotation.x = Math.PI / 2;
        pad2.position.set(l.x + 0.4, 0.055, l.z - 0.3);
        pad2.material = leafMat;
        break;
      }
      case 'mushrooms': {
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const mx = l.x + Math.cos(ang) * 0.75;
          const mz = l.z + Math.sin(ang) * 0.75;
          const stem = mesh(`landmark-${l.id}-stem${i}`, MeshBuilder.CreateCylinder(`landmark-${l.id}-stem${i}`, { diameter: 0.13, height: 0.3, tessellation: 7 }, scene));
          stem.position.set(mx, 0.15, mz);
          stem.material = leafMat;
          const cap = mesh(`landmark-${l.id}-cap${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-cap${i}`, { diameter: 0.34, segments: 6, slice: 0.5 }, scene));
          cap.position.set(mx, 0.3, mz);
          cap.material = roseMat;
          cap.scaling.y = 0.75;
        }
        break;
      }
      case 'windmill': {
        const tower = mesh(`landmark-${l.id}-tower`, MeshBuilder.CreateCylinder(`landmark-${l.id}-tower`, { diameterTop: 0.35, diameterBottom: 0.95, height: 2.6, tessellation: 8 }, scene));
        tower.position.set(l.x, 1.3, l.z);
        tower.material = stoneMat;
        const roof = mesh(`landmark-${l.id}-roof`, MeshBuilder.CreateCylinder(`landmark-${l.id}-roof`, { diameterTop: 0.02, diameterBottom: 0.42, height: 0.5, tessellation: 8 }, scene));
        roof.position.set(l.x, 2.85, l.z);
        roof.material = roseMat;
        windmillBlades = new TransformNode(`landmark-${l.id}-blades`, scene);
        windmillBlades.position.set(l.x, 2.25, l.z + 0.28);
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
          ring.position.set(l.x, 0, l.z);
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
        stub.position.set(l.x, 0.55, l.z);
        stub.material = barkMat;
        const hive1 = mesh(`landmark-${l.id}-h1`, MeshBuilder.CreateSphere(`landmark-${l.id}-h1`, { diameter: 0.85, segments: 7 }, scene));
        hive1.position.set(l.x, 1.35, l.z);
        hive1.material = goldMat;
        hive1.scaling.y = 0.8;
        const hive2 = mesh(`landmark-${l.id}-h2`, MeshBuilder.CreateSphere(`landmark-${l.id}-h2`, { diameter: 0.6, segments: 7 }, scene));
        hive2.position.set(l.x, 1.85, l.z);
        hive2.material = goldMat;
        hive2.scaling.y = 0.75;
        break;
      }
      case 'turtle-rock': {
        const shell = mesh(`landmark-${l.id}-shell`, MeshBuilder.CreateIcoSphere(`landmark-${l.id}-shell`, { radius: 0.95, subdivisions: 2 }, scene));
        shell.position.set(l.x, 0.45, l.z);
        shell.scaling.set(1.35, 0.72, 1.0);
        shell.material = stoneMat;
        const head = mesh(`landmark-${l.id}-head`, MeshBuilder.CreateSphere(`landmark-${l.id}-head`, { diameter: 0.5, segments: 6 }, scene));
        head.position.set(l.x - 1.15, 0.3, l.z);
        head.material = stoneMat;
        break;
      }
      case 'orchard': {
        /* three fruit trees in a row, red fruit catching the eye */
        for (let i = 0; i < 3; i++) {
          const tx = l.x - 0.9 + i * 0.9;
          const tz = l.z + (i % 2 === 0 ? 0.35 : -0.3);
          const trunk = mesh(`landmark-${l.id}-trunk${i}`, MeshBuilder.CreateCylinder(`landmark-${l.id}-trunk${i}`, { diameterTop: 0.12, diameterBottom: 0.2, height: 1.0, tessellation: 6 }, scene));
          trunk.position.set(tx, 0.5, tz);
          trunk.material = barkMat;
          const crown = mesh(`landmark-${l.id}-cr${i}`, MeshBuilder.CreateSphere(`landmark-${l.id}-cr${i}`, { diameter: 0.95, segments: 7 }, scene));
          crown.position.set(tx, 1.25, tz);
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
        log.position.set(l.x, 0.3, l.z);
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
        postL.position.set(l.x - 0.55, 0.85, l.z);
        postL.rotation.z = 0.28;
        postL.material = barkMat;
        const postR = postL.clone(`landmark-${l.id}-pr`);
        postR.position.x = l.x + 0.55;
        postR.rotation.z = -0.28;
        postR.material = barkMat;
        postR.isPickable = false;
        allMeshes.push(postR);
        const beam = mesh(`landmark-${l.id}-beam`, MeshBuilder.CreateBox(`landmark-${l.id}-beam`, { width: 1.6, height: 0.09, depth: 0.09 }, scene));
        beam.position.set(l.x, 1.62, l.z);
        beam.material = barkMat;
        swingSeat = new TransformNode(`landmark-${l.id}-seat`, scene);
        swingSeat.position.set(l.x, 1.6, l.z);
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
        ringWall.position.set(l.x, 0.25, l.z);
        ringWall.material = stoneMat;
        const water = mesh(`landmark-${l.id}-water`, MeshBuilder.CreateDisc(`landmark-${l.id}-water`, { radius: 0.36, tessellation: 14 }, scene));
        water.rotation.x = Math.PI / 2;
        water.position.set(l.x, 0.42, l.z);
        water.material = waterMat;
        const postA = mesh(`landmark-${l.id}-pa`, MeshBuilder.CreateBox(`landmark-${l.id}-pa`, { width: 0.08, height: 0.85, depth: 0.08 }, scene));
        postA.position.set(l.x - 0.4, 0.85, l.z);
        postA.material = barkMat;
        const postB = postA.clone(`landmark-${l.id}-pb`);
        postB.position.x = l.x + 0.4;
        postB.material = barkMat;
        postB.isPickable = false;
        allMeshes.push(postB);
        const roofTop = mesh(`landmark-${l.id}-roof`, MeshBuilder.CreateCylinder(`landmark-${l.id}-roof`, { diameterTop: 0.02, diameterBottom: 1.05, height: 0.35, tessellation: 4 }, scene));
        roofTop.position.set(l.x, 1.42, l.z);
        roofTop.rotation.y = Math.PI / 4;
        roofTop.material = roseMat;
        break;
      }
      case 'balloon': {
        /* a great striped balloon straining at its tether */
        balloonNode = new TransformNode(`landmark-${l.id}-node`, scene);
        balloonNode.position.set(l.x, 0, l.z);
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
        stem.position.set(l.x, 0.8, l.z);
        stem.material = leafMat;
        const leafA = mesh(`landmark-${l.id}-la`, MeshBuilder.CreateSphere(`landmark-${l.id}-la`, { diameter: 0.3, segments: 6 }, scene));
        leafA.scaling.set(1.4, 0.4, 0.7);
        leafA.position.set(l.x - 0.22, 0.85, l.z);
        leafA.material = leafMat;
        const leafB = leafA.clone(`landmark-${l.id}-lb`);
        leafB.position.set(l.x + 0.22, 1.15, l.z);
        leafB.material = leafMat;
        leafB.isPickable = false;
        allMeshes.push(leafB);
        const head = mesh(`landmark-${l.id}-head`, MeshBuilder.CreateDisc(`landmark-${l.id}-head`, { radius: 0.55, tessellation: 18 }, scene));
        head.rotation.x = -0.35;
        head.position.set(l.x, 1.75, l.z);
        head.material = goldMat;
        const core = mesh(`landmark-${l.id}-core`, MeshBuilder.CreateSphere(`landmark-${l.id}-core`, { diameter: 0.34, segments: 8 }, scene));
        core.position.set(l.x, 1.78, l.z + 0.04);
        core.material = barkMat;
        break;
      }
      case 'crystal-cave': {
        /* a rocky mouth with teal crystals glinting inside */
        const mound = mesh(`landmark-${l.id}-mound`, MeshBuilder.CreateSphere(`landmark-${l.id}-mound`, { diameter: 2.2, segments: 8, slice: 0.62 }, scene));
        mound.position.set(l.x, -0.25, l.z);
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
        logs.position.set(l.x, 0.1, l.z);
        logs.material = barkMat;
        campfireFlame = new TransformNode(`landmark-${l.id}-flame`, scene);
        campfireFlame.position.set(l.x, 0.2, l.z);
        campfireFlame.parent = root;
        const flame = MeshBuilder.CreateCylinder(`landmark-${l.id}-fl`, { diameterTop: 0.01, diameterBottom: 0.22, height: 0.5, tessellation: 7 }, scene);
        flame.position.y = 0.25;
        flame.material = goldMat;
        flame.isPickable = false;
        flame.parent = campfireFlame;
        allMeshes.push(flame);
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

  /* ---------- beacons: one shared gold look, hidden once found ---------- */

  const beacons = new Map<string, Mesh>();
  const bobbers: Bobber[] = [];
  for (const l of LANDMARKS) {
    const b = MeshBuilder.CreatePolyhedron(`landmark-beacon-${l.id}`, { type: 1, size: 0.22 }, scene);
    b.position.set(l.x, 2.9, l.z);
    b.material = goldMat;
    b.isPickable = false;
    b.parent = root;
    beacons.set(l.id, b);
    bobbers.push({ mesh: b, baseY: 2.9, amp: 0.14, speed: 1.6 + bobbers.length * 0.13, phase: bobbers.length * 1.31 });
  }
  /* firefly dots bob too — reuse the same pre-built table */
  for (const m of liveMeshes) {
    if (m.name.startsWith('landmark-fireflies-dot')) {
      bobbers.push({ mesh: m, baseY: m.position.y, amp: 0.1, speed: 1.1 + bobbers.length * 0.09, phase: bobbers.length * 0.97 });
    }
  }

  let questTarget: string | null = null;

  return {
    setFound(ids: ReadonlySet<string>): void {
      for (const [id, b] of beacons) {
        b.setEnabled(!ids.has(id));
      }
    },
    setQuestTarget(id: string | null): void {
      questTarget = id;
      for (const [lid, b] of beacons) {
        const tall = lid === id;
        b.scaling.setAll(tall ? 2.1 : 1);
      }
    },
    update(t: number, dt: number): void {
      if (windmillBlades) windmillBlades.rotation.y += dt * 0.55;
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
    },
    spots(project): LandmarkScreenSpot[] {
      const out: LandmarkScreenSpot[] = [];
      for (const l of LANDMARKS) {
        const p = project(new Vector3(l.x, 2.9, l.z));
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
      root.dispose(false, true);
      for (const m of allMats) m.dispose();
    },
  };
}
