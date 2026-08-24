import Phaser from 'phaser';
import { PortalScene } from './scenes/PortalScene';
import { PlayScene } from './scenes/PlayScene';

/* Lenny — Cognitive Portal. Portal opens first; PlayScene is reached
   by selecting the one unlocked golden star in the galaxy. */
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
  scene: [PortalScene, PlayScene],
});
