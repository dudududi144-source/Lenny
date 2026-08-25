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
import { ParentLensScene } from './scenes/ParentLensScene';
import { LocalProgressStore, bloomLevel, isUnlocked, finishedCount, unlockRequirement, zoneName, GardenData } from './games/core/ProgressStore';

interface ZoneDef { id: string; name: string; desc: string; color: string; scene: string; }

const ZONES: ZoneDef[] = [
  { id: 'light-path',      name: 'שְׁבִיל הָאוֹר',    desc: 'הַמַּסָּע מַתְחִיל כָּאן', color: '#ffd76a', scene: 'play' },
  { id: 'memory-hill',     name: 'גִּבְעַת הַזִּכָּרוֹן', desc: 'זִכְרוֹן וְהַתְאָמוֹת',      color: '#7c4dff', scene: 'memory-pairs' },
  { id: 'attention-stream',name: 'נַחַל הַקֶּשׁב',  desc: 'קֶשֶׁב וְרִכּוּז',          color: '#4dc9ff', scene: 'glow-fish' },
  { id: 'thinking-forest', name: 'יַעַר הַחֲשִיבָה', desc: 'הִגָּיוֹן וְסֵדֶר',          color: '#7dffb8', scene: 'acorn-sort' },
  { id: 'space-sky',       name: 'שְׁמֵי הַמֶּרְחָב',  desc: 'צוּרוֹת וּמֶרְחָב',         color: '#b39ddb', scene: 'kite-match' },
  { id: 'words-valley',    name: 'עֵמֶק הַמִּלּים',  desc: 'אוֹתִיּוֹת וּמִלִּים',       color: '#f2549a', scene: 'find-letter' },
  { id: 'feelings-garden', name: 'גַּן הָרְגָשׁוֹת',  desc: 'רְגָשׁוֹת וְאַמְפַּתְיָה',     color: '#ff8bd4', scene: 'emotion-face' },
  { id: 'creativity-meadow',name:'אֲחוּ הַיְּצִירָה',  desc: 'יְצִירָה חָפְשִׁית',        color: '#ffa552', scene: 'bee-paint' },
  { id: 'rhythm-square',   name: 'כִּכַּר הַקֶּצֶב',  desc: 'קֶצֶב וּתְנוּעָה',         color: '#52e0c4', scene: 'drum-beat' },
  { id: 'breath-pool',     name: 'בְּרֵכַת הַנְּשִׁימָה', desc: 'נְשִׁימָה וּרְגִיעָה',       color: '#7c4dff', scene: 'lenny-story' },
];

const DEFAULT_UNLOCKED = ['light-path', 'breath-pool'];

const store = new LocalProgressStore();
function loadGarden(): GardenData { return store.load(); }

/* ---------- screens ---------- */
const hero = () => document.getElementById('hero');
const garden = () => document.getElementById('garden');

function show(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove('hidden');
}
function hide(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add('hidden');
}

/* ---------- build the garden journey ---------- */
function buildGarden(): void {
  const path = document.getElementById('path');
  if (!path) return;
  path.innerHTML = '';
  const data = loadGarden();

  ZONES.forEach((z, i) => {
    const open = isUnlocked(data, z.id);
    const done = finishedCount(data, z.id);
    const req = unlockRequirement(z.id);
    let lockHint = 'עוֹד מְעַט...';
    if (req) {
      const have = finishedCount(data, req.from);
      lockHint = 'שַׂחֲקוּ בְּ' + zoneName(req.from) + ' ' + req.needed + ' פְּעָמִים כְּדֵי לִפְתֹּחַ';
      if (req.needed === 1) lockHint = 'שַׂחֲקוּ פַּעַם אַחַת בְּ' + zoneName(req.from) + ' כְּדֵי לִפְתֹּחַ';
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
      enterGame(z.scene);
    });
    path.appendChild(node);
  });
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
      LennyStoryScene, OpenEndedScene, ParentLensScene, PortalExitScene,
    ],
  });
}

function stopAllScenes(): void {
  if (!game) return;
  // stop every active scene so only ONE runs at a time (no stacking)
  game.scene.scenes.forEach((s) => { if (s.scene.isActive()) s.scene.stop(); });
}

function enterGame(sceneKey: string): void {
  boot();
  hide(garden());
  let attempts = 0;
  const tryStart = () => {
    if (game && game.isRunning) { stopAllScenes(); game.scene.start(sceneKey); return; }
    if (++attempts < 75) setTimeout(tryStart, 80);
    else { const e = document.getElementById('errbar'); if (e) { e.style.display='block'; e.textContent='שגיאה: המשחק לא הצליח להיטען. רעננו את הדף.'; } show(garden()); }
  };
  tryStart();
}

/* ---------- wiring ---------- */
(window as any).__lennyBackToGarden = () => { stopAllScenes(); buildGarden(); show(garden()); };
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
    const firstSeen = s && s.firstSeen ? s.firstSeen : Date.now();
    const days = Math.round((Date.now() - firstSeen) / 86400000);
    const g = document.getElementById('greeting');
    const bloom = bloomLevel(store.load());
    const badge = document.querySelector('.badge .dot') as HTMLElement | null;
    if (badge && bloom > 0) badge.style.background = '#ffd76a';
    if (g) g.textContent = days >= 1 ? 'הֵיי! חָזַרְתְּ. הַגַּן הִתְגַּעְגֵּעַ.' : 'בְּרוּכָה הַבָּאָה לַגַּן שֶל אוֹרוֹת.';
    const cont = document.getElementById('continueBtn') as HTMLButtonElement | null;
    if (cont && s && s.finished && Object.keys(s.finished).length > 0) cont.hidden = false;
  }
} catch { /* fresh */ }
