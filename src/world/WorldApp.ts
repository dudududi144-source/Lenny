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
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { music, mulberry32 } from '../audio/MusicEngine';
import { phaseNow, type DayPhase } from '../content/dayCycle';
import { paletteChanged, paletteForPhase, type WorldPalette } from './WorldSky';
import { buildCreatures, type CreaturesHandle } from './WorldCreatures';
import { buildLennyStar, type LennyStarHandle } from './LennyStar';
import type { GardenData } from '../games/core/ProgressStore';
import {
  createWorldCamera,
  CHILD_CAMERA as CHILD_CAMERA_START,
  type CameraPose,
} from './WorldCamera';
import { FpsGovernor } from './FpsGovernor';
import { buildIslands, type IslandsHandle } from './WorldIslands';
import { buildLanterns, lanternsFor, type LanternHandle } from './WorldLanterns';
import { buildLandmarks, type LandmarksHandle, type LandmarkScreenSpot } from './WorldLandmarks';
import {
  buildQuestProps,
  type QuestPropsSpec,
  type QuestPropSpot,
} from './WorldQuestProps';
import {
  islandCenter,
  isInsideIsland,
  isInsideLandmark,
  nearestLandmark,
  nearestZone,
  resolveWalkTarget,
  slideAroundLandmark,
  walkStepToward,
  type LandmarkDef,
  WORLD_ISLANDS,
} from './WorldLayout';
import { attachWorldInput } from './WorldInput';
import { createWorldOnboard } from './WorldOnboard';
import type { ZoneId } from '../data/garden';
import type { CreatureCounts } from './WorldCreatures';

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
  /** A zone was passed THROUGH mid-walk — roaming counts as a visit. */
  onZonePass?(zone: ZoneId): void;
  /** The child came close to a landmark — discovery or quest arrival. */
  onLandmarkNear?(landmark: LandmarkDef): void;
  /** A tap landed on a quest prop (flower / stone / gap). */
  onPropTap?(propName: string): void;
  /** A tap tried to enter a fog island — the shell whispers gently. */
  onLockedTap?(zone: ZoneId): void;
  /** Onboarding flyover begins/ends (the shell records the flag). */
  onPhase?(phase: WorldPhaseLite): void;
}

export type WorldPhaseLite = 'onboarding' | 'exploring';

/* ---------- the day palette (commit 1: fixed pleasant day; commit 4 makes it hour-aware) ---------- */

/** Some environments expose navigator.gpu but never answer (hung adapters in
 *  headless/CI browsers). Hesitation is unavailability — the child waits for
 *  no one. Found live in an automated browser: initAsync() hung forever with
 *  zero errors, canvasless, phase stuck on 'closed'. */
const WEBGPU_INIT_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, reason: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WorldUnsupportedError(reason)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

async function createEngine(
  canvas: HTMLCanvasElement,
): Promise<{ engine: Engine | WebGPUEngine; kind: WorldRendererKind }> {
  /* WebGPU first — any hesitation (rejected, slow, or hung) falls through to WebGL2 */
  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const gpu = new WebGPUEngine(canvas, { antialias: true, stencil: false });
      let owned = false;
      const init = gpu.initAsync();
      /* if the abandoned init ever finishes late, release whatever it built */
      void init.then(
        () => {
          if (!owned) {
            try {
              gpu.dispose();
            } catch {
              /* half-initialized engine — nothing to salvage */
            }
          }
        },
        () => {
          /* rejected late — already clean */
        },
      );
      try {
        await withTimeout(init, WEBGPU_INIT_TIMEOUT_MS, 'webgpu-init-hesitation');
      } catch {
        try {
          gpu.dispose();
        } catch {
          /* dispose during init can be noisy — the canvas stays free for WebGL2 */
        }
        throw new WorldUnsupportedError('webgpu-init-hesitation');
      }
      owned = true;
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
function buildSky(scene: Scene, palette: WorldPalette): { repaint(p: WorldPalette): void; dispose(): void } {
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

  return {
    repaint(p: WorldPalette): void {
      paintSkyTexture(ctx, size, p);
      tex.update();
    },
    dispose(): void {
      tex.dispose();
      mat.dispose();
      dome.dispose();
    },
  };
}

function paintSkyTexture(ctx: CanvasRenderingContext2D, size: number, palette: WorldPalette): void {
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
}

/** Procedural grass — two-tone noise, no texture files. */
function buildGround(scene: Scene, palette: WorldPalette): { retint(p: WorldPalette): void; dispose(): void } {
  const size = 256;
  const tex = new DynamicTexture('grass-tex', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  const paint = (p: WorldPalette): void => {
    ctx.fillStyle = p.grassBase;
    ctx.fillRect(0, 0, size, size);
    const rng = mulberry32(20260916);
    for (let i = 0; i < 1100; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const w = 1 + rng() * 3;
      const h = 2 + rng() * 5;
      ctx.fillStyle = rng() < 0.5 ? p.grassDark : p.grassLight;
      ctx.globalAlpha = 0.16 + rng() * 0.22;
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1;
    tex.update();
  };
  paint(palette);

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

  return {
    retint(p: WorldPalette): void {
      paint(p);
    },
    dispose(): void {
      tex.dispose();
      mat.dispose();
      ground.dispose();
    },
  };
}

export interface WorldApp {
  fps(): number;
  rendererKind(): WorldRendererKind;
  /** bridge (commit 3 fills presence; islands fill zones now) */
  presencePos(): { x: number; z: number } | null;
  nearZone(): string | null;
  zones(): Array<{ id: string; unlocked: boolean; bloom: number }>;
  /** The hour's phase the sky is painted with (visual only). */
  skyPhase(): DayPhase;
  /** Ambient life report (bridge). */
  life(): CreatureCounts;
  /** How many path lanterns are currently lit (bridge). */
  lanterns(): number;
  /** Show/hide discovery beacons for found landmarks. */
  setFoundLandmarks(ids: ReadonlyArray<string>): void;
  /** The wayfinding quest's target beacon (or none). */
  setQuestTarget(id: string | null): void;
  /** Show/clear the quest props (flowers / pattern stones). */
  setQuestProps(spec: QuestPropsSpec | null): void;
  /** A counting flower was tapped-picked (visual fold). */
  pickQuestFlower(index: number): void;
  /** The pattern gap was filled (visual spring-in). */
  fillQuestGap(color: 'gold' | 'rose' | 'teal'): void;
  /** Canvas-fraction spots of landmarks (DOM plates + e2e). */
  landmarkScreens(): LandmarkScreenSpot[];
  /** Canvas-fraction spots of live quest props (e2e taps). */
  propScreens(): QuestPropSpot[];
  /** Project any world point to canvas fractions (bridge helper). */
  screenOf(x: number, z: number): { x: number; y: number; on: boolean };
  /** Lenny's bubble anchor on the canvas (0..1 fractions). */
  lennyScreen(): { x: number; y: number; on: boolean };
  /** 'onboarding' until the flyover finishes (or is skipped). */
  worldPhase(): WorldPhaseLite;
  /** Re-read progress (unlock fog + bloom) after a game or on open. */
  refresh(data: GardenData, grewZones?: ReadonlySet<string>): void;
  setPaused(paused: boolean): void;
  /** Keyboard walking on/off (the shell disables it while the shelf is open). */
  setKeyboardEnabled(on: boolean): void;
  dispose(): void;
}

export interface WorldAppOptions {
  /** First visit: the 6s skippable flyover (ETHICS: the child is always in control). */
  onboard?: boolean;
  /** Landmark ids already discovered (their beacons start hidden). */
  found?: ReadonlyArray<string>;
}

export async function createWorldApp(
  canvas: HTMLCanvasElement,
  events: WorldAppEvents = {},
  data: GardenData = { firstSeen: 0, lights: 0, zones: {}, finished: {} },
  options: WorldAppOptions = {},
): Promise<WorldApp> {
  const { engine, kind } = await createEngine(canvas);

  const scene = new Scene(engine);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0075;

  /* the day the child walks into (visual only — hour never touches play) */
  let phase: DayPhase = phaseNow();
  let palette: WorldPalette = paletteForPhase(phase);
  const sky = buildSky(scene, palette);
  const ground = buildGround(scene, palette);

  const islands: IslandsHandle = buildIslands(scene);
  islands.refresh(data);

  /* the journey made visible: earned lights light the path lanterns */
  const lanterns: LanternHandle = buildLanterns(scene);
  lanterns.setLit(lanternsFor(data.lights || 0), false);

  /* the places beyond the path + the quest props that live there */
  const landmarks: LandmarksHandle = buildLandmarks(scene);
  landmarks.setFound(new Set(options.found ?? []));
  const questProps = buildQuestProps(scene);

  const creatures: CreaturesHandle = buildCreatures(scene);
  creatures.setPhase(phase);

  const lenny: LennyStarHandle = buildLennyStar(scene);

  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  const sun = new DirectionalLight('sun', new Vector3(...palette.sunDir), scene);

  /* apply the hour's light — called at boot and whenever the day turns */
  const applyPalette = (p: WorldPalette): void => {
    palette = p;
    sky.repaint(p);
    ground.retint(p);
    hemi.intensity = p.hemiIntensity;
    hemi.diffuse = Color3.FromHexString(p.hemiSky);
    hemi.groundColor = Color3.FromHexString(p.hemiGround);
    sun.direction = new Vector3(...p.sunDir);
    sun.position = new Vector3(...p.sunDir).scale(-40);
    sun.intensity = p.sunIntensity;
    scene.fogColor = Color3.FromHexString(p.fogColor);
    scene.clearColor = Color4.FromHexString(`${p.skyHorizon}FF`);
  };
  applyPalette(palette);

  /* glow is DECORATION: created only when the device proves fast, disposed
     when it stops being true (the same stewardship as the shadows — a
     slow device gets its framerate, not its halos) */
  let glow: GlowLayer | null = null;
  const makeGlow = (): void => {
    try {
      glow = new GlowLayer('world-glow', scene, { mainTextureSamples: 1, blurKernelSize: 16 });
      glow.intensity = 0.55;
      for (const m of landmarks.glowExclusions()) glow.addExcludedMesh(m);
    } catch {
      glow = null; /* decoration, never load-bearing */
    }
  };

  /* shadows: ONLY Lenny + the island under her feet, low blur, and
     only when the device is genuinely fast (governor-gated — a slow
     device gets its framerate, not its decoration) */
  let shadows: ShadowGenerator | null = null;
  let shadowedIsland: string | null = null;
  const shadowProbe = window.setInterval(() => {
    if (disposed || paused) return;
    const fps = governor.fps(performance.now());
    /* glow follows the same budget as the shadows: >40 earns it,
       <30 takes it back — with hysteresis so it never flaps */
    if (glow === null && fps > 40) {
      makeGlow();
    } else if (glow !== null && fps < 30) {
      glow.dispose();
      glow = null;
    }
    if (shadows === null && fps > 40) {
      try {
        shadows = new ShadowGenerator(512, sun);
        shadows.useBlurExponentialShadowMap = true;
        shadows.blurKernel = 8;
        shadows.addShadowCaster(lenny.bodyMesh());
        if (near) {
          const plat = islands.platformMesh(near);
          if (plat) {
            shadows.addShadowCaster(plat);
            shadowedIsland = near;
          }
        }
      } catch {
        shadows = null; /* shadows are decoration, never load-bearing */
      }
    } else if (shadows !== null && fps < 30) {
      shadows.dispose();
      shadows = null;
      shadowedIsland = null;
    } else if (shadows !== null && near && near !== shadowedIsland) {
      const prev = shadowedIsland ? islands.platformMesh(shadowedIsland as ZoneId) : null;
      const nextIsland = islands.platformMesh(near);
      if (nextIsland) {
        if (prev) shadows.removeShadowCaster(prev);
        shadows.addShadowCaster(nextIsland);
        shadowedIsland = near;
      }
    }
  }, 2000);

  /* ---------- first-visit flyover (WorldOnboard owns the tour) ---------- */

  /* the journey starts at the first island — that is where the eye rests */
  const home = islandCenter('light-path');
  const playPose: CameraPose = {
    alpha: CHILD_CAMERA_START.startAlpha,
    beta: CHILD_CAMERA_START.startBeta,
    radius: CHILD_CAMERA_START.startRadius,
    tx: home.x,
    tz: home.z,
  };
  const camera = createWorldCamera(scene, new Vector3(home.x, 0.6, home.z));
  scene.activeCamera = camera;

  const bootAt = performance.now();
  const onboard = createWorldOnboard(options.onboard === true, playPose, bootAt, {
    onDone: () => {
      try {
        events.onPhase?.('exploring');
      } catch {
        /* phase listeners never crash the garden */
      }
    },
  });
  if (onboard.active()) {
    /* flyover start: high, far, and sweeping (the camera input sleeps) */
    onboard.tick(bootAt, camera);
    camera.detachControl();
    try {
      events.onPhase?.('onboarding');
    } catch {
      /* phase listeners never crash the garden */
    }
  }

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

  const NEAR_DIST = 1.35;
  const NEAR_LANDMARK_DIST = 0.55; /* rim standing counts as "at the place" */
  let nearLandmark: string | null = null;
  let lastMusicIntensity = -1;
  const prevPresence = { x: presencePos.x, z: presencePos.z };
  const vel = { x: 0, z: 0 };

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
  let kbWalking = false;

  engine.runRenderLoop(() => {
    if (paused || disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000);

    /* keyboard walking (round C a11y): a held direction becomes a walk
       target refreshed every frame, through the SAME resolveWalkTarget
       clamps a tap uses — rim, keep-outs and locked islands all hold.
       Releasing the keys stops the walk at once: a keyboard errand is
       held, not fired (critic round C #1). */
    const kb = worldInput.keyboardStep();
    if (kb && !onboard.active()) {
      kbWalking = true;
      const resolved = resolveWalkTarget(
        presencePos.x + kb.x * 7,
        presencePos.z + kb.z * 7,
        (zone) => islands.zones().some((z) => z.id === zone && !z.unlocked),
      );
      walkTarget = { x: resolved.x, z: resolved.z };
      /* the destination ring follows the keyboard too (was tap-only) */
      const ringY = isInsideIsland(resolved.x, resolved.z) ? islands.islandTopY() + 0.04 : 0.14;
      destRing.position.set(resolved.x, ringY, resolved.z);
      destMat.alpha = 0.75;
    } else if (kbWalking) {
      /* the keys were released — a keyboard errand never outlives them */
      kbWalking = false;
      walkTarget = null;
      destMat.alpha = 0;
    }

    /* presence easing + camera follow — the clamp lives in
       walkStepToward (pure, unit-pinned): no first-frame lurch */
    if (walkTarget) {
      const step = walkStepToward(presencePos, walkTarget, dt);
      presencePos.x = step.x;
      presencePos.z = step.z;
      destMat.alpha = Math.max(0.25, destMat.alpha - dt * 0.1);
      if (step.arrived) {
        walkTarget = null;
        destMat.alpha = 0;
        /* W9: the arrival zone is the SNAPPED spot's zone, never the
           stale pre-snap one (a rim tap could report the old zone) */
        const snapped = nearestZone(presencePos.x, presencePos.z, NEAR_DIST);
        if ((snapped ? snapped.zone : null) !== near) {
          near = snapped ? snapped.zone : null;
          islands.setNear(near);
        }
        try {
          events.onArrive?.(near);
        } catch {
          /* arrival handlers never crash the garden */
        }
      }
    }
    const t = now / 1000;
    presenceMesh.position.set(presencePos.x, presenceY() + Math.sin(t * 2.2) * 0.045, presencePos.z);
    presenceRing.position.set(presencePos.x, presenceY() - 0.06, presencePos.z);
    const ringPulse = 1 + Math.sin(t * 3.1) * 0.1;
    presenceRing.scaling.x = ringPulse;
    presenceRing.scaling.z = ringPulse;

    /* camera: the flyover owns it; afterwards the target follows presence */
    if (onboard.active()) {
      onboard.tick(now, camera);
    } else {
      const camT = camera.target;
      camT.x += (presencePos.x - camT.x) * Math.min(1, dt * 1.9);
      camT.z += (presencePos.z - camT.z) * Math.min(1, dt * 1.9);
      camT.y += (0.66 - camT.y) * Math.min(1, dt * 1.4);
    }

    /* near-zone: the zone the child is visiting right now */
    const nz = nearestZone(presencePos.x, presencePos.z, NEAR_DIST);
    const zoneId = nz ? nz.zone : null;
    if (zoneId !== near) {
      near = zoneId;
      islands.setNear(zoneId);
      /* W4: a zone passed THROUGH mid-walk is a visit — roaming counts */
      if (zoneId && walkTarget) {
        try {
          events.onZonePass?.(zoneId);
        } catch {
          /* pass handlers never crash the garden */
        }
      }
    }

    /* musical space: the arpeggio swells as a zone comes near */
    const wantedIntensity = nz ? 0.3 + (1 - Math.min(1, nz.dist / NEAR_DIST)) * 0.45 : 0.28;
    if (Math.abs(wantedIntensity - lastMusicIntensity) > 0.02) {
      lastMusicIntensity = wantedIntensity;
      music.setIntensity(wantedIntensity);
    }

    creatures.update(t, dt);
    landmarks.update(t, dt);
    questProps.update(t, now);

    /* landmark proximity — the wandering child discovers the garden */
    const nl = nearestLandmark(presencePos.x, presencePos.z, NEAR_LANDMARK_DIST);
    const landmarkId = nl ? nl.landmark.id : null;
    if (landmarkId !== nearLandmark) {
      nearLandmark = landmarkId;
      if (nl) {
        try {
          events.onLandmarkNear?.(nl.landmark);
        } catch {
          /* discovery handlers never crash the garden */
        }
      }
    }

    /* landmark keep-out: the child slides ALONG the rim and the errand
       survives (critic V1) — only a walk INTO the place ends there */
    const inside = isInsideLandmark(presencePos.x, presencePos.z);
    if (inside) {
      const slide = slideAroundLandmark(inside, presencePos.x, presencePos.z, walkTarget);
      presencePos.x = slide.x;
      presencePos.z = slide.z;
      if (slide.arrived && walkTarget) {
        walkTarget = null;
        destMat.alpha = 0;
      }
    }

    /* Lenny rides the presence: velocity for the lean */
    vel.x = dt > 0 ? (presencePos.x - prevPresence.x) / dt : 0;
    vel.z = dt > 0 ? (presencePos.z - prevPresence.z) / dt : 0;
    prevPresence.x = presencePos.x;
    prevPresence.z = presencePos.z;
    lenny.update(t, dt, presencePos, vel, near);

    scene.render();
    governor.push(now, engine.getDeltaTime());
  });

  /* the day turns slowly — check once in a while, repaint when it does */
  const dayInterval = window.setInterval(() => {
    if (paused || disposed) return;
    const now = phaseNow();
    if (now !== phase) {
      const next = paletteForPhase(now);
      if (paletteChanged(palette, next)) applyPalette(next);
      phase = now;
      creatures.setPhase(phase);
    }
  }, 30_000);

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

  /* ---------- tap-to-move: the physical gesture contract lives in
     WorldInput; the world only reacts to its verdicts ---------- */

  const worldInput = attachWorldInput(
    canvas,
    scene,
    camera,
    (zone) => islands.zones().some((z) => z.id === zone && !z.unlocked),
    {
      onWalkTarget: (resolved) => {
        walkTarget = { x: resolved.x, z: resolved.z };
        /* the destination ring floats on platforms, never sinks into them */
        const ringY = isInsideIsland(resolved.x, resolved.z) ? islands.islandTopY() + 0.04 : 0.14;
        destRing.position.set(resolved.x, ringY, resolved.z);
        destMat.alpha = 0.75;
      },
      onPropTap: (propName) => {
        try {
          events.onPropTap?.(propName);
        } catch {
          /* a prop tap never crashes the garden */
        }
      },
      onLockedTap: (zone) => {
        try {
          events.onLockedTap?.(zone);
        } catch {
          /* a toast never crashes the garden */
        }
      },
      onSkipTap: () => onboard.requestSkip(performance.now(), camera),
      isOnboarding: () => onboard.active(),
    },
  );

  function projectToCanvas(p: Vector3): { x: number; y: number; on: boolean } {
    const w = engine.getRenderWidth();
    const hgt = engine.getRenderHeight();
    const vf = camera.viewport.toGlobal(w, hgt);
    const q = Vector3.Project(p, Matrix.Identity(), scene.getTransformMatrix(), vf);
    const on =
      q.z >= 0 && q.z <= 1 && q.x >= -80 && q.y >= -80 && q.x <= w + 80 && q.y <= hgt + 80;
    return {
      x: Math.max(0, Math.min(1, q.x / w)),
      y: Math.max(0, Math.min(1, q.y / hgt)),
      on,
    };
  }

  return {
    fps: () => governor.fps(performance.now()),
    rendererKind: () => kind,
    presencePos: () => ({ x: presencePos.x, z: presencePos.z }),
    nearZone: () => near,
    zones: () => islands.zones(),
    skyPhase: () => phase,
    life: () => creatures.counts(),
    lanterns: () => lanterns.lit(),
    setFoundLandmarks: (ids) => landmarks.setFound(new Set(ids)),
    setQuestTarget: (id) => landmarks.setQuestTarget(id),
    setQuestProps: (spec) => {
      if (spec) {
        /* props sit on the surface under the child — a platform top,
           never sunk into it; and flowers bloom toward the camera */
        const sy = isInsideIsland(presencePos.x, presencePos.z) ? islands.islandTopY() : 0;
        if (spec.kind === 'counting') {
          const cp = camera.globalPosition;
          const fx = cp.x - presencePos.x;
          const fz = cp.z - presencePos.z;
          const fl = Math.hypot(fx, fz) || 1;
          questProps.show({ ...spec, facing: { x: fx / fl, z: fz / fl }, surfaceY: sy });
        } else {
          questProps.show({ ...spec, surfaceY: sy });
        }
      } else {
        questProps.show(null);
      }
    },
    pickQuestFlower: (index) => questProps.pickFlower(index),
    fillQuestGap: (color) => questProps.fillGap(color),
    landmarkScreens: () => landmarks.spots(projectToCanvas),
    propScreens: () => questProps.spots(projectToCanvas),
    screenOf: (x, z) => projectToCanvas(new Vector3(x, 0.15, z)),
    worldPhase: () => (onboard.active() ? 'onboarding' : 'exploring'),
    lennyScreen: () => projectToCanvas(lenny.worldPos()),
    refresh: (fresh: GardenData, grewZones?: ReadonlySet<string>) => {
      islands.refresh(fresh, grewZones);
      lanterns.setLit(lanternsFor(fresh.lights || 0), true);
    },
    setPaused(value: boolean): void {
      if (disposed) return;
      if (value && !paused) {
        paused = true;
        /* W9: a paused world forgets its errand — resuming never walks
           the child somewhere they pointed at before the game */
        walkTarget = null;
        destMat.alpha = 0;
      } else if (!value && paused) {
        paused = false;
        governor.reset();
        engine.resize();
      }
    },
    setKeyboardEnabled(on: boolean): void {
      worldInput.setKeyboardEnabled(on);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.clearInterval(applyInterval);
      window.clearInterval(dayInterval);
      window.clearInterval(shadowProbe);
      shadows?.dispose();
      glow?.dispose();
      window.removeEventListener('resize', onResize);
      worldInput.detach();
      engine.stopRenderLoop();
      lenny.dispose();
      creatures.dispose();
      lanterns.dispose();
      landmarks.dispose();
      questProps.dispose();
      islands.dispose();
      ground.dispose();
      sky.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
