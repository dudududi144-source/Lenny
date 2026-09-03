import { h } from './common/el';
import type { GameHostCallbacks, GameHostHandle } from './GameHostImpl';

/* ============================================================
   GameHost — the sync shell of the game screen (audit 9-c).

   The heavy implementation (Pixi + all 13 scenes + the engine)
   lives in GameHostImpl behind a dynamic import: the entry chunk
   no longer ships an entire game engine before first paint.
   Classic-garden and world visitors download it the moment they
   actually open a game — the exact lazy-chunk pattern the world
   already proven in WorldScreen.

   The DOM shell (this root) is created synchronously so main.ts
   can compose the frame. Every accessor delegates to the impl
   once it arrives; before that, they answer with honest
   "nothing open" values — no game can be open anyway.
   ============================================================ */

function createGameHost(callbacks: GameHostCallbacks): GameHostHandle {
  const root = h(
    'section',
    { class: 'screen screen--game hidden', id: 'game-screen', 'aria-label': 'משחק בגן' },
    /* round C a11y: the PixiJS ceremony is invisible to assistive tech —
       this live region repeats what the ceremony says, in text */
    h('div', { class: 'sr-only', id: 'game-live', role: 'status', 'aria-live': 'polite' }),
  );
  let impl: Promise<GameHostHandle> | null = null;
  let loaded: GameHostHandle | null = null;

  const ensure = (): Promise<GameHostHandle> => {
    if (!impl) {
      impl = import('./GameHostImpl').then((m) => {
        loaded = m.createGameHostImpl(callbacks, root);
        return loaded;
      });
    }
    return impl;
  };

  return {
    root,
    open(zoneId: string, specId?: string | null): Promise<boolean> {
      return ensure().then((g) => g.open(zoneId, specId));
    },
    close(): void {
      if (impl) void impl.then((g) => g.close());
    },
    isZoneOpen(target: string): boolean {
      return loaded ? loaded.isZoneOpen(target) : false;
    },
    currentZoneId: () => (loaded ? loaded.currentZoneId() : null),
    currentSceneKey: () => (loaded ? loaded.currentSceneKey() : null),
    currentSpecId: () => (loaded ? loaded.currentSpecId() : null),
    rendererKind: () => (loaded ? loaded.rendererKind() : null),
    sceneDebug: () => (loaded ? loaded.sceneDebug() : null),
    canvasRect: () => (loaded ? loaded.canvasRect() : null),
    stageView: () => (loaded ? loaded.stageView() : { w: 0, h: 0 }),
  };
}

export { createGameHost };
export type { GameHostCallbacks, GameHostHandle } from './GameHostImpl';
