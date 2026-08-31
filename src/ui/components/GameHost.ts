import { gamesInZone } from '../../games/builder/GameRegistry';
import {
  finishedCount,
  LocalProgressStore,
  zoneName,
  type GardenData,
} from '../../games/core/ProgressStore';
import { getZone, type ZoneId } from '../../data/garden';
import { GameApp } from '../../games/engine/GameApp';
import type { GameScene } from '../../games/engine/GameScene';
import { SCENE_REGISTRY, sceneKeyForSpec, sceneKeyForZone } from '../../games/scenes/registry';
import { createGameHUD, type GameHUDHandle } from './GameHUD';
import { h } from './common/el';

export interface GameHostCallbacks {
  loadGarden(): GardenData;
  onExit(): void;
  onUnavailable(zoneId: string): void;
}

export interface GameHostHandle {
  root: HTMLElement;
  /** Opens a zone's game; resolves false when no scene is registered yet. */
  open(zoneId: string): Promise<boolean>;
  close(): void;
  isZoneOpen(zoneId: string): boolean;
  currentZoneId(): string | null;
  currentSceneKey(): string | null;
  rendererKind(): string | null;
  sceneDebug(): Record<string, unknown> | null;
  canvasRect(): { x: number; y: number; width: number; height: number } | null;
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
  const hud: GameHUDHandle = createGameHUD({ onBack: () => close() });
  const stage = h('div', { class: 'game-stage', id: 'game-stage' });
  const root = h(
    'section',
    { class: 'screen screen--game hidden', id: 'game-screen', 'aria-label': 'משחק בגן' },
    stage,
    hud.root,
  );

  let mounted = false;
  let zoneId: string | null = null;
  let sceneKey: string | null = null;

  async function open(target: string): Promise<boolean> {
    const data = safeLoad(callbacks.loadGarden);
    const specs = gamesInZone(target);
    const done = finishedCount(data, target);
    const spec = specs.length > 0 ? specs[Math.min(done, specs.length - 1)] : null;
    const wanted = spec
      ? sceneKeyForSpec(spec)
      : sceneKeyForZone(target, getZone(target as ZoneId)?.gameScene);

    /* Not-yet-rebuilt games fall back to the living placeholder scene
       (replaced registry entry by registry entry as Stage 3 progresses). */
    const resolvedKey = wanted && SCENE_REGISTRY[wanted] ? wanted : 'coming-soon';
    const factory = SCENE_REGISTRY[resolvedKey];
    if (!factory) {
      callbacks.onUnavailable(target);
      return false;
    }

    zoneId = target;
    sceneKey = resolvedKey;
    if (!mounted) {
      await gameApp.mount(stage);
      mounted = true;
    }
    hud.setZone(zoneName(target));
    hud.clear();

    const scene: GameScene = factory({
      app: gameApp.pixiApp,
      zone: target,
      spec,
      hud: hud.bridge,
      onExit: () => close(),
    });
    gameApp.setScene(scene);
    return true;
  }

  function close(): void {
    gameApp.setScene(null);
    zoneId = null;
    sceneKey = null;
    callbacks.onExit();
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
    rendererKind: () => gameApp.rendererKind,
    sceneDebug: () => gameApp.getScene()?.debugState() ?? null,
    canvasRect() {
      const canvas = gameApp.canvasElement();
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
  };
}
