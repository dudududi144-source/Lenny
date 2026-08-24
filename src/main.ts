import Phaser from 'phaser';
import { TitleScene } from './ui/TitleScene';
import { HubScene } from './ui/HubScene';
import { WorldScene } from './scenes/WorldScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { ParentsScene } from './ui/ParentsScene';
import { WinScene } from './ui/WinScene';

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  backgroundColor: '#0a0416',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%'
  },
  scene: [TitleScene, HubScene, WorldScene, PuzzleScene, ParentsScene, WinScene]
});
