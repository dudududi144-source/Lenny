import Phaser from 'phaser';
import tokens from './tokens.json';
import { TitleScene } from './ui/TitleScene';
import { HubScene } from './ui/HubScene';
import { WorldScene } from './scenes/WorldScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { ParentsScene } from './ui/ParentsScene';
import { WinScene } from './ui/WinScene';
import { DesignScene } from './ui/DesignScene';

/* Lenny v2 — clean modular architecture */
new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  backgroundColor: tokens.colors.night,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%'
  },
  scene: [TitleScene, HubScene, WorldScene, PuzzleScene, ParentsScene, WinScene, DesignScene]
});
