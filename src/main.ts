/* ============================================================
   Lenny — Garden of Light 2026 shell bootstrap.
   Flow: hero → garden → game (PixiJS) → parent lens.
   The cognitive core is consumed through the exact same public
   APIs the old shell used — same classes, same localStorage keys.
   ============================================================ */

import './ui/styles/tokens.css';
import './ui/styles/global.css';
import './ui/styles/animations.css';

import { createGardenMap } from './ui/components/GardenMap';
import { createHero } from './ui/components/Hero';
import { MemoryGarden } from './games/core/MemoryGarden';
import { bloomLevel, freshGarden, LocalProgressStore, type GardenData } from './games/core/ProgressStore';
import { h } from './ui/components/common/el';

const appRoot = document.querySelector<HTMLDivElement>('#app');

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

function personalGreeting(): string {
  const name = localStorage.getItem('lenny-name')?.trim() ?? '';
  return name ? `שָׁלוֹם ${name}! בָּא לְךָ לְשַׂחֵק?` : baseGreeting();
}

/* ---------- screens ---------- */

const hero = createHero({
  onStart: () => showScreen('garden'),
  onContinue: () => showScreen('garden'),
  onParent: () => toast('פִּנַּת הַהוֹרִים נִבְנֵית — תִּפָּתַח בְּקָרוֹב.'),
  onNameChange(name) {
    if (name) localStorage.setItem('lenny-name', name);
    else localStorage.removeItem('lenny-name');
    hero.setGreeting(personalGreeting());
  },
});

const garden = createGardenMap({
  onBack: () => showScreen('hero'),
  onZone: (zoneId) => {
    /* Games boot from Commit 3 onward — until then, a gentle notice. */
    void zoneId;
    toast('הַמִּשְׂחָקִים מִתְעוֹרְרִים — בְּקָרוֹב נִשְׂחַק!');
  },
  onLockedTap: () => toast('עוֹד קְצָת וְגַם הַשַּׁעַר הַזֶּה יִפָּתַח.'),
  onFreshZones: () => toast('הַשַּׁעַר נִפְתַּח! בּוֹא נִרְאֶה מָה יֵשׁ שָׁם!'),
});

const frame = h('div', { class: 'frame' }, hero.root, garden.root);
appRoot?.append(frame);

type ScreenName = 'hero' | 'garden';
const screens: Record<ScreenName, HTMLElement> = { hero: hero.root, garden: garden.root };

function showScreen(name: ScreenName): void {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

function refreshHero(): void {
  const data = loadGarden();
  hero.setGreeting(personalGreeting());
  hero.setShowContinue(hasProgress(data));
  hero.setBloomLit(bloomLevel(data) > 0);
}

function refreshGarden(): void {
  garden.setGreeting(baseGreeting());
  garden.refresh();
}

function openGarden(): void {
  refreshGarden();
  showScreen('garden');
}

hero.root.querySelector<HTMLButtonElement>('#start-btn')?.addEventListener('click', openGarden);
hero.root.querySelector<HTMLButtonElement>('#continue-btn')?.addEventListener('click', openGarden);

/* ---------- first light ---------- */

refreshHero();
showScreen('hero');
