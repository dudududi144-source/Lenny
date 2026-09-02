/* ============================================================
 * WorldScreen — the DOM shell around the 3D world canvas.
 *
 * Owns: the canvas host, the floating header (title + light chip
 * + back), the grown-up corner (parents + classic garden), the
 * loading veil, and the window.__lennyWorld debug bridge.
 *
 * The Babylon engine itself is LAZY: this module is cheap DOM, and
 * the world engine chunk loads on the first open only. Classic
 * sessions never download a byte of Babylon.
 *
 * Zones, movement, creatures and Lenny arrive in commits 2-6.
 * ============================================================ */

import { freshGarden, LocalProgressStore, type GardenData } from '../games/core/ProgressStore';
import { h } from '../ui/components/common/el';
import { uiButton } from '../ui/components/common/Button';
import type { WorldApp } from './WorldApp';

export interface WorldScreenCallbacks {
  loadGarden(): GardenData;
  onBack(): void;
  onParents(): void;
  /** The grown-ups asked for the classic garden — the shell reroutes. */
  onClassic(): void;
  /** Engine missing/failed/perf-distress — the shell falls back silently. */
  onWorldFailed(): void;
  toast(message: string): void;
}

export type WorldPhase = 'onboarding' | 'exploring' | 'shelf-open' | 'closed';

export interface WorldScreenHandle {
  root: HTMLElement;
  /** Boots the engine on first call; resolves when the world renders. */
  open(): Promise<void>;
  /** Fully disposes the engine (clean handoff, zero leaks). */
  close(): void;
  isOpen(): boolean;
}

const store = new LocalProgressStore();

function loadGarden(): GardenData {
  try {
    return store.load();
  } catch {
    return freshGarden();
  }
}

declare global {
  interface Window {
    __lennyWorld?: {
      version: string;
      presencePos(): { x: number; z: number } | null;
      nearZone(): string | null;
      zones(): Array<{ id: string; unlocked: boolean; bloom: number }>;
      fps(): number;
      phase(): WorldPhase;
      renderer(): string | null;
    };
  }
}

export function createWorldScreen(callbacks: WorldScreenCallbacks): WorldScreenHandle {
  const stage = h('div', { class: 'world-stage', id: 'world-stage' });
  const loading = h(
    'div',
    { class: 'world-loading', id: 'world-loading', 'aria-hidden': 'true' },
    h('span', { class: 'world-loading-star', 'aria-hidden': 'true' }, '✦'),
    h('span', { class: 'world-loading-text' }, 'הַגַּן מִתְעוֹרֵר...'),
  );

  const lightCount = h('span', { class: 'light-count' }, '0');
  const lightChip = h(
    'span',
    { class: 'light-chip', 'aria-label': 'אורות שנאספו' },
    h('span', { class: 'light-star', 'aria-hidden': 'true' }, '✦'),
    lightCount,
  );

  const back = uiButton({
    label: '→ חזרה',
    variant: 'ghost',
    id: 'world-back',
    ariaLabel: 'חזרה למסך הפתיחה',
    onPress: callbacks.onBack,
  });

  const root = h(
    'section',
    { class: 'screen screen--world hidden', id: 'world-screen', 'aria-label': 'הגן התלת-ממדי' },
    stage,
    loading,
    h(
      'header',
      { class: 'world-head' },
      h(
        'div',
        {},
        h('h2', { class: 'world-title' }, 'הַגַּן שֶׁל לֶנִי'),
        h('p', { class: 'world-sub' }, 'בּוֹא נְהַלֵּךְ בַּגַּן'),
      ),
      h('div', { class: 'world-head-side' }, lightChip, back),
    ),
    h(
      'footer',
      { class: 'world-foot' },
      h(
        'button',
        {
          class: 'world-parents-link',
          id: 'world-parent-link',
          type: 'button',
          'aria-label': 'פינת ההורים',
          onClick: () => callbacks.onParents(),
        },
        'לְהוֹרִים',
      ),
      h(
        'button',
        {
          class: 'world-classic-link',
          id: 'world-classic-link',
          type: 'button',
          'aria-label': 'מעבר לגן הקלאסי',
          onClick: () => callbacks.onClassic(),
        },
        'גַּן קְלָאסִי',
      ),
    ),
  );

  let app: WorldApp | null = null;
  let opening: Promise<void> | null = null;
  let phase: WorldPhase = 'closed';

  /* ---------- the read-only world bridge (e2e + parent tooling) ---------- */

  window.__lennyWorld = {
    version: 'stage-7',
    presencePos: () => app?.presencePos() ?? null,
    nearZone: () => app?.nearZone() ?? null,
    zones: () => app?.zones() ?? [],
    fps: () => app?.fps() ?? 0,
    phase: () => phase,
    renderer: () => app?.rendererKind() ?? null,
  };

  async function boot(): Promise<void> {
    /* lazy chunk — classic sessions never load Babylon */
    const { createWorldApp } = await import('./WorldApp');
    const canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    canvas.setAttribute('aria-label', 'הגן התלת-ממדי של לני');
    stage.replaceChildren(canvas);
    app = await createWorldApp(
      canvas,
      {
        onDistress: () => {
          callbacks.onWorldFailed();
        },
      },
      loadGarden(),
    );
    phase = 'exploring';
  }

  async function open(): Promise<void> {
    if (app) {
      app.setPaused(false);
      return;
    }
    if (opening) return opening;
    loading.classList.remove('hidden');
    root.dataset.worldPhase = 'loading';
    opening = boot()
      .then(() => {
        loading.classList.add('hidden');
        root.dataset.worldPhase = phase;
        refresh();
      })
      .catch(() => {
        /* engine refused — the shell shows the classic garden instead */
        app = null;
        phase = 'closed';
        callbacks.onWorldFailed();
      })
      .finally(() => {
        opening = null;
      });
    return opening;
  }

  function close(): void {
    if (app) {
      app.dispose();
      app = null;
    }
    phase = 'closed';
    stage.replaceChildren();
    root.dataset.worldPhase = 'closed';
  }

  function refresh(): void {
    const data = loadGarden();
    lightCount.textContent = String(data.lights || 0);
    /* the world re-reads progress too: unlock fog + bloom fields */
    app?.refresh(data);
  }

  /* ---------- distress → one gentle grown-up note, ever ---------- */

  return {
    root,
    open,
    close,
    isOpen: () => app !== null,
  };
}
