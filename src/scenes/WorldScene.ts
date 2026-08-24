import Phaser from 'phaser';
import { stateManager } from '../core/StateManager';
import { events } from '../core/EventBus';
import { loadSave, storeSave } from '../systems/save';
import { pickForWorld, hintLevel, Puzzle } from '../systems/puzzles';
import worldsData from '../content/worlds.json';
import { drawAurora } from '../fx/aurora';
import { drawDiorama } from '../fx/diorama';
import { drawMascot } from '../fx/mascot';
import { drawPost } from '../fx/post';

/* WorldScene v2 — clean gameplay: move -> puzzle -> gate -> light -> save */
export class WorldScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private dio!: Phaser.GameObjects.Graphics;
  private mg!: Phaser.GameObjects.Graphics;
  private fg!: Phaser.GameObjects.Graphics;
  private pg!: Phaser.GameObjects.Graphics;

  private mx = 0; private my = 0; private baseY = 0;
  private vx = 0; private vy = 0;
  private puzzleOpen = false; private gateOpen = false;
  private won = 0; private fails = 0;
  private puzzle: Puzzle | null = null;
  private qText!: Phaser.GameObjects.Text;
  private optTexts: Phaser.GameObjects.Text[] = [];
  private xs: number[] = [];
  private lights = 0;
  private emotion: 'calm' | 'joy' | 'frustrated' = 'calm';

  constructor() { super('world'); }

  create(): void {
    // Load saved state into StateManager
    const sv = loadSave();
    stateManager.setLights(sv.lights);
    this.lights = stateManager.getLights();
    this.emotion = stateManager.getEmotion();

    const w = this.scale.width, h = this.scale.height;
    this.baseY = h * 0.62;

    // World data
    const wd = (worldsData.worlds as any[])[stateManager.getWorld()] ?? (worldsData.worlds as any[])[0];

    // Graphics layers
    this.bg = this.add.graphics();
    this.dio = this.add.graphics();
    this.mg = this.add.graphics();
    this.fg = this.add.graphics();
    this.pg = this.add.graphics();

    // Narrative speech
    const speech = this.add.text(w / 2, h * 0.14, String(wd.line), {
      fontFamily: 'Heebo', fontSize: '16px', color: '#FFF6EC'
    }).setOrigin(0.5);
    this.time.delayedCall(2600, () => speech.setVisible(false));

    // Mascot start position
    this.mx = w * 0.2; this.my = this.baseY;
    this.xs = [0.3, 0.5, 0.7].map(f => f * w);

    // Question text
    this.qText = this.add.text(w / 2, h * 0.26, '', {
      fontFamily: 'Heebo', fontSize: '28px', color: '#FFF6EC'
    }).setOrigin(0.5).setVisible(false);

    // Option texts
    for (let i = 0; i < 3; i++) {
      const t = this.add.text(this.xs[i], h * 0.45, '', {
        fontFamily: 'Heebo', fontSize: '30px', color: '#FFD76A'
      }).setOrigin(0.5).setVisible(false);
      this.optTexts.push(t);
    }

    this.setupInput(w, h);
  }

  private setupInput(w: number, h: number): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Handle puzzle answer selection
      if (this.puzzleOpen && this.puzzle) {
        const y = h * 0.45;
        for (let i = 0; i < 3; i++) {
          if (Math.abs(p.x - this.xs[i]) < 44 && Math.abs(p.y - y) < 54) {
            if (this.puzzle.options[i] === this.puzzle.target || this.puzzle.type === 'free') {
              this.winPuzzle();
            } else {
              this.fails++;
              stateManager.setEmotion('frustrated');
              this.emotion = 'frustrated';
            }
            return;
          }
        }
        return;
      }

      // Movement controls
      const fx = p.x / w;
      if (fx < 0.34) this.vx = -240;
      else if (fx > 0.66) this.vx = 240;
      else this.vy = -260;
    });

    this.input.on('pointerup', () => { this.vx = 0; });
  }

  private openPuzzle(): void {
    this.puzzle = pickForWorld(stateManager.getWorld(), this.lights);
    this.fails = 0;
    this.puzzleOpen = true;
    this.qText.setText(this.puzzle.prompt).setVisible(true);
    events.emit('puzzle:opened', this.puzzle.id);

    const showText = this.puzzle.type === 'count' || this.puzzle.type === 'letter' || this.puzzle.type === 'time';
    this.optTexts.forEach((t, i) => {
      if (showText) t.setText(String(this.puzzle!.options[i])).setVisible(true);
      else t.setVisible(false);
    });
  }

  private winPuzzle(): void {
    this.puzzleOpen = false;
    this.gateOpen = true;
    this.won = this.time.now;

    stateManager.addLight();
    this.lights = stateManager.getLights();
    stateManager.setEmotion('joy');
    this.emotion = 'joy';

    // Save progress
    storeSave({ lights: this.lights, name: loadSave().name });
    events.emit('puzzle:solved', this.puzzle!.id);

    if (this.lights >= 10) {
      this.scene.start('win');
      return;
    }

    this.qText.setVisible(false);
    this.optTexts.forEach(t => t.setVisible(false));
  }

  update(time: number): void {
    const dt = this.game.loop.delta / 1000;
    const w = this.scale.width, h = this.scale.height;
    const t = time * 0.001;

    // Render background effects
    drawAurora(this.bg, w, h, t, this.lights);
    drawDiorama(this.dio, w, h, t, this.mx, this.lights);

    // Mascot physics
    this.mx = Phaser.Math.Clamp(this.mx + this.vx * dt, 30, w - 30);
    this.vy += 900 * dt;
    this.my = Math.min(this.baseY, this.my + this.vy * dt);
    if (this.my >= this.baseY) this.vy = 0;

    drawMascot(this.mg, this.mx, this.my, 1.2, t, this.emotion, this.vy, this.my >= this.baseY - 1);

    // Foreground: gate and puzzle
    this.fg.clear();
    const gx = w * 0.85;

    if (!this.gateOpen) {
      this.fg.fillStyle(0x7c4dff, 1);
      this.fg.fillRect(gx - 4, h * 0.4, 8, h * 0.22);
      this.fg.fillStyle(0xffd76a, 1);
      this.fg.fillCircle(gx, h * 0.4, 8);

      // Trigger puzzle when approaching gate
      if (this.mx > gx - 90 && !this.puzzleOpen) this.openPuzzle();
    }

    // Puzzle overlay
    if (this.puzzleOpen && this.puzzle) {
      this.fg.fillStyle(0x0a0416, 0.6);
      this.fg.fillRect(0, 0, w, h);

      // Hint based on fails
      if (hintLevel(this.fails) >= 1) {
        const ci = this.puzzle.options.indexOf(this.puzzle.target);
        if (ci >= 0) {
          this.fg.lineStyle(3, 0x7dffb8, 0.9);
          this.fg.strokeCircle(this.xs[ci], h * 0.45, 46);
        }
      }
    }

    // Victory burst
    if (this.won) {
      const k = (this.time.now - this.won) / 1000;
      if (k < 1.2) {
        this.fg.lineStyle(4, 0xffd76a, 1 - k / 1.2);
        this.fg.strokeCircle(this.mx, this.my - 40, 20 + k * 80);
      }
    }

    drawPost(this.pg, w, h, Math.floor(t * 2));
  }
}
