/* ============================================================
   Lenny — Garden of Light 2026 shell bootstrap.
   Flow: hero → garden → game (PixiJS) → parent lens.
   The cognitive core is consumed through the exact same public
   APIs the old shell used — same classes, same localStorage keys.
   ============================================================ */

import './ui/styles/tokens.css';
import './ui/styles/global.css';
import './ui/styles/animations.css';
import './ui/styles/shelf.css';
import './ui/styles/garden-life.css';
import './ui/styles/daylight.css';
import './ui/styles/parentlens.css';

import { AdaptiveDifficulty } from './games/core/AdaptiveDifficulty';
import { MemoryGarden } from './games/core/MemoryGarden';
import { bloomLevel, freshGarden, LocalProgressStore, type GardenData } from './games/core/ProgressStore';
import { isFirstVisitToday, markGreetedToday, phaseNow, timeGreeting, todayKey } from './content/dayCycle';

import { createGameHost } from './ui/components/GameHost';
import { createGardenMap } from './ui/components/GardenMap';
import { createParentLens } from './ui/components/ParentLens';
import { createHero } from './ui/components/Hero';
import { installCatalog } from './content/catalog';
import { audio } from './games/engine/AudioEngine';
import { music } from './audio/MusicEngine';
import { h } from './ui/components/common/el';

declare global {
  interface Window {
    __lenny?: {
      version: string;
      screen(): string;
      garden(): GardenData;
      zoneLevel(zone: string): number;
      scene(): string | null;
      sceneState(): Record<string, unknown> | null;
      /** Stage 6 (additive): the catalog spec currently playing. */
      spec(): string | null;
      /** Stage 6 (additive): soundtrack state (mood/intensity/running). */
      music(): { mood: string; intensity: number; running: boolean; hasContext: boolean; crossfading: boolean; prevMood: string | null };
      renderer(): string | null;
      canvasRect(): { x: number; y: number; width: number; height: number } | null;
      design: { w: number; h: number };
    };
  }
}

const appRoot = document.querySelector<HTMLDivElement>('#app');

/* ---------- the 144-game catalog (validated at boot) ---------- */

installCatalog();

/* ---------- toast (the shell's gentle error surface) ---------- */

const toastEl = document.getElementById('toast');
let toastTimer: number | null = null;

function toast(message: string): void {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

function oops(): void {
  toast('אוּפּס! מַשֶּׁהוּ הִשְׁתַּבֵּשׁ — בּוֹא נְנַסֶּה שׁוּב.');
}

window.addEventListener('error', oops);
window.addEventListener('unhandledrejection', oops);

/* Stage 6 (autoplay policy): the soundtrack needs a gesture. ANY first
   interaction (hero button, zone card) counts — the context is created
   only here, never before. */
const unlockAudio = (): void => {
  audio.unlock();
  document.removeEventListener('pointerdown', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
  document.removeEventListener('touchstart', unlockAudio);
};
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('keydown', unlockAudio);
document.addEventListener('touchstart', unlockAudio, { passive: true });

/* ---------- garden state (cognitive core, untouched) ---------- */

const store = new LocalProgressStore();

function loadGarden(): GardenData {
  try {
    return store.load();
  } catch {
    return freshGarden();
  }
}

function hasProgress(data: GardenData): boolean {
  if (Object.values(data.zones).some((zone) => zone.finished > 0)) return true;
  if (data.finished) return Object.values(data.finished).some((count) => count > 0);
  return false;
}

function baseGreeting(): string {
  try {
    return new MemoryGarden().greeting().join(' ');
  } catch {
    return 'בְּרוּכָה הַבָּאָה לַגַּן שֶׁל אוֹרוֹת.';
  }
}

/* Stage 6: first hello of the day is hour-aware — the garden says
   בֹּקֶר טוֹב / עֶרֶב טוֹב before the core's warm lines. The MARK is
   set only when the garden screen actually shows (never at boot). */
function gardenGreeting(): string {
  const base = baseGreeting();
  try {
    if (isFirstVisitToday(todayKey())) {
      return `${timeGreeting(phaseNow())} ${base}`;
    }
  } catch {
    /* fall through to the plain greeting */
  }
  return base;
}

function personalGreeting(): string {
  const name = localStorage.getItem('lenny-name')?.trim() ?? '';
  return name ? `שָׁלוֹם ${name}! בָּא לְךָ לְשַׂחֵק?` : baseGreeting();
}

/* ---------- screens ---------- */

let currentScreen = 'hero';
/* where the parent lens was opened from — it returns to the same place */
let parentSource: 'hero' | 'garden' = 'hero';

function showScreen(name: 'hero' | 'garden' | 'game' | 'parent'): void {
  currentScreen = name;
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
  /* Stage 6: the day's hello counts only when the garden is SEEN */
  if (name === 'garden') {
    try {
      markGreetedToday(todayKey());
    } catch {
      /* private mode: the hello repeats — harmless */
    }
  }
}

function refreshAll(): void {
  const data = loadGarden();
  hero.setGreeting(personalGreeting());
  hero.setShowContinue(hasProgress(data));
  hero.setBloomLit(bloomLevel(data) > 0);
  garden.setGreeting(gardenGreeting());
  garden.refresh();
}

function openGarden(): void {
  refreshAll();
  showScreen('garden');
}

const parent = createParentLens({
  loadGarden,
  onExit: () => {
    refreshAll();
    showScreen(parentSource);
  },
});

const hero = createHero({
  onStart: () => openGarden(),
  onContinue: () => openGarden(),
  onParent: () => {
    parentSource = 'hero';
    parent.open();
    showScreen('parent');
  },
  onNameChange(name) {
    if (name) localStorage.setItem('lenny-name', name);
    else localStorage.removeItem('lenny-name');
    hero.setGreeting(personalGreeting());
  },
});

const gameHost = createGameHost({
  loadGarden,
  onExit: () => {
    refreshAll();
    showScreen('garden');
  },
  onUnavailable: () => toast('הַמִּשְׂחָקִים מִתְעוֹרְרִים — בְּקָרוֹב נִשְׂחַק!'),
});

const garden = createGardenMap({
  onBack: () => showScreen('hero'),
  onParents: () => {
    parentSource = 'garden';
    parent.open();
    showScreen('parent');
  },
  onZone: (zoneId) => {
    void gameHost.open(zoneId).then((opened) => {
      if (opened) showScreen('game');
    });
  },
  onLockedTap: () => toast('עוֹד קְצָת וְגַם הַשַּׁעַר הַזֶּה יִפָּתַח.'),
  onFreshZones: () => toast('הַשַּׁעַר נִפְתַּח! בּוֹא נִרְאֶה מָה יֵשׁ שָׁם!'),
});

const frame = h('div', { class: 'frame' }, hero.root, garden.root, gameHost.root, parent.root);
appRoot?.append(frame);

const screens: Record<'hero' | 'garden' | 'game' | 'parent', HTMLElement> = {
  hero: hero.root,
  garden: garden.root,
  game: gameHost.root,
  parent: parent.root,
};

/* ---------- read-only state bridge (e2e + parent tooling) ---------- */

window.__lenny = {
  version: 'stage-4',
  screen: () => currentScreen,
  garden: loadGarden,
  zoneLevel: (zone: string) => new AdaptiveDifficulty(zone).level(),
  scene: () => gameHost.currentSceneKey(),
  sceneState: () => gameHost.sceneDebug(),
  /** Stage 6 (additive): the spec currently playing + music state. */
  spec: () => gameHost.currentSpecId(),
  music: () => music.debug(),
  renderer: () => gameHost.rendererKind(),
  canvasRect: () => gameHost.canvasRect(),
  /* live world space (Arena): scenes lay out in these units */
  get design() {
    const v = gameHost.stageView();
    return { w: v.w, h: v.h };
  },
};

/* ---------- first light ---------- */

refreshAll();
showScreen('hero');
