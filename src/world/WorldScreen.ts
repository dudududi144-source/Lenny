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

import { freshGarden, LocalProgressStore, isUnlocked, type GardenData } from '../games/core/ProgressStore';
import { GARDEN_TEXT, type ZoneId } from '../data/garden';
import { isWorldOnboarded, markWorldOnboarded } from './worldMode';
import { WorldDiary } from './worldDiary';
import { bubbleLineFor } from './LennyStar';
import { music } from '../audio/MusicEngine';
import { createGameShelf, type GameShelfHandle } from '../ui/components/GameShelf';
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
  /** The child picked a game from the world shelf — the shell opens the arena. */
  onZonePick(zoneId: string, specId: string): void;
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
/* stage 8: the parent's lens sees the world too — local, identifier-free */
const diary = new WorldDiary();

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
      sky(): string | null;
      life(): { butterflies: number; fireflies: number; fish: number } | null;
    };
  }
}

export function createWorldScreen(callbacks: WorldScreenCallbacks): WorldScreenHandle {

  /* ---------- the world's game shelf (the existing DOM shelf) ---------- */

  const shelf: GameShelfHandle = createGameShelf({
    onPick: (spec) => {
      const zone = shelfZone;
      shelfZone = null;
      phase = 'exploring';
      if (zone && spec) {
        diary.notePick();
        /* arena time is game time, not garden time — the diary's
           heartbeat rests until the world opens again */
        stopHeartbeat();
        callbacks.onZonePick(zone, spec.id);
      }
    },
    onClose: () => {
      if (phase === 'shelf-open') phase = 'exploring';
    },
  }, { id: 'world-shelf' });

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

  /* Lenny's arrival bubble — she speaks the zone's own mission line,
     never new content (data/garden.ts is the only voice). */
  const bubble = h(
    'div',
    { class: 'lenny-bubble hidden', id: 'lenny-bubble', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'lenny-bubble-text' }),
  );
  let bubbleTimer: number | null = null;
  let bubblePinner: number | null = null;

  function showBubble(line: string): void {
    if (!line) return;
    bubble.querySelector('.lenny-bubble-text')!.textContent = line;
    bubble.classList.remove('hidden');
    if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.add('hidden'), 3600);
    if (bubblePinner === null) {
      bubblePinner = window.setInterval(() => {
        if (!app || bubble.classList.contains('hidden')) return;
        const p = app.lennyScreen();
        bubble.style.left = `${Math.round(p.x * 100)}%`;
        bubble.style.top = `${Math.round(Math.max(0.04, p.y - 0.075) * 100)}%`;
      }, 120);
    }
  }

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
    bubble,
    shelf.root,
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
  let shelfZone: string | null = null;
  /* the growth diary: which zones grew since the world was last seen?
     Their new flowers open with the bloom-in payoff on return. */
  let prevCounts: Record<string, number> | null = null;

  /* ---------- the world diary: honest minutes, local only ---------- */

  let sessionMark = 0;
  let heartbeat: number | null = null;
  const HEARTBEAT_MS = 30_000;

  function flushHeartbeat(): void {
    if (sessionMark > 0) {
      diary.noteHeartbeat(Date.now() - sessionMark);
      sessionMark = 0;
    }
  }

  function startHeartbeat(): void {
    sessionMark = Date.now();
    if (heartbeat === null) {
      heartbeat = window.setInterval(() => {
        if (document.hidden) {
          /* a hidden tab is not garden time — re-mark, add nothing */
          sessionMark = Date.now();
          return;
        }
        flushHeartbeat();
        sessionMark = Date.now();
      }, HEARTBEAT_MS);
    }
  }

  function stopHeartbeat(): void {
    flushHeartbeat();
    if (heartbeat !== null) {
      window.clearInterval(heartbeat);
      heartbeat = null;
    }
  }



  /* ---------- the read-only world bridge (e2e + parent tooling) ---------- */

  window.__lennyWorld = {
    version: 'stage-7',
    presencePos: () => app?.presencePos() ?? null,
    nearZone: () => app?.nearZone() ?? null,
    zones: () => app?.zones() ?? [],
    fps: () => app?.fps() ?? 0,
    phase: () => phase,
    renderer: () => app?.rendererKind() ?? null,
    sky: () => app?.skyPhase() ?? null,
    life: () => app?.life() ?? null,
  };

  async function boot(): Promise<void> {
    /* lazy chunk — classic sessions never load Babylon */
    const { createWorldApp } = await import('./WorldApp');
    const canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    canvas.setAttribute('aria-label', 'הגן התלת-ממדי של לני');
    stage.replaceChildren(canvas);
    const firstVisit = !isWorldOnboarded();
    app = await createWorldApp(
      canvas,
      {
        onDistress: () => {
          callbacks.onWorldFailed();
        },
        onLockedTap: () => {
          callbacks.toast(GARDEN_TEXT.lockedSoon);
        },
        onArrive: (zone) => {
          const line = bubbleLineFor(zone);
          if (line) showBubble(line);
          /* arriving at an OPEN zone slides in the game shelf — once
             per arrival; closing it and staying put never re-opens it */
          if (zone) {
            diary.noteArrival(zone);
            const unlocked = isUnlocked(loadGarden(), zone);
            if (unlocked && !shelf.isOpen()) {
              shelfZone = zone;
              shelf.open(zone, null);
              diary.noteShelfOpen();
              phase = 'shelf-open';
            }
          }
        },
        onPhase: (p) => {
          phase = p;
          root.dataset.worldPhase = p;
          if (p === 'exploring' && firstVisit) markWorldOnboarded();
        },
      },
      loadGarden(),
      { onboard: firstVisit },
    );
    phase = firstVisit ? 'onboarding' : 'exploring';
  }

  /** Zones that grew since the last time the world was seen. */
  function growthDiff(data: GardenData): Set<string> | undefined {
    if (!prevCounts) {
      prevCounts = {};
      for (const [zone, prog] of Object.entries(data.zones)) prevCounts[zone] = prog.finished;
      for (const [zone, n] of Object.entries(data.finished ?? {})) {
        prevCounts[zone] = Math.max(prevCounts[zone] ?? 0, n);
      }
      return undefined; /* first sight — no payoff yet */
    }
    const grew = new Set<string>();
    for (const [zone, prog] of Object.entries(data.zones)) {
      if (prog.finished > (prevCounts[zone] ?? 0)) grew.add(zone);
    }
    for (const [zone, n] of Object.entries(data.finished ?? {})) {
      if (n > (prevCounts[zone] ?? 0)) grew.add(zone);
    }
    prevCounts = {};
    for (const [zone, prog] of Object.entries(data.zones)) prevCounts[zone] = prog.finished;
    for (const [zone, n] of Object.entries(data.finished ?? {})) {
      prevCounts[zone] = Math.max(prevCounts[zone] ?? 0, n);
    }
    return grew;
  }

  async function open(): Promise<void> {
    if (app) {
      app.setPaused(false);
      const data = loadGarden();
      app.refresh(data, growthDiff(data));
      /* the soundtrack walks back into the garden */
      music.setMood('garden-exploring');
      music.resume();
      diary.noteOpen();
      startHeartbeat();
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
        music.setMood('garden-exploring');
        music.resume();
        diary.noteOpen();
        startHeartbeat();
        /* Lenny greets the child at the journey's first island —
           computed lazily: the first rendered frame lights nearZone */
        window.setTimeout(() => {
          const line = bubbleLineFor((app?.nearZone() ?? null) as ZoneId | null);
          if (line) showBubble(line);
        }, 900);
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
    stopHeartbeat();
    if (shelf.isOpen()) shelf.close();
    shelfZone = null;
    if (app) {
      app.dispose();
      app = null;
    }
    phase = 'closed';
    stage.replaceChildren();
    bubble.classList.add('hidden');
    root.dataset.worldPhase = 'closed';
  }

  function refresh(): void {
    const data = loadGarden();
    lightCount.textContent = String(data.lights || 0);
    /* the world re-reads progress too: unlock fog + bloom fields */
    app?.refresh(data, growthDiff(data));
  }

  /* ---------- distress → one gentle grown-up note, ever ---------- */

  return {
    root,
    open,
    close,
    isOpen: () => app !== null,
  };
}
