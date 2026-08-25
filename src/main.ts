import Phaser from 'phaser';
import { PortalScene } from './scenes/PortalScene';
import { PlayScene } from './scenes/PlayScene';
import { MemoryPairsScene } from './scenes/MemoryPairsScene';
import { GlowFishScene } from './scenes/GlowFishScene';
import { AcornSortScene } from './scenes/AcornSortScene';
import { KiteMatchScene } from './scenes/KiteMatchScene';
import { FindLetterScene } from './scenes/FindLetterScene';
import { EmotionFaceScene } from './scenes/EmotionFaceScene';

/* Lenny — Garden of Lights. Portal opens first; each zone leads to its games. */
new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  backgroundColor: '#050210',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 420,
    height: 720,
  },
  scene: [PortalScene, PlayScene, MemoryPairsScene, GlowFishScene, AcornSortScene, KiteMatchScene, FindLetterScene, EmotionFaceScene],
});
