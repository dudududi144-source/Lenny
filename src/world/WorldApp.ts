/* ============================================================
 * WorldApp — engine + scene lifecycle for the 3D garden world.
 *
 * Stage 7, commit 1. Mirrors the GameApp discipline the arena uses:
 * create → ready → (pause/resume) → clean dispose. Zero leaks when
 * the world hands off to a game and back.
 *
 * Rendering infrastructure only in this commit:
 *   - engine creation: WebGPU when truly available, WebGL2
 *     otherwise, a typed error when neither exists (the shell
 *     silently falls back to the classic garden)
 *   - child-tuned ArcRotateCamera (WorldCamera)
 *   - painted sky dome (procedural DynamicTexture — zero assets)
 *   - procedural grass ground (DynamicTexture noise — zero assets)
 *   - hemispheric + directional light, gentle glow, soft fog
 *   - fps governor: auto hardware scaling below 25fps, distress
 *     signal below 15fps sustained 5s
 *
 * Zones/islands arrive in commit 2, movement in commit 3.
 * ============================================================ */

import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Ray } from '@babylonjs/core/Culling/ray.js'; /* Ray's module also patches the scene's ray machinery */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { mulberry32 } from '../audio/MusicEngine';
import type { GardenData } from '../games/core/ProgressStore';
import { createWorldCamera } from './WorldCamera';
import { FpsGovernor } from './FpsGovernor';
import { buildIslands, type IslandsHandle } from './WorldIslands';
import { islandCenter, nearestZone, resolveWalkTarget, WORLD_ISLANDS } from './WorldLayout';
import { pressEnd, pressStart, isDragDistance, type PointerSnapshot } from './Gestures';
import type { ZoneId } from '../data/garden';

/** Thrown when the device cannot render the world at all. */
export class WorldUnsupportedError extends Error {
  constructor(reason: string) {
    super(`world-unsupported: ${reason}`);
    this.name = 'WorldUnsupportedError';
  }
}

export type WorldRendererKind = 'webgpu' | 'webgl2';

export interface WorldAppEvents {
  /** Sustained fps below the floor — the shell should fall back. */
  onDistress?(): void;
  /** The presence point settled (walking finished). */
  onArrive?(zone: ZoneId | null): void;
  /** A tap tried to enter a fog island — the shell whispers gently. */
  onLockedTap?(zone: ZoneId): void;
}

/* ---------- the day palette (commit 1: fixed pleasant day; commit 4 makes it hour-aware) ---------- */

export interface WorldPalette {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  /** sun disc position on the painted dome (0..1 of texture space) or null */
  sun: { x: number; y: number; r: number; color: string } | null;
  moon: boolean;
  stars: number;
  sunDir: [number, number, number];
  sunIntensity: number;
  hemiIntensity: number;
  hemiSky: string;
  hemiGround: string;
  grassBase: string;
  grassDark: string;
  grassLight: string;
  fogColor: string;
}

export const DAY_PALETTE: WorldPalette = {
  skyTop: '#3fa7e0',
  skyMid: '#8fd0ef',
  skyHorizon: '#eaf7dc',
  sun: { x: 0.22, y: 0.16, r: 34, color: '#fff3b0' },
  moon: false,
  stars: 0,
  sunDir: [-0.4, -0.85, 0.3],
  sunIntensity: 0.95,
  hemiIntensity: 0.65,
  hemiSky: '#ffffff',
  hemiGround: '#4a7a3a',
  grassBase: '#79c356',
  grassDark: '#5ea344',
  grassLight: '#a4d97b',
  fogColor: '#eaf7dc',
};

async function createEngine(
  canvas: HTMLCanvasElement,
): Promise<{ engine: Engine | WebGPUEngine; kind: WorldRendererKind }> {
  /* WebGPU first — any hesitation falls through to WebGL2 */
  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const gpu = new WebGPUEngine(canvas, { antialias: true, stencil: false });
      await gpu.initAsync();
      return { engine: gpu, kind: 'webgpu' };
    }
  } catch {
    /* fall through — WebGL2 is the workhorse */
  }
  const gl = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false }, false);
  if (gl.webGLVersion < 2) {
    gl.dispose();
    throw new WorldUnsupportedError('webgl2-unavailable');
  }
  return { engine: gl, kind: 'webgl2' };
}

/** Painted sky dome — gradient + sun/moon + deterministic stars. */
function buildSky(scene: Scene, palette: WorldPalette): void {
  const size = 512;
  const tex = new DynamicTexture('sky-tex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.52, palette.skyMid);
  g.addColorStop(0.72, palette.skyHorizon);
  g.addColorStop(1, palette.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  if (palette.sun) {
    ctx.fillStyle = palette.sun.color;
    ctx.beginPath();
    ctx.arc(palette.sun.x * size, palette.sun.y * size, palette.sun.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (palette.moon) {
    ctx.fillStyle = '#f3ecd0';
    ctx.beginPath();
    ctx.arc(0.78 * size, 0.14 * size, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.skyTop;
    ctx.beginPath();
    ctx.arc(0.755 * size, 0.125 * size, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  if (palette.stars > 0) {
    const rng = mulberry32(20260915);
    ctx.fillStyle = '#fff7d6';
    for (let i = 0; i < palette.stars; i++) {
      const x = rng() * size;
      const y = rng() * size * 0.5;
      const r = 0.6 + rng() * 1.3;
      ctx.globalAlpha = 0.35 + rng() * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  tex.update();

  const mat = new StandardMaterial('sky-mat', scene);
  mat.emissiveTexture = tex;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.disableLighting = true;
  mat.backFaceCulling = false;

  const dome = MeshBuilder.CreateSphere('sky-dome', { diameter: 300, segments: 10 }, scene);
  dome.material = mat;
  dome.isPickable = false;
  dome.infiniteDistance = true;
  dome.applyFog = false;
}

/** Procedural grass — two-tone noise, no texture files. */
function buildGround(scene: Scene, palette: WorldPalette): void {
  const size = 256;
  const tex = new DynamicTexture('grass-tex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = palette.grassBase;
  ctx.fillRect(0, 0, size, size);

  const rng = mulberry32(20260916);
  for (let i = 0; i < 1100; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 1 + rng() * 3;
    const h = 2 + rng() * 5;
    ctx.fillStyle = rng() < 0.5 ? palette.grassDark : palette.grassLight;
    ctx.globalAlpha = 0.16 + rng() * 0.22;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  tex.update();

  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = 9;
  tex.vScale = 9;

  const mat = new StandardMaterial('grass-mat', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.02, 0.03, 0.02);

  const ground = MeshBuilder.CreateGround('ground', { width: 64, height: 64, subdivisions: 2 }, scene);
  ground.material = mat;
  ground.isPickable = true;
  ground.receiveShadows = true;
}

export interface WorldApp {
  fps(): number;
  rendererKind(): WorldRendererKind;
  /** bridge (commit 3 fills presence; islands fill zones now) */
  presencePos(): { x: number; z: number } | null;
  nearZone(): string | null;
  zones(): Array<{ id: string; unlocked: boolean; bloom: number }>;
  /** Re-read progress (unlock fog + bloom) after a game or on open. */
  refresh(data: GardenData): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export async function createWorldApp(
  canvas: HTMLCanvasElement,
  events: WorldAppEvents = {},
  data: GardenData = { firstSeen: 0, lights: 0, zones: {}, finished: {} },
): Promise<WorldApp> {
  const { engine, kind } = await createEngine(canvas);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.92, 0.97, 0.86, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = Color3.FromHexString(DAY_PALETTE.fogColor);
  scene.fogDensity = 0.0075;

  buildSky(scene, DAY_PALETTE);
  buildGround(scene, DAY_PALETTE);

  const islands: IslandsHandle = buildIslands(scene);
  islands.refresh(data);

  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = DAY_PALETTE.hemiIntensity;
  hemi.diffuse = Color3.FromHexString(DAY_PALETTE.hemiSky);
  hemi.groundColor = Color3.FromHexString(DAY_PALETTE.hemiGround);

  const sun = new DirectionalLight('sun', new Vector3(...DAY_PALETTE.sunDir), scene);
  sun.position = new Vector3(...DAY_PALETTE.sunDir).scale(-40);
  sun.intensity = DAY_PALETTE.sunIntensity;

  const glow = new GlowLayer('world-glow', scene, { mainTextureSamples: 1, blurKernelSize: 24 });
  glow.intensity = 0.55;

  /* the journey starts at the first island — that is where the eye rests */
  const home = islandCenter('light-path');
  const camera = createWorldCamera(scene, new Vector3(home.x, 0.6, home.z));
  scene.activeCamera = camera;

  /* ---------- the presence point (commit 3: the child IS here) ---------- */

  const presenceMat = new StandardMaterial('presence-mat', scene);
  presenceMat.emissiveColor = Color3.FromHexString('#ffe9a6');
  presenceMat.diffuseColor = Color3.Black();
  presenceMat.specularColor = Color3.Black();
  presenceMat.disableLighting = true;

  const presenceMesh = MeshBuilder.CreateSphere('presence', { diameter: 0.34, segments: 10 }, scene);
  presenceMesh.material = presenceMat;
  presenceMesh.position.set(home.x, 0.72, home.z);
  presenceMesh.isPickable = false;

  const ringMat = new StandardMaterial('presence-ring-mat', scene);
  ringMat.emissiveColor = Color3.FromHexString('#ffd76a');
  ringMat.diffuseColor = Color3.Black();
  ringMat.specularColor = Color3.Black();
  ringMat.disableLighting = true;
  ringMat.alpha = 0.6;

  const presenceRing = MeshBuilder.CreateTorus('presence-ring', { diameter: 0.62, thickness: 0.05, tessellation: 22 }, scene);
  presenceRing.scaling.y = 0.32;
  presenceRing.material = ringMat;
  presenceRing.isPickable = false;

  /* destination ripple — appears while walking, fades on arrival */
  const destMat = new StandardMaterial('dest-mat', scene);
  destMat.emissiveColor = Color3.FromHexString('#fff3b0');
  destMat.diffuseColor = Color3.Black();
  destMat.specularColor = Color3.Black();
  destMat.disableLighting = true;
  destMat.alpha = 0;
  const destRing = MeshBuilder.CreateTorus('dest-ring', { diameter: 0.8, thickness: 0.05, tessellation: 22 }, scene);
  destRing.scaling.y = 0.3;
  destRing.material = destMat;
  destRing.isPickable = false;

  /* movement state */
  const presencePos = { x: home.x, z: home.z };
  let walkTarget: { x: number; z: number } | null = null;
  let near: ZoneId | null = null;
  let lockedToastAt = 0;

  const NEAR_DIST = 1.35;
  const ARRIVE_EPS = 0.09;
  const WALK_RATE = 2.1; /* exponential ease — calm, never teleporty */

  function presenceY(): number {
    for (const p of WORLD_ISLANDS) {
      if (Math.hypot(presencePos.x - p.x, presencePos.z - p.z) < p.radius - 0.15) return 0.66;
    }
    return 0.72;
  }

  /* ---------- fps governor (spec: soften below 25, distress below 15×5s) ---------- */
  const baseScale = 1 / Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  const governor = new FpsGovernor({ baseScale });
  let currentScale = baseScale;
  engine.setHardwareScalingLevel(currentScale);

  let paused = false;
  let disposed = false;
  let distressFired = false;

  engine.runRenderLoop(() => {
    if (paused || disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000);

    /* presence easing + camera follow */
    if (walkTarget) {
      const dx = walkTarget.x - presencePos.x;
      const dz = walkTarget.z - presencePos.z;
      const d = Math.hypot(dx, dz);
      if (d < ARRIVE_EPS) {
        presencePos.x = walkTarget.x;
        presencePos.z = walkTarget.z;
        walkTarget = null;
        destMat.alpha = 0;
        try {
          events.onArrive?.(near);
        } catch {
          /* arrival handlers never crash the garden */
        }
      } else {
        const k = Math.min(1, dt * WALK_RATE * (0.55 + Math.min(1, d / 2.5)));
        presencePos.x += (dx * k);
        presencePos.z += (dz * k);
        destMat.alpha = Math.max(0.25, destMat.alpha - dt * 0.1);
      }
    }
    const t = now / 1000;
    presenceMesh.position.set(presencePos.x, presenceY() + Math.sin(t * 2.2) * 0.045, presencePos.z);
    presenceRing.position.set(presencePos.x, presenceY() - 0.06, presencePos.z);
    const ringPulse = 1 + Math.sin(t * 3.1) * 0.1;
    presenceRing.scaling.x = ringPulse;
    presenceRing.scaling.z = ringPulse;

    /* camera target follows the presence softly */
    const camT = camera.target;
    camT.x += (presencePos.x - camT.x) * Math.min(1, dt * 1.9);
    camT.z += (presencePos.z - camT.z) * Math.min(1, dt * 1.9);
    camT.y += (0.66 - camT.y) * Math.min(1, dt * 1.4);

    /* near-zone: the zone the child is visiting right now */
    const nz = nearestZone(presencePos.x, presencePos.z, NEAR_DIST);
    const zoneId = nz ? nz.zone : null;
    if (zoneId !== near) {
      near = zoneId;
      islands.setNear(zoneId);
    }

    scene.render();
    governor.push(now, engine.getDeltaTime());
  });

  const applyInterval = window.setInterval(() => {
    if (paused || disposed) return;
    const decision = governor.evaluate(performance.now(), currentScale);
    if (Math.abs(decision.newScale - currentScale) > 0.001) {
      currentScale = decision.newScale;
      engine.setHardwareScalingLevel(currentScale);
    }
    if (decision.distress && !distressFired) {
      distressFired = true;
      try {
        events.onDistress?.();
      } catch {
        /* the shell decides — the world never crashes over it */
      }
    }
  }, 400);

  const onResize = (): void => {
    if (!disposed) engine.resize();
  };
  window.addEventListener('resize', onResize);

  /* ---------- tap-to-move (commit 3): the physical gesture contract ---------- */

  let press: PointerSnapshot | null = null;
  let dragAborted = false;

  const onPointerDown = (ev: PointerEvent): void => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    press = pressStart(ev.offsetX, ev.offsetY, performance.now());
    dragAborted = false;
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (!press || dragAborted) return;
    if (isDragDistance(press, ev.offsetX, ev.offsetY)) {
      dragAborted = true; /* this press is an orbit now — the camera eats it */
    }
  };

  const onPointerUp = (ev: PointerEvent): void => {
    if (!press) return;
    const start = press;
    press = null;
    if (dragAborted) return; /* this press became an orbit — the camera ate it */
    if (pressEnd(start, ev.offsetX, ev.offsetY, performance.now()) !== 'tap') return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    /* ray-based pick: a REAL Ray use keeps the ray module in the bundle
       (its side effect patches the scene's ray machinery), CSS coords in,
       walkable-surface predicate on */
    const ray = new Ray(Vector3.Zero(), Vector3.Zero());
    scene.createPickingRayToRef(ev.offsetX, ev.offsetY, Matrix.Identity(), ray, camera);
    const pick = scene.pickWithRay(ray, (m) => m.isPickable && (m.name === 'ground' || m.name.startsWith('plat-mesh-')));
    if (!pick || !pick.hit || !pick.pickedPoint) return;

    const zoneLock = new Set(islands.zones().filter((z) => !z.unlocked).map((z) => z.id));
    const resolved = resolveWalkTarget(pick.pickedPoint.x, pick.pickedPoint.z, (zone) => zoneLock.has(zone));
    walkTarget = { x: resolved.x, z: resolved.z };
    destRing.position.set(resolved.x, 0.14, resolved.z);
    destMat.alpha = 0.75;
    if (resolved.blocked && resolved.blockedZone) {
      const now = performance.now();
      if (now - lockedToastAt > 2600) {
        lockedToastAt = now;
        try {
          events.onLockedTap?.(resolved.blockedZone);
        } catch {
          /* a toast never crashes the garden */
        }
      }
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => {
    press = null;
  });

  return {
    fps: () => governor.fps(performance.now()),
    rendererKind: () => kind,
    presencePos: () => ({ x: presencePos.x, z: presencePos.z }),
    nearZone: () => near,
    zones: () => islands.zones(),
    refresh: (fresh: GardenData) => islands.refresh(fresh),
    setPaused(value: boolean): void {
      if (disposed) return;
      if (value && !paused) {
        paused = true;
      } else if (!value && paused) {
        paused = false;
        governor.reset();
        engine.resize();
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.clearInterval(applyInterval);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      engine.stopRenderLoop();
      islands.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
