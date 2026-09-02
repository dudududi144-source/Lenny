import {
  finishedCount,
  LocalProgressStore,
  zoneName,
  type GardenData,
} from '../../games/core/ProgressStore';
import { getZone, type ZoneId } from '../../data/garden';
import { GameApp } from '../../games/engine/GameApp';
import type { GameSpec } from '../../games/builder/GameSpec';
import type { GameScene } from '../../games/engine/GameScene';
import { SCENE_REGISTRY, sceneKeyForSpec, sceneKeyForZone } from '../../games/scenes/registry';
import { zoneCatalog, anySpec } from '../../content/catalog';
import { music } from '../../audio/MusicEngine';
import { createGameHUD, type GameHUDHandle } from './GameHUD';
import { createGameShelf, type GameShelfHandle } from './GameShelf';
import { h } from './common/el';

export interface GameHostCallbacks {
  loadGarden(): GardenData;
  onExit(): void;
  onUnavailable(zoneId: string): void;
}

export interface GameHostHandle {
  root: HTMLElement;
  /** Opens a zone's game; resolves false when no scene is registered yet.
   *  `specId` (Stage 7, additive) pins an exact catalog game — the world
   *  shelf hands its pick through here; omitting it keeps the default
   *  progression untouched. */
  open(zoneId: string, specId?: string | null): Promise<boolean>;
  close(): void;
  isZoneOpen(zoneId: string): boolean;
  currentZoneId(): string | null;
  currentSceneKey(): string | null;
  /** Spec id currently playing (seed or derived) — Stage 6, additive. */
  currentSpecId(): string | null;
  rendererKind(): string | null;
  sceneDebug(): Record<string, unknown> | null;
  canvasRect(): { x: number; y: number; width: number; height: number } | null;
  /** Live scene world size (Arena layout space for e2e mapping). */
  stageView(): { w: number; h: number };
}

const store = new LocalProgressStore();

function safeLoad(fallback: () => GardenData): GardenData {
  try {
    return store.load();
  } catch {
    return fallback();
  }
}

/**
 * Owns the game screen: mounts the Pixi GameApp once, resolves the
 * registry spec for a zone (advancing through its registry games as
 * the zone is completed — same rule the old shell used) and swaps
 * scenes in and out.
 */
export function createGameHost(callbacks: GameHostCallbacks): GameHostHandle {
  const gameApp = new GameApp();
  const hud: GameHUDHandle = createGameHUD({
    onBack: () => close(),
    onPauseToggle: (paused) => gameApp.setPaused(paused),
    onShelf: () => {
      if (!zoneId) return;
      /* the game freezes while choosing — the pond doesn't move on */
      wasPausedBeforeShelf = gameApp.isPaused();
      gameApp.setPaused(true);
      shelf.open(zoneId, currentSpecId);
    },
  });
  let wasPausedBeforeShelf = false;
  const shelf: GameShelfHandle = createGameShelf({
    onPick: (spec) => {
      if (!zoneId) return;
      spawn(spec);
    },
    onClose: () => {
      gameApp.setPaused(wasPausedBeforeShelf);
    },
  });
  const stage = h('div', { class: 'game-stage', id: 'game-stage' });
  const root = h(
    'section',
    { class: 'screen screen--game hidden', id: 'game-screen', 'aria-label': 'משחק בגן' },
    stage,
    hud.root,
    shelf.root,
  );

  let mounted = false;
  let zoneId: string | null = null;
  let sceneKey: string | null = null;
  let currentSpecId: string | null = null;
  /* Stage-5 exit wipe: generation-guarded so a fast re-open never
     gets closed by a stale close timeout. */
  let closeGen = 0;

  function spawn(pickedSpec?: GameSpec): void {
    if (!zoneId) return;
    const target = zoneId;
    const data = safeLoad(callbacks.loadGarden);
    /* Stage 6: the zone's full catalog (seed spine first, then the
       derived games). A shelf pick overrides the default progression. */
    const specs = zoneCatalog(target);
    const done = finishedCount(data, target);
    const spec =
      pickedSpec ??
      (specs.length > 0 ? specs[Math.min(done, specs.length - 1)] : null);
    const wanted = spec
      ? sceneKeyForSpec(spec)
      : sceneKeyForZone(target, getZone(target as ZoneId)?.gameScene);
    const resolvedKey = wanted && SCENE_REGISTRY[wanted] ? wanted : 'coming-soon';
    const factory = SCENE_REGISTRY[resolvedKey];
    if (!factory) {
      callbacks.onUnavailable(target);
      return;
    }
    sceneKey = resolvedKey;
    currentSpecId = spec ? spec.id : null;
    hud.setZone(zoneName(target));
    hud.clear();
    hud.playEnter();
    const scene: GameScene = factory({
      app: gameApp.pixiApp,
      zone: target,
      spec,
      hud: hud.bridge,
      onExit: () => close(),
      /* REPLAY replays THE SAME GAME — the zone's done counter already
         advanced when the finish was recorded, so a bare spawn() would
         jump to the next game instead of honoring "שחק שוב" */
      onReplay: () => spawn(currentSpecId ? anySpec(currentSpecId) : undefined),
    });
    gameApp.setScene(scene);
  }

  async function open(target: string, specId?: string | null): Promise<boolean> {
    closeGen++; /* invalidate any pending close */
    const data = safeLoad(callbacks.loadGarden);
    const specs = zoneCatalog(target);
    const done = finishedCount(data, target);
    const defaultSpec = specs.length > 0 ? specs[Math.min(done, specs.length - 1)] : null;
    const spec = specId ? (anySpec(specId) ?? defaultSpec) : defaultSpec;
    const wanted = spec
      ? sceneKeyForSpec(spec)
      : sceneKeyForZone(target, getZone(target as ZoneId)?.gameScene);

    /* Not-yet-rebuilt games fall back to the living placeholder scene. */
    const resolvedKey = wanted && SCENE_REGISTRY[wanted] ? wanted : 'coming-soon';
    const factory = SCENE_REGISTRY[resolvedKey];
    if (!factory) {
      callbacks.onUnavailable(target);
      return false;
    }

    zoneId = target;
    sceneKey = resolvedKey;
    currentSpecId = spec ? spec.id : null;
    /* Reveal the game screen BEFORE mounting so the Pixi canvas measures
       its real size on the first frame (no mount-hidden resize race). */
    root.classList.remove('hidden');
    if (!mounted) {
      await gameApp.mount(stage);
      mounted = true;
    }
    spawn(spec ?? undefined);
    return true;
  }

  function close(): void {
    const gen = ++closeGen;
    root.classList.add('is-exiting');
    window.setTimeout(() => {
      if (gen !== closeGen) return; /* a new open superseded this close */
      gameApp.setPaused(false);
      gameApp.setScene(null);
      /* the soundtrack walks back to the garden (NOT in GameScene.destroy —
         a shelf swap destroys scenes too, and the new scene speaks last) */
      music.setMood('calm');
      root.classList.remove('is-exiting');
      root.classList.add('hidden');
      zoneId = null;
      sceneKey = null;
      currentSpecId = null;
      callbacks.onExit();
    }, 260);
  }

  return {
    root,
    open,
    close,
    isZoneOpen(target: string): boolean {
      return zoneId === target && sceneKey !== null;
    },
    currentZoneId: () => zoneId,
    currentSceneKey: () => sceneKey,
    /** Spec id currently playing (seed or derived) — Stage 6, additive. */
    currentSpecId: () => currentSpecId,
    rendererKind: () => gameApp.rendererKind,
    sceneDebug: () => {
      const scene = gameApp.getScene();
      if (!scene) return null;
      return { ...scene.debugState(), ...scene.sessionDebug(), hostPaused: gameApp.isPaused() };
    },
    canvasRect() {
      const canvas = gameApp.canvasElement();
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    /** Live scene world size (Arena layout space for e2e mapping). */
    stageView(): { w: number; h: number } {
      const scene = gameApp.getScene();
      if (scene) return { w: scene.w, h: scene.h };
      return gameApp.view;
    },
  };
}
