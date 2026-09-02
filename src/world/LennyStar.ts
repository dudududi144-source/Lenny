/* ============================================================
 * LennyStar — the companion (Stage 7, commit 5).
 *
 * Lenny is a small low-poly golden star that hovers just above
 * the child's presence point: bobbing on a sine, leaning toward
 * the walking direction, eyes always finding the camera. She is
 * never a guide arrow and never a gate — just a friend who is
 * happy when you arrive (the ETHICS of a companion, not a boss).
 *
 * Her words are never new content: arrival bubbles speak the
 * zone's own mission line from data/garden.ts.
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { GARDEN_TEXT, getZone, type ZoneId } from '../data/garden';

/** The bubble line Lenny says when the child arrives somewhere (pure). */
export function bubbleLineFor(zone: ZoneId | null): string | null {
  if (!zone) return null;
  return getZone(zone)?.mission ?? GARDEN_TEXT.playInvite;
}

/* ---------- star geometry (pure math, unit-testable) ---------- */

export function starPolygon(outerR: number, innerR: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = Math.PI / 2 + (i * Math.PI) / 5; /* first spike points up */
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

function buildStarMesh(scene: Scene): Mesh {
  const pts = starPolygon(0.34, 0.14);
  /* fan triangulation from the centroid — a 5-point star is convex
     around its center in this winding */
  const positions: number[] = [];
  const indices: number[] = [];
  const cx = 0;
  const cy = 0;
  positions.push(cx, cy, 0);
  for (const p of pts) positions.push(p.x, p.y, 0);
  for (let i = 0; i < 10; i++) {
    indices.push(0, 1 + i, 1 + ((i + 1) % 10));
  }
  const mesh = new Mesh('lenny-star', scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.normals = normals;
  vd.applyToMesh(mesh);
  /* the camera should always find her face */
  mesh.material = new StandardMaterial('lenny-mat', scene);
  const mat = mesh.material as StandardMaterial;
  mat.emissiveColor = Color3.FromHexString('#ffd76a').scale(1.25);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  return mesh;
}

/* ---------- the companion handle ---------- */

export interface LennyStarHandle {
  /** Drive the bob/lean/eyes; pos = presence, vel = its world velocity. */
  update(t: number, dt: number, pos: { x: number; z: number }, vel: { x: number; z: number }, nearZone: ZoneId | null): void;
  /** Lenny's world position (for bubbles + shadows). */
  worldPos(): Vector3;
  /** The star body mesh (shadow caster). */
  bodyMesh(): Mesh;
  dispose(): void;
}

export function buildLennyStar(scene: Scene): LennyStarHandle {
  const root = new TransformNode('lenny-root', scene);

  const body = buildStarMesh(scene);
  body.parent = root;
  body.billboardMode = Mesh.BILLBOARDMODE_Y; /* she always faces the child's view */

  /* the eyes: two soft dark discs that ride the billboarded body —
     they follow the child's gaze wherever the camera goes */
  const eyeMat = new StandardMaterial('lenny-eye-mat', scene);
  eyeMat.emissiveColor = Color3.FromHexString('#3a2b12');
  eyeMat.diffuseColor = Color3.Black();
  eyeMat.specularColor = Color3.Black();
  eyeMat.disableLighting = true;
  eyeMat.backFaceCulling = false;
  const eyeL = MeshBuilder.CreateDisc('lenny-eye-l', { radius: 0.045, tessellation: 12 }, scene);
  eyeL.material = eyeMat;
  eyeL.parent = body;
  eyeL.position.set(-0.09, 0.05, 0.02);
  const eyeR = MeshBuilder.CreateDisc('lenny-eye-r', { radius: 0.045, tessellation: 12 }, scene);
  eyeR.material = eyeMat;
  eyeR.parent = body;
  eyeR.position.set(0.09, 0.05, 0.02);
  /* discs face +z; the billboard turns the body so +z meets the camera */

  const HOVER = 1.15;
  let leanX = 0;
  let leanZ = 0;

  return {
    update(t: number, dt: number, pos: { x: number; z: number }, vel: { x: number; z: number }, nearZone: ZoneId | null): void {
      void nearZone;
      root.position.set(pos.x, HOVER + Math.sin(t * 2.1) * 0.09, pos.z);
      /* lean into the walk, water-smooth */
      const targetLeanX = Math.max(-0.35, Math.min(0.35, vel.z * 0.55));
      const targetLeanZ = Math.max(-0.35, Math.min(0.35, -vel.x * 0.55));
      const k = Math.min(1, dt * 5.5);
      leanX += (targetLeanX - leanX) * k;
      leanZ += (targetLeanZ - leanZ) * k;
      body.rotation.x = leanX;
      body.rotation.z = leanZ;
    },
    worldPos: () => root.position.clone(),
    bodyMesh: () => body,
    dispose(): void {
      root.dispose(false, true);
      eyeMat.dispose();
      (body.material as StandardMaterial).dispose();
    },
  };
}

/** Kept for consumers that need the raw vertex shape (tests). */
export const STAR_VERTEX_COUNT = 11;
