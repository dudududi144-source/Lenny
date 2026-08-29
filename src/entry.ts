/* ============================================================
 * Entry — three-screen product flow, all HTML/CSS until a real
 * mini-game is chosen:
 *   1. hero      — first impression
 *   2. garden    — the journey map (HTML/CSS, premium)
 *   3. Phaser    — only the actual mini-game
 * ============================================================ */

import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';
import { MemoryPairsScene } from './scenes/MemoryPairsScene';
import { GlowFishScene } from './scenes/GlowFishScene';
import { AcornSortScene } from './scenes/AcornSortScene';
import { KiteMatchScene } from './scenes/KiteMatchScene';
import { FindLetterScene } from './scenes/FindLetterScene';
import { EmotionFaceScene } from './scenes/EmotionFaceScene';
import { BeePaintScene } from './scenes/BeePaintScene';
import { DrumBeatScene } from './scenes/DrumBeatScene';
import { LennyStoryScene } from './scenes/LennyStoryScene';
import { OpenEndedScene } from './scenes/OpenEndedScene';
import { SequenceEchoScene } from './scenes/SequenceEchoScene';
import { ParentLensScene } from './scenes/ParentLensScene';
import { LocalProgressStore, bloomLevel, isUnlocked, finishedCount, unlockRequirement, zoneName, consumeNewZones, GardenData } from './games/core/ProgressStore';
import { GARDEN_TEXT, ZONES as GARDEN_ZONES } from './data/garden';
import { gamesInZone } from './games/builder/GameRegistry';
import { GameFactory } from './games/builder/GameFactory';
import { MemoryGarden } from './games/core/MemoryGarden';

/* UI view-model for the HTML garden map - derived from the SINGLE
   source of truth in data/garden.ts (this file previously held its
   own duplicate ZONES array with conflicting colors). */
interface ZoneView { id: string; name: string; desc: string; color: string; scene: string; }

const ZONES: ZoneView[] = GARDEN_ZONES.map((z) => ({
  id: z.id,
  name: z.name,
  desc: z.desc,
  color: z.uiColor,
  scene: z.gameScene ?? 'play',
}));


const store = new LocalProgressStore();
function loadGarden(): GardenData { return store.load(); }

/* ---------- screens ---------- */
const hero = () => document.getElementById('hero');
const garden = () => document.getElementById('garden');
const gameBackBtn = () => document.getElementById('gameBackBtn');

function show(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove('hidden');
}
function hide(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add('hidden');
}

let toastTimer: number | undefined;
function showToast(msg: string): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ---------- build the garden journey ---------- */
function buildGarden(): void {
  const path = document.getElementById('path');
  if (!path) return;
  path.innerHTML = '';
  const data = loadGarden();
  const fresh = consumeNewZones();

  ZONES.forEach((z, i) => {
    const open = isUnlocked(data, z.id);
    const done = finishedCount(data, z.id);
    const req = unlockRequirement(z.id);
    let lockHint = 'עוֹד מְעַט...';
    if (req) {
      const have = finishedCount(data, req.from);
      lockHint = zoneName(req.from) + ' ' + have + '/' + req.needed + ' — שַׂחֲקוּ שָׁם כְּדֵי לִפְתֹּחַ';
    }
    const node = document.createElement('button');
    node.className = 'zone' + (open ? '' : ' locked');
    node.style.setProperty('--zc', z.color);
    node.style.setProperty('--i', String(i));
    node.innerHTML =
      '<span class="node"><span class="core"></span></span>' +
      '<span class="zone-text">' +
        '<span class="zone-name">' + z.name + '</span>' +
        '<span class="zone-desc">' + (open ? (done>0 ? ('⭐ ' + done + ' · ' + z.desc) : z.desc) : lockHint) + '</span>' +
      '</span>' +
      (open ? '' : '<span class="lock">🔒</span>');
    node.addEventListener('click', () => {
      if (!open) { node.classList.add('shake'); setTimeout(()=>node.classList.remove('shake'),400); return; }
      /* The Game Builder: zones with several registered games advance through
         them as the child completes the zone (this is what makes the 'games as
         data' registry real - e.g. open-create was previously unreachable). */
      const specs = gamesInZone(z.id);
      if (specs.length > 0) {
        const spec = specs[Math.min(done, specs.length - 1)];
        enterGame(GameFactory.sceneKey(spec), spec);
      } else {
        enterGame(z.scene);
      }
    });
    if (fresh.includes(z.id)) {
      node.classList.add('fresh');
      const nb = document.createElement('span');
      nb.className = 'new-badge';
      nb.textContent = 'חָדָשׁ!';
      node.appendChild(nb);
    }
    path.appendChild(node);
  });

  /* celebrate freshly-unlocked zones once */
  if (fresh.length > 0) showToast(GARDEN_TEXT.newZone);
}


/* Minimal bridge scene: when a mini-game ends it calls scene.start('portal');
   this scene immediately hands control back to the HTML garden map so the
   player sees the garden grow. Connects games -> garden -> hero. */
class PortalExitScene extends Phaser.Scene {
  constructor() { super('portal'); }
  create(): void {
    const fn = (window as any).__lennyBackToGarden as undefined | (() => void);
    if (fn) fn();
    this.scene.stop();
  }
}

/* ---------- Phaser (only for a real mini-game) ---------- */
let game: Phaser.Game | null = null;
function boot(): void {
  if (game) return;
  game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game',
    backgroundColor: '#0b0726',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 420, height: 720 },
    scene: [
      PlayScene, MemoryPairsScene, GlowFishScene, AcornSortScene, KiteMatchScene,
      FindLetterScene, EmotionFaceScene, BeePaintScene, DrumBeatScene,
      LennyStoryScene, OpenEndedScene, SequenceEchoScene, ParentLensScene, PortalExitScene,
    ],
  });
}

function stopAllScenes(): void {
  if (!game) return;
  // stop every active scene so only ONE runs at a time (no stacking)
  game.scene.scenes.forEach((s) => { if (s.scene.isActive()) s.scene.stop(); });
}

function enterGame(sceneKey: string, spec?: unknown): void {
  boot();
  hide(garden());
  show(gameBackBtn());
  let attempts = 0;
  const tryStart = () => {
    if (game && game.isRunning) { stopAllScenes(); game.scene.start(sceneKey, spec ? { spec } : undefined); return; }
    if (++attempts < 75) setTimeout(tryStart, 80);
    else { const e = document.getElementById('errbar'); if (e) { e.style.display='block'; e.textContent='שגיאה: המשחק לא הצליח להיטען. רעננו את הדף.'; } show(garden()); }
  };
  tryStart();
}

/* ---------- wiring ---------- */
(window as any).__lennyBackToGarden = () => { stopAllScenes(); buildGarden(); show(garden()); hide(gameBackBtn()); };
document.getElementById('startBtn')?.addEventListener('click', () => {
  buildGarden();
  hide(hero());
  show(garden());
});
document.getElementById('continueBtn')?.addEventListener('click', () => {
  buildGarden();
  hide(hero());
  show(garden());
});
document.getElementById('backBtn')?.addEventListener('click', () => {
  hide(garden());
  show(hero());
});
document.getElementById('gameBackBtn')?.addEventListener('click', () => {
  stopAllScenes();
  buildGarden();
  show(garden());
  hide(gameBackBtn());
});
document.getElementById('parentLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  boot();
  hide(hero()); hide(garden());
  let attempts = 0;
  const trySwitch = () => {
    if (game && game.isRunning) { game.scene.start('parent-lens'); return; }
    if (++attempts < 75) setTimeout(trySwitch, 80);
    else show(hero());
  };
  trySwitch();
});

/* greeting */
try {
  const raw = localStorage.getItem('lenny-garden');
  if (raw) {
    const s = JSON.parse(raw);
    const g = document.getElementById('greeting');
    const bloom = bloomLevel(store.load());
    const badge = document.querySelector('.badge .dot') as HTMLElement | null;
    if (badge && bloom > 0) badge.style.background = '#ffd76a';
    if (g) {
      /* personalized greeting from MemoryGarden (was a disconnected module) */
      try { g.textContent = new MemoryGarden().greeting().join(' '); }
      catch { /* keep whatever is on screen */ }
    }
    const cont = document.getElementById('continueBtn') as HTMLButtonElement | null;
    if (cont && s && s.finished && Object.keys(s.finished).length > 0) cont.hidden = false;
  }
} catch { /* fresh */ }

/* child name personalization */
const nameInput = document.getElementById('nameInput') as HTMLInputElement | null;
if (nameInput) {
  try { nameInput.value = localStorage.getItem('lenny-name') || ''; } catch { /* noop */ }
  const personalize = (): void => {
    const n = nameInput.value.trim();
    try { if (n) localStorage.setItem('lenny-name', n); else localStorage.removeItem('lenny-name'); } catch { /* noop */ }
    const g = document.getElementById('greeting');
    if (g && n) g.textContent = 'שָׁלוֹם ' + n + '! בָּא לְךָ לְשַׂחֵק?';
  };
  if (nameInput.value.trim()) personalize();
  nameInput.addEventListener('input', personalize);
}
