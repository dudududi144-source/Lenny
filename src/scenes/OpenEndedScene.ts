/* ============================================================
 * OpenEndedScene — the first game with NO right answer.
 * Lives in Creativity Meadow, implements the 'open-create' template.
 *
 * This is the heart of divergent thinking development:
 * the child draws freely. Lenny reacts with curiosity, never
 * judgment. There is no score, no timer, no failure.
 *
 * Design notes (the exemplar part):
 *  - Stroke-based drawing with smooth interpolation
  - Color palette + brush sizes (choice = autonomy)
  - Lenny gives varied, process-focused praise
 *    ('I see lines!' not 'good job') - growth mindset
 *  - The creation is celebrated with particles at the end
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ParticleBurst, confettiBurst } from '../games/fx/ParticleBurst';
import { DialogueBox } from '../games/fx/DialogueBox';

export class OpenEndedScene extends Phaser.Scene {
  private canvas!: Phaser.GameObjects.Graphics;
  private uiG!: Phaser.GameObjects.Graphics;
  private burst!: ParticleBurst;
  private dialogue!: DialogueBox;

  private drawing = false;
  private lastX = 0;
  private lastY = 0;
  private color = 0xf2549a;
  private brush = 6;
  private strokes = 0;
  private done = false;
  private palette: number[] = [0xf2549a, 0xffd76a, 0x4dc9ff, 0x7dffb8, 0x7c4dff, 0xffa552, 0xfff6ec];
  private sizes: number[] = [4, 8, 14];
  private praises: string[] = [
    'אֲנִי רוֹאָה קַוִּים!',
    'מַה זֶּה שֶׁצִּיַּרְתָּ?',
    'צֶבַע יָפֶה בָּחַרְתָּ!',
    'תְּנוּעָה מְעַנְיֶּנֶת!',
    'סַפֵּר לִי עַל הַצִּיּוּר',
  ];

  private roundStart = 0;

  constructor() { super('open-create'); }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    this.drawing = false;
    this.strokes = 0;
    this.done = false;
    this.roundStart = this.time.now;
    const w = this.scale.width, h = this.scale.height;

    /* soft meadow background */
    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x1e3a20, 0.45);

    this.canvas = this.add.graphics();
    this.uiG = this.add.graphics();
    this.burst = new ParticleBurst(this);
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.12, width: w * 0.8 });

    this.dialogue.say([
      'בְּרוּכִים הַבָּאִים לַאֲחוּ הַיְּצִירָה!',
      'בּוֹא נְצַיֵּר חָפְשִׁי, אֵין נָכוֹן וְלֹא נָכוֹן.',
    ]);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', () => this.onUp());

    /* visible label on the done button so kids know what it does */
    this.add.text(w * 0.5, h * 0.03 + 13, 'סִיַּמְתִּי ✓', {
      fontFamily: 'Heebo, Arial', fontSize: '14px', color: '#0e1030',
    }).setOrigin(0.5);

    this.drawPalette();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    /* check palette taps first */
    if (this.handlePaletteTap(p)) return;
    /* check done button */
    if (this.handleDoneTap(p)) return;

    this.drawing = true;
    this.lastX = p.x;
    this.lastY = p.y;
    this.dot(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drawing) return;
    /* smooth stroke: draw segments between last and current */
    const steps = Math.max(1, Math.floor(Math.hypot(p.x - this.lastX, p.y - this.lastY) / 3));
    for (let i = 1; i <= steps; i++) {
      const ix = this.lastX + (p.x - this.lastX) * (i / steps);
      const iy = this.lastY + (p.y - this.lastY) * (i / steps);
      this.dot(ix, iy);
    }
    this.lastX = p.x;
    this.lastY = p.y;
  }

  private onUp(): void {
    if (this.drawing) {
      this.drawing = false;
      this.strokes++;
      /* occasional process-focused praise */
      if (this.strokes % 4 === 0) {
        const msg = this.praises[Math.floor(Math.random() * this.praises.length)];
        this.dialogue.say(msg);
      }
    }
  }

  private dot(x: number, y: number): void {
    this.canvas.fillStyle(this.color, 0.95);
    this.canvas.fillCircle(x, y, this.brush);
  }

  private handlePaletteTap(p: Phaser.Input.Pointer): boolean {
    const w = this.scale.width, h = this.scale.height;
    /* color swatches along the bottom */
    for (let i = 0; i < this.palette.length; i++) {
      const cx = w * (0.12 + i * 0.09);
      const cy = h * 0.93;
      if (Math.hypot(p.x - cx, p.y - cy) < 22) {
        this.color = this.palette[i];
        this.drawPalette();
        return true;
      }
    }
    /* brush sizes on the right */
    for (let i = 0; i < this.sizes.length; i++) {
      const sx = w * 0.88;
      const sy = h * (0.4 + i * 0.12);
      if (Math.hypot(p.x - sx, p.y - sy) < 22) {
        this.brush = this.sizes[i];
        this.drawPalette();
        return true;
      }
    }
    return false;
  }

  private handleDoneTap(p: Phaser.Input.Pointer): boolean {
    const w = this.scale.width, h = this.scale.height;
    const bx = w * 0.5, by = h * 0.03 + 13;
    if (Math.hypot(p.x - bx, p.y - by) < 34) {
      this.finish();
      return true;
    }
    return false;
  }

  private drawPalette(): void {
    const g = this.uiG;
    g.clear();
    const w = this.scale.width, h = this.scale.height;

    /* color swatches */
    for (let i = 0; i < this.palette.length; i++) {
      const cx = w * (0.12 + i * 0.09);
      const cy = h * 0.93;
      const sel = this.palette[i] === this.color;
      g.fillStyle(this.palette[i], 1);
      g.fillCircle(cx, cy, sel ? 18 : 14);
      if (sel) {
        g.lineStyle(2, 0xfff6ec, 0.9);
        g.strokeCircle(cx, cy, 20);
      }
    }

    /* brush sizes */
    for (let i = 0; i < this.sizes.length; i++) {
      const sx = w * 0.88;
      const sy = h * (0.4 + i * 0.12);
      const sel = this.sizes[i] === this.brush;
      g.fillStyle(0xfff6ec, sel ? 1 : 0.4);
      g.fillCircle(sx, sy, this.sizes[i]);
    }

    /* done button */
    g.fillStyle(0xffd76a, 0.9);
    g.fillRoundedRect(w * 0.5 - 34, h * 0.03, 68, 26, 10);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    const w = this.scale.width, h = this.scale.height;
    this.burst.emit(confettiBurst(w / 2, h / 2));
    this.dialogue.say([
      'וָאו, מַה שֶּׁיָּצַרְתָּ!',
      'הַדְּבוֹרָה אוֹהֶבֶת אֶת הַיְּצִירָה שֶׁלְּךָ.',
    ]);

        const secs = (this.time.now - this.roundStart) / 1000;
        /* real elapsed seconds feed the PlayerModel tempo signal */
        recordZoneFinish('creativity-meadow', secs);

    this.time.delayedCall(3000, () => this.scene.start('portal'));
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.burst.update(dt, 0, 0.99);
    this.dialogue.update(dt);
  }
}
