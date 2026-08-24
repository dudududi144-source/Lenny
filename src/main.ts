import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  backgroundColor: '#1a1040',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 420,
    height: 720
  },
  scene: [PlayScene]
});
