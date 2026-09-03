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
import {
  buildFox,
  yawFor,
  type FoxHandle,
} from './WorldFox';
import {
  MEADOW_CHUNK,
  buildMeadow,
  chunkFind,
  chunkOf,
  isMeadowPoint,
  type MeadowFindKind,
  type MeadowHandle,
} from './WorldMeadow';
import { buildFriends, type FriendsHandle } from './WorldFriends';
import { buildRoad, type RoadHandle } from './WorldRoad';
import { buildCottages, type CottageHandle } from './WorldCottages';
import { nearestFriend, type FriendDef } from './WorldLayout';
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
  clampToWanderArea,
  islandCenter,
  isInsideIsland,
  isInsideLandmark,
  MAX_WALK_SPEED,
  nearestLandmark,
  nearestZone,
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
  /** A meadow sparkle was gathered (stage 11): id + total this session. */
  onSparkle?(id: string, sessionTotal: number): void;
  /** The child came close to a named friend (bubble words live in the shell). */
  onFriendNear?(friend: FriendDef): void;
  /** A rare restful find appeared beside the walker in the meadow. */
  onMeadowFind?(kind: Exclude<MeadowFindKind, 'none'>): void;
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
  tex.uScale = 52;
  tex.vScale = 52;

  const mat = new StandardMaterial('grass-mat', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.02, 0.03, 0.02);

  /* stage 11: the ground grew with the journey — the meadow walker
     never sees grass end (the fog owns the horizon) */
  const ground = MeshBuilder.CreateGround('ground', { width: 380, height: 380, subdivisions: 2 }, scene);
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
  /** The touch joystick speaks here (x right, z forward, -1..1). */
  setJoystickVector(x: number, z: number): void;
  /** One jump, please (the touch button; space flows through input). */
  requestJump(): void;
  /** Sparkles gathered this session (the ledger lives in the shell). */
  sparklesFound(): number;
  dispose(): void;
}

export interface WorldAppOptions {
  /** First visit: the 6s skippable flyover (ETHICS: the child is always in control). */
  onboard?: boolean;
  /** Landmark ids already discovered (their beacons start hidden). */
  found?: ReadonlyArray<string>;
  /** Sparkle ids already collected (the meadow never respawns them). */
  sparkles?: ReadonlyArray<string>;
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
  scene.fogDensity = 0.0105;

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

  /* stage 11 — the great journey: a real walker, the endless
     meadow beyond the ring, the road furniture, the friends, and
     the cottages that make every game a place */
  const fox: FoxHandle = buildFox(scene);
  const meadow: MeadowHandle = buildMeadow(scene, new Set(options.sparkles ?? []));
  const friends: FriendsHandle = buildFriends(scene);
  const road: RoadHandle = buildRoad(scene);
  const cottages: CottageHandle = buildCottages(scene);

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

  /* shadows: ONLY the fox + the island under her feet, low blur, and
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
        shadows.addShadowCaster(fox.bodyMesh());
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

  /* ---------- the walker (stage 11: the child has a BODY) ----------
     The old hover-dot became a soft glow ring under the fox's
     feet; the fox IS the presence now, and Lenny the star hovers
     above her like a lantern that chose you. */

  const ringMat = new StandardMaterial('presence-ring-mat', scene);
  ringMat.emissiveColor = Color3.FromHexString('#ffd76a');
  ringMat.diffuseColor = Color3.Black();
  ringMat.specularColor = Color3.Black();
  ringMat.disableLighting = true;
  ringMat.alpha = 0.5;

  const presenceRing = MeshBuilder.CreateTorus('presence-ring', { diameter: 0.7, thickness: 0.045, tessellation: 22 }, scene);
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
  /* rim standing counts as "at the place" — stage 11's places are
     bigger, and a child at the doorstep HAS arrived: 0.8 past the rim */
  const NEAR_LANDMARK_DIST = 0.8;
  let nearLandmark: string | null = null;
  let lastMusicIntensity = -1;
  const prevPresence = { x: presencePos.x, z: presencePos.z };
  const vel = { x: 0, z: 0 };

  /* the jump: a small, honest arc — up, gravity, landing squash */
  const JUMP_V = 4.3;
  const GRAVITY = 11.5;
  let jumpY = 0;
  let jumpVy = 0;
  let grounded = true;
  let landedThisFrame = false;
  let facing = 0;
  let sparklesSession = 0;
  let jumpQueued = false; /* requestJump() — the touch button's queue */

  /** ground height under the feet: platform tops, then grass */
  function groundY(): number {
    for (const p of WORLD_ISLANDS) {
      if (Math.hypot(presencePos.x - p.x, presencePos.z - p.z) < p.radius - 0.12) return islands.islandTopY();
    }
    return 0;
  }

  /* ---------- fps governor (spec: soften below 25, distress below 15×5s) ---------- */
  const baseScale = 1 / Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  const governor = new FpsGovernor({ baseScale });
  let currentScale = baseScale;
  engine.setHardwareScalingLevel(currentScale);

  let paused = false;
  let disposed = false;
  let distressFired = false;
  /* one gentle "you are near a friend" per approach (per friend) */
  const friendGreetedAt = new Map<string, number>();
  let lastMeadowFindAt = 0;
  /* continuous-arrival: standing in a zone's ring counts, joystick or
     not — but the child SPAWNS arrived at the home island: a fresh
     garden opens in 'exploring', never with a shelf in its face */
  let nearSince: number | null = null;
  let lastArrivedZone: ZoneId | null = (() => {
    const h = nearestZone(home.x, home.z, 0.2);
    return h ? h.zone : null;
  })();

  engine.runRenderLoop(() => {
    if (paused || disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000);

    /* ---------- movement, stage 11: direct control ----------
       Joystick or keyboard = the fox's legs (camera-relative, the
       platformer contract). A tap still sends a walk errand — but
       a held direction always wins the very next frame. */
    const mv = onboard.active() ? null : worldInput.moveVector();
    const isLocked = (zone: ZoneId): boolean => islands.zones().some((z) => z.id === zone && !z.unlocked);
    let moved = false;

    if (mv) {
      /* camera-relative: forward = where the eye looks, right = its side */
      const cam = camera;
      let fx = cam.target.x - cam.globalPosition.x;
      let fz = cam.target.z - cam.globalPosition.z;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const wx = fx * mv.z + fz * mv.x;
      const wz = fz * mv.z - fx * mv.x;
      const wl = Math.hypot(wx, wz) || 1;

      presencePos.x += (wx / wl) * MAX_WALK_SPEED * dt;
      presencePos.z += (wz / wl) * MAX_WALK_SPEED * dt;
      moved = true;
      facing = yawFor(wx, wz);

      /* a direct step cancels any standing tap errand */
      walkTarget = null;
      destMat.alpha = 0;

      /* the soft walls of the world (same rules a tap obeys) */
      const clamped = clampToWanderArea(presencePos.x, presencePos.z);
      presencePos.x = clamped.x;
      presencePos.z = clamped.z;
      for (const p of WORLD_ISLANDS) {
        const d = Math.hypot(presencePos.x - p.x, presencePos.z - p.z);
        if (d < p.radius - 0.12 && isLocked(p.zone)) {
          const ang = d < 0.01 ? Math.atan2(-p.z, -p.x) : Math.atan2(presencePos.z - p.z, presencePos.x - p.x);
          presencePos.x = p.x + Math.cos(ang) * (p.radius - 0.1);
          presencePos.z = p.z + Math.sin(ang) * (p.radius - 0.1);
        }
      }
    }

    /* the tap errand (walkStepToward keeps its soft landing) */
    if (walkTarget) {
      const step = walkStepToward(presencePos, walkTarget, dt);
      presencePos.x = step.x;
      presencePos.z = step.z;
      if (Math.hypot(step.x - presencePos.x, step.z - presencePos.z) > 1e-6) {
        facing = yawFor(step.x - prevPresence.x, step.z - prevPresence.z);
      }
      moved = !step.arrived;
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
        lastArrivedZone = near;
        try {
          events.onArrive?.(near);
        } catch {
          /* arrival handlers never crash the garden */
        }
      }
    }

    /* the jump: consume a request, fly, fall, land */
    landedThisFrame = false;
    if (worldInput.consumeJump() || jumpQueued) {
      jumpQueued = false;
      if (grounded && !onboard.active()) {
        grounded = false;
        jumpVy = JUMP_V;
      }
    }
    if (!grounded) {
      jumpY += jumpVy * dt;
      jumpVy -= GRAVITY * dt;
      if (jumpY <= 0) {
        jumpY = 0;
        jumpVy = 0;
        grounded = true;
        landedThisFrame = true;
      }
    }

    const speed = moved ? MAX_WALK_SPEED : 0;
    const gy = groundY();
    fox.update(now / 1000, dt, {
      pos: presencePos,
      speed,
      facing,
      groundY: gy,
      jumpY,
      landed: landedThisFrame,
    });
    presenceRing.position.set(presencePos.x, gy + 0.03, presencePos.z);
    const ringPulse = 1 + Math.sin(now / 1000 * 3.1) * 0.1;
    presenceRing.scaling.x = ringPulse;
    presenceRing.scaling.z = ringPulse;
    const t = now / 1000;
    /* camera: the flyover owns it; afterwards the target follows the fox
       with a touch of look-ahead — the run reads like a journey */
    if (onboard.active()) {
      onboard.tick(now, camera);
    } else {
      const camT = camera.target;
      const lookX = presencePos.x + vel.x * 0.22;
      const lookZ = presencePos.z + vel.z * 0.22;
      camT.x += (lookX - camT.x) * Math.min(1, dt * 2.2);
      camT.z += (lookZ - camT.z) * Math.min(1, dt * 2.2);
      camT.y += (gy + 0.5 - camT.y) * Math.min(1, dt * 1.6);
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

    /* continuous arrival (stage 11): walking into a zone with the
       joystick counts exactly like a tap arrival — after a short
       settle so pass-throughs don't slide the shelf open */
    if (near && !walkTarget && !onboard.active()) {
      if (nearSince === null) nearSince = now;
      if (now - nearSince > 450 && near !== lastArrivedZone) {
        lastArrivedZone = near;
        try {
          events.onArrive?.(near);
        } catch {
          /* arrival handlers never crash the garden */
        }
      }
    } else {
      nearSince = null;
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
    friends.update(t, dt);
    road.update(t, dt);
    meadow.update(t, dt, presencePos.x, presencePos.z);

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

    /* friends: a gentle hello, once per approach (10s cooldown) */
    const nf = nearestFriend(presencePos.x, presencePos.z, 1.35);
    if (nf) {
      const last = friendGreetedAt.get(nf.friend.id) ?? -99999;
      if (now - last > 10_000) {
        friendGreetedAt.set(nf.friend.id, now);
        try {
          events.onFriendNear?.(nf.friend);
        } catch {
          /* a hello never crashes the garden */
        }
      }
    }

    /* the meadow pays the walker: sparkles within arm's reach */
    const got = meadow.sparkleWithinReach(presencePos.x, presencePos.z, 0.62);
    if (got) {
      sparklesSession++;
      try {
        events.onSparkle?.(got.id, sparklesSession);
      } catch {
        /* a sparkle never crashes the garden */
      }
    }
    /* rare meadow finds whisper when they are new (once per 30s) */
    if (isMeadowPoint(presencePos.x, presencePos.z) && now - lastMeadowFindAt > 30_000) {
      const c = chunkOf(presencePos.x, presencePos.z);
      const kind = chunkFind(c.cx, c.cz);
      if (kind !== 'none' && Math.hypot(presencePos.x - (c.cx + 0.5) * MEADOW_CHUNK, presencePos.z - (c.cz + 0.5) * MEADOW_CHUNK) < 2.2) {
        lastMeadowFindAt = now;
        try {
          events.onMeadowFind?.(kind);
        } catch {
          /* a whisper never crashes the garden */
        }
      }
    }

    /* Lenny rides the fox: velocity for the lean */
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
        if (onboard.active()) return;
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
    /* zones carry their layout coords now (stage 11): the compass,
       the parent lens and the e2e bridge all read one honest map */
    zones: () =>
      islands.zones().map((z) => {
        const p = WORLD_ISLANDS.find((i) => i.zone === z.id);
        return { ...z, x: p?.x ?? 0, z: p?.z ?? 0 };
      }),
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
    setJoystickVector(x: number, z: number): void {
      worldInput.setJoystickVector(x, z);
    },
    requestJump(): void {
      if (!disposed && !paused) jumpQueued = true;
    },
    sparklesFound: () => sparklesSession,
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
      fox.dispose();
      meadow.dispose();
      friends.dispose();
      road.dispose();
      cottages.dispose();
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
