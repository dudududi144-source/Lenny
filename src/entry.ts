/* ============================================================
 * Entry — bootstraps Phaser and wires it to the HTML hero.
 * The HTML hero owns the first impression. Phaser only wakes up
 * when the user taps "start". That is what separates a product
 * from a Phaser demo.
 * ============================================================ */

import Phaser from 'phaser';
import { PortalScene } from './scenes/PortalScene';
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

/* --- personalized greeting from saved progress --- */
try {
  const raw = localStorage.getItem('lenny-garden');
  if (raw) {
    const saved = JSON.parse(raw);
    const firstSeen = saved && saved.firstSeen ? saved.firstSeen : Date.now();
    const days = Math.round((Date.now() - firstSeen) / 86400000);
    const greet = document.getElementById('greeting');
    if (greet) {
      greet.textContent = days >= 1
        ? 'הֵיי! חָזַרְתְּ. הַגַּן הִתְגַּעְגֵּעַ.'
        : 'בְּרוּכָה הַבָּאָה לַגַּן שֶל אוֹרוֹת.';
    }
    const cont = document.getElementById('continueBtn') as HTMLButtonElement | null;
    if (cont && saved && saved.finished && Object.keys(saved.finished).length > 0) {
      cont.hidden = false;
    }
  }
} catch { /* fresh start */ }

/* --- lazy boot: create the Phaser game only on tap --- */
let game: Phaser.Game | null = null;

function boot(): void {
  if (game) return;
  game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game',
    backgroundColor: '#0b0726',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 420,
      height: 720,
    },
    scene: [
      PortalScene, PlayScene, MemoryPairsScene, GlowFishScene,
      AcornSortScene, KiteMatchScene, FindLetterScene, EmotionFaceScene,
      BeePaintScene, DrumBeatScene, LennyStoryScene, OpenEndedScene,
      ParentLensScene,
    ],
  });
}

function enter(): void {
  boot();
  const hero = document.getElementById('hero');
  if (hero) hero.classList.add('hidden');
}

document.getElementById('startBtn')?.addEventListener('click', enter);
document.getElementById('continueBtn')?.addEventListener('click', enter);
document.getElementById('parentLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  boot();
  const hero = document.getElementById('hero');
  if (hero) hero.classList.add('hidden');
  const trySwitch = () => {
    if (game && game.isRunning) {
      game.scene.start('parent-lens');
    } else {
      setTimeout(trySwitch, 80);
    }
  };
  trySwitch();
});
