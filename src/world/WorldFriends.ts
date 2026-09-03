/* ============================================================
 * WorldFriends — the named faces beside the road (stage 11).
 *
 * A long walk needs company. Four friends live at fixed places in
 * the garden (FRIENDS in WorldLayout): a bee who hovers, a snail
 * who slides his slow circle, a frog who hops in place, and a
 * bunny whose ears listen. They are NEVER a gate and NEVER a
 * task — proximity just raises a bubble (the shell owns the words).
 *
 * Performance discipline: shared materials, per-frame transform
 * writes only, symmetric dispose.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { FRIENDS } from './WorldLayout';

const hex = (s: string): Color3 => Color3.FromHexString(s);

export interface FriendScreenSpot {
  id: string;
  x: number;
  y: number;
  on: boolean;
}

export interface FriendsHandle {
  update(t: number, dt: number): void;
  /** canvas-fraction anchors for the friend bubbles */
  spots(project: (p: Vector3) => { x: number; y: number; on: boolean }): FriendScreenSpot[];
  dispose(): void;
}

interface FriendAnim {
  root: TransformNode;
  baseX: number;
  baseZ: number;
  baseY: number;
  wings?: Mesh[];
  ears?: Mesh[];
  body?: Mesh;
}

export function buildFriends(scene: Scene): FriendsHandle {
  const root = new TransformNode('friends-root', scene);

  const goldMat = new StandardMaterial('fr-gold', scene);
  goldMat.diffuseColor = hex('#f2c14e');
  goldMat.emissiveColor = hex('#c98f1e').scale(0.25);
  goldMat.specularColor = new Color3(0.05, 0.04, 0.02);
  const darkMat = new StandardMaterial('fr-dark', scene);
  darkMat.diffuseColor = hex('#3c3226');
  darkMat.specularColor = new Color3(0.02, 0.02, 0.02);
  const shellMat = new StandardMaterial('fr-shell', scene);
  shellMat.diffuseColor = hex('#b0713d');
  shellMat.specularColor = new Color3(0.06, 0.05, 0.04);
  const softMat = new StandardMaterial('fr-soft', scene);
  softMat.diffuseColor = hex('#efe3cf');
  softMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const greenMat = new StandardMaterial('fr-green', scene);
  greenMat.diffuseColor = hex('#5fae5f');
  greenMat.specularColor = new Color3(0.02, 0.04, 0.02);
  const whiteMat = new StandardMaterial('fr-white', scene);
  whiteMat.diffuseColor = hex('#f4f6f2');
  whiteMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const wingMat = new StandardMaterial('fr-wing', scene);
  wingMat.diffuseColor = hex('#e8f2fa');
  wingMat.alpha = 0.72;
  wingMat.specularColor = new Color3(0.1, 0.1, 0.12);
  const allMats = [goldMat, darkMat, shellMat, softMat, greenMat, whiteMat, wingMat];

  const anims = new Map<string, FriendAnim>();
  const live: Mesh[] = [];

  const put = (parent: TransformNode, m: Mesh, mat: StandardMaterial | null, x = 0, y = 0, z = 0): Mesh => {
    m.material = mat;
    m.position.set(x, y, z);
    m.parent = parent;
    m.isPickable = false;
    live.push(m);
    return m;
  };

  for (const f of FRIENDS) {
    const node = new TransformNode(`fr-${f.id}`, scene);
    node.parent = root;
    const anim: FriendAnim = { root: node, baseX: f.x, baseZ: f.z, baseY: 0 };

    if (f.id === 'bee') {
      anim.baseY = 0.62;
      const b = put(node, MeshBuilder.CreateSphere(`fr-bee-b`, { diameter: 0.3, segments: 7 }, scene), goldMat, 0, 0, 0);
      b.scaling.set(1, 0.85, 1.3);
      const stripe = put(node, MeshBuilder.CreateSphere(`fr-bee-s`, { diameter: 0.24, segments: 6 }, scene), darkMat, 0, 0, -0.02);
      stripe.scaling.set(1.02, 0.5, 0.55);
      put(node, MeshBuilder.CreateSphere(`fr-bee-h`, { diameter: 0.2, segments: 7 }, scene), darkMat, 0, 0.02, 0.18);
      const wl = put(node, MeshBuilder.CreateDisc(`fr-bee-wl`, { radius: 0.13, tessellation: 8 }, scene), wingMat, -0.11, 0.14, 0);
      wl.rotation.x = -Math.PI / 2.4;
      const wr = put(node, MeshBuilder.CreateDisc(`fr-bee-wr`, { radius: 0.13, tessellation: 8 }, scene), wingMat, 0.11, 0.14, 0);
      wr.rotation.x = -Math.PI / 2.4;
      anim.wings = [wl, wr];
    } else if (f.id === 'snail') {
      anim.baseY = 0.02;
      const shell = put(node, MeshBuilder.CreateSphere(`fr-snail-sh`, { diameter: 0.3, segments: 8 }, scene), shellMat, 0, 0.2, -0.02);
      shell.scaling.set(1, 1, 0.75);
      const slug = put(node, MeshBuilder.CreateSphere(`fr-snail-sl`, { diameter: 0.16, segments: 7 }, scene), softMat, 0, 0.08, 0.14);
      slug.scaling.set(0.9, 0.75, 1.9);
      put(node, MeshBuilder.CreateCylinder(`fr-snail-stl`, { diameter: 0.02, height: 0.13, tessellation: 5 }, scene), softMat, -0.045, 0.21, 0.25);
      put(node, MeshBuilder.CreateCylinder(`fr-snail-str`, { diameter: 0.02, height: 0.13, tessellation: 5 }, scene), softMat, 0.045, 0.21, 0.25);
    } else if (f.id === 'frog') {
      anim.baseY = 0.1;
      const b = put(node, MeshBuilder.CreateSphere(`fr-frog-b`, { diameter: 0.32, segments: 8 }, scene), greenMat, 0, 0, 0);
      b.scaling.set(1.05, 0.72, 1.15);
      put(node, MeshBuilder.CreateSphere(`fr-frog-el`, { diameter: 0.1, segments: 6 }, scene), greenMat, -0.08, 0.16, 0.08);
      put(node, MeshBuilder.CreateSphere(`fr-frog-er`, { diameter: 0.1, segments: 6 }, scene), greenMat, 0.08, 0.16, 0.08);
      anim.body = b;
    } else if (f.id === 'hedgehog') {
      /* stage 12: the forest friend — a pincushion with a soft nose */
      anim.baseY = 0.12;
      const b = put(node, MeshBuilder.CreateIcoSphere(`fr-hg-b`, { radius: 0.2, subdivisions: 1 }, scene), shellMat, 0, 0, -0.02);
      b.scaling.set(1.1, 0.85, 1.25);
      put(node, MeshBuilder.CreateSphere(`fr-hg-h`, { diameter: 0.17, segments: 7 }, scene), softMat, 0, 0.03, 0.19);
      put(node, MeshBuilder.CreateSphere(`fr-hg-n`, { diameter: 0.06, segments: 5 }, scene), darkMat, 0, 0.03, 0.28);
      for (let i = 0; i < 5; i++) {
        const spike = put(
          node,
          MeshBuilder.CreateCylinder(`fr-hg-s${i}`, { diameterTop: 0, diameterBottom: 0.045, height: 0.16, tessellation: 5 }, scene),
          darkMat,
          Math.cos(i * 1.3) * 0.1,
          0.16,
          -0.05 + Math.sin(i * 1.3) * 0.1,
        );
        spike.rotation.x = -0.4;
      }
      anim.body = b;
    } else if (f.id === 'penguin') {
      /* stage 12: the snow friend — a round bird in a tuxedo */
      anim.baseY = 0.16;
      const b = put(node, MeshBuilder.CreateSphere(`fr-pn-b`, { diameter: 0.36, segments: 9 }, scene), darkMat, 0, 0, 0);
      b.scaling.set(0.9, 1.15, 0.9);
      const belly = put(node, MeshBuilder.CreateSphere(`fr-pn-w`, { diameter: 0.3, segments: 8 }, scene), whiteMat, 0, -0.02, 0.08);
      belly.scaling.set(0.85, 1.0, 0.7);
      put(node, MeshBuilder.CreateSphere(`fr-pn-h`, { diameter: 0.22, segments: 8 }, scene), darkMat, 0, 0.24, 0.02);
      const beak = put(node, MeshBuilder.CreateCylinder(`fr-pn-bk`, { diameterTop: 0.01, diameterBottom: 0.07, height: 0.14, tessellation: 6 }, scene), goldMat, 0, 0.23, 0.16);
      beak.rotation.x = Math.PI / 2.2;
      const fl = put(node, MeshBuilder.CreateSphere(`fr-pn-fl`, { diameter: 0.1, segments: 6 }, scene), darkMat, -0.18, 0.02, 0);
      fl.scaling.set(0.5, 1.1, 0.8);
      const fr = put(node, MeshBuilder.CreateSphere(`fr-pn-fr`, { diameter: 0.1, segments: 6 }, scene), darkMat, 0.18, 0.02, 0);
      fr.scaling.set(0.5, 1.1, 0.8);
      anim.wings = [fl, fr];
      anim.body = b;
    } else if (f.id === 'lizard') {
      /* stage 12: the dunes friend — sunbathing, tail in the sand */
      anim.baseY = 0.05;
      const b = put(node, MeshBuilder.CreateSphere(`fr-lz-b`, { diameter: 0.26, segments: 8 }, scene), greenMat, 0, 0, 0);
      b.scaling.set(1.0, 0.5, 1.6);
      put(node, MeshBuilder.CreateSphere(`fr-lz-h`, { diameter: 0.14, segments: 7 }, scene), greenMat, 0, 0.05, 0.22);
      const tail = put(node, MeshBuilder.CreateCylinder(`fr-lz-t`, { diameterTop: 0.02, diameterBottom: 0.08, height: 0.4, tessellation: 6 }, scene), greenMat, 0, 0.02, -0.3);
      tail.rotation.x = Math.PI / 2.2;
      anim.body = b;
    } else {
      /* bunny */
      anim.baseY = 0.16;
      const b = put(node, MeshBuilder.CreateSphere(`fr-bun-b`, { diameter: 0.34, segments: 8 }, scene), softMat, 0, 0, 0);
      b.scaling.set(0.92, 0.85, 1.2);
      put(node, MeshBuilder.CreateSphere(`fr-bun-h`, { diameter: 0.24, segments: 8 }, scene), softMat, 0, 0.16, 0.16);
      const el = put(node, MeshBuilder.CreateCylinder(`fr-bun-el`, { diameterTop: 0.03, diameterBottom: 0.06, height: 0.26, tessellation: 6 }, scene), softMat, -0.06, 0.36, 0.13);
      el.rotation.z = 0.14;
      const er = put(node, MeshBuilder.CreateCylinder(`fr-bun-er`, { diameterTop: 0.03, diameterBottom: 0.06, height: 0.26, tessellation: 6 }, scene), softMat, 0.06, 0.36, 0.13);
      er.rotation.z = -0.14;
      put(node, MeshBuilder.CreateSphere(`fr-bun-t`, { diameter: 0.11, segments: 6 }, scene), goldMat, 0, 0.04, -0.2);
      anim.ears = [el, er];
    }

    node.position.set(f.x, anim.baseY, f.z);
    anims.set(f.id, anim);
  }

  return {
    update(t, dt) {
      void dt;
      /* the bee hovers on her sine, wings a blur */
      const bee = anims.get('bee');
      if (bee) {
        bee.root.position.y = bee.baseY + Math.sin(t * 2.8) * 0.07;
        bee.root.rotation.y = Math.sin(t * 0.9) * 0.5;
        if (bee.wings) {
          bee.wings[0].rotation.z = Math.sin(t * 24) * 0.6;
          bee.wings[1].rotation.z = -Math.sin(t * 24) * 0.6;
        }
      }
      /* the snail draws his slow circle around his patch */
      const snail = anims.get('snail');
      if (snail) {
        const a = t * 0.1;
        snail.root.position.x = snail.baseX + Math.cos(a) * 0.5;
        snail.root.position.z = snail.baseZ + Math.sin(a) * 0.5;
        snail.root.rotation.y = -a;
      }
      /* the frog hops in place, gently */
      const frog = anims.get('frog');
      if (frog) {
        const hop = Math.abs(Math.sin(t * 1.4));
        frog.root.position.y = frog.baseY + hop * 0.09;
        if (frog.body) frog.body.scaling.y = 0.72 * (1 - hop * 0.1);
      }
      /* the bunny's ears listen to the wind */
      const bun = anims.get('bunny');
      if (bun && bun.ears) {
        bun.ears[0].rotation.x = Math.sin(t * 1.1) * 0.14;
        bun.ears[1].rotation.x = Math.sin(t * 1.1 + 0.4) * 0.14;
      }
      /* stage 12: the hedgehog snuffles, the penguin flaps, the lizard basks */
      const hg = anims.get('hedgehog');
      if (hg) hg.root.rotation.y = Math.sin(t * 0.8) * 0.3;
      const pn = anims.get('penguin');
      if (pn) {
        if (pn.wings) {
          pn.wings[0].rotation.z = Math.sin(t * 6) * 0.5;
          pn.wings[1].rotation.z = -Math.sin(t * 6) * 0.5;
        }
        pn.root.rotation.y = Math.sin(t * 0.55) * 0.6;
      }
      const lz = anims.get('lizard');
      if (lz && lz.body) lz.body.scaling.y = 0.5 * (1 + Math.sin(t * 1.9) * 0.06);
    },
    spots(project) {
      const out: FriendScreenSpot[] = [];
      for (const f of FRIENDS) {
        const p = project(new Vector3(f.x, 0.9, f.z));
        out.push({ id: f.id, x: p.x, y: p.y, on: p.on });
      }
      return out;
    },
    dispose() {
      for (const m of live) m.dispose();
      root.dispose(false, true);
      for (const m of allMats) m.dispose();
    },
  };
}
