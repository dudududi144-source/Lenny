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
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { mulberry32 } from '../audio/MusicEngine';
import { createWorldCamera } from './WorldCamera';
import { FpsGovernor } from './FpsGovernor';

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
  sunIntensity: 1.05,
  hemiIntensity: 0.72,
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
  /** bridge (commit 2+ fills these; commit 1 reports honest nulls) */
  presencePos(): { x: number; z: number } | null;
  nearZone(): string | null;
  zones(): Array<{ id: string; unlocked: boolean; bloom: number }>;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export async function createWorldApp(
  canvas: HTMLCanvasElement,
  events: WorldAppEvents = {},
): Promise<WorldApp> {
  const { engine, kind } = await createEngine(canvas);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.92, 0.97, 0.86, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = Color3.FromHexString(DAY_PALETTE.fogColor);
  scene.fogDensity = 0.0075;

  buildSky(scene, DAY_PALETTE);
  buildGround(scene, DAY_PALETTE);

  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = DAY_PALETTE.hemiIntensity;
  hemi.diffuse = Color3.FromHexString(DAY_PALETTE.hemiSky);
  hemi.groundColor = Color3.FromHexString(DAY_PALETTE.hemiGround);

  const sun = new DirectionalLight('sun', new Vector3(...DAY_PALETTE.sunDir), scene);
  sun.position = new Vector3(...DAY_PALETTE.sunDir).scale(-40);
  sun.intensity = DAY_PALETTE.sunIntensity;

  const glow = new GlowLayer('world-glow', scene, { mainTextureSamples: 1, blurKernelSize: 24 });
  glow.intensity = 0.55;

  const camera = createWorldCamera(scene, new Vector3(0, 0.6, 0));
  scene.activeCamera = camera;

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
    scene.render();
    governor.push(performance.now(), engine.getDeltaTime());
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

  return {
    fps: () => governor.fps(performance.now()),
    rendererKind: () => kind,
    presencePos: () => null,
    nearZone: () => null,
    zones: () => [],
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
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
