import Phaser from 'phaser';
import { events } from '../core/EventBus';
import { stateManager } from '../core/StateManager';
import { Puzzle, pickForWorld, hintLevel } from '../systems/puzzles';

export class PuzzleScene extends Phaser.Scene {
  private puzzle!: Puzzle;
  private fails: number = 0;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private xs: number[] = [];

  constructor() {
    super('puzzle');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    
    // Pick a puzzle for current world
    this.puzzle = pickForWorld(stateManager.getWorld(), stateManager.getLights());
    this.fails = 0;
    
    // Dark overlay
    this.add.rectangle(w/2, h/2, w, h, 0x0a0416, 0.85);
    
    // Question text
    this.add.text(w/2, h * 0.26, this.puzzle.prompt, {
      fontFamily: 'Heebo',
      fontSize: '28px',
      color: '#FFF6EC'
    }).setOrigin(0.5);
    
    // Options
    this.xs = [0.3, 0.5, 0.7].map(f => f * w);
    this.puzzle.options.forEach((option, i) => {
      const btn = this.add.text(this.xs[i], h * 0.45, String(option), {
        fontFamily: 'Heebo',
        fontSize: '30px',
        color: '#FFD76A'
      }).setOrigin(0.5).setInteractive();
      
      btn.on('pointerdown', () => this.selectOption(i));
      this.optionTexts.push(btn);
    });
    
    events.emit('puzzle:opened', this.puzzle.id);
  }

  private selectOption(index: number): void {
    const isCorrect = this.puzzle.options[index] === this.puzzle.target;
    
    if (isCorrect) {
      this.onPuzzleSolved();
    } else {
      this.onPuzzleFailed();
    }
  }

  private onPuzzleSolved(): void {
    stateManager.addLight();
    stateManager.setEmotion('joy');
    events.emit('puzzle:solved', this.puzzle.id);
    
    // Save progress
    this.showSuccess();
  }

  private onPuzzleFailed(): void {
    this.fails++;
    stateManager.setEmotion('frustrated');
    events.emit('puzzle:failed', this.puzzle.id, this.fails);
    
    // Show hint based on fail count
    if (hintLevel(this.fails) >= 1) {
      this.showHint();
    }
  }

  private showHint(): void {
    const correctIndex = this.puzzle.options.indexOf(this.puzzle.target);
    if (correctIndex >= 0 && this.optionTexts[correctIndex]) {
      this.optionTexts[correctIndex].setColor('#7dffb8');
    }
  }

  private showSuccess(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    
    this.add.text(w/2, h * 0.6, 'Great job!', {
      fontFamily: 'Heebo',
      fontSize: '32px',
      color: '#7dffb8'
    }).setOrigin(0.5);
    
    this.time.delayedCall(1500, () => {
      this.scene.stop();
    });
  }
}
