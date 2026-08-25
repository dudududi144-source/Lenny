/* ============================================================
 * GlowFishScene — the third playable game.
 * Lives in Attention Stream (zone: attention-stream).
 * Find the glowing fish among the swimmers. Gentle, no pressure.
 * Visual attention game — no sound needed.
 * ============================================================ */

import Phaser from 'phaser';

interface Fish {
  x: number;
  y: number;
  baseY: number;
  speed: number;
  phase: number;
  color: number;
  glowing: boolean;
}

export class GlowFishScene extends Phaser.Scene {
  private fishG!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  private fishes: Fish[] = [];
  private glowIdx = 0;
  private found = 0;
  private readonly TARGET = 5;
  private readonly FISH_COUNT = 5;
  private done = false;

  constructor() { super('glow-fish'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* stream background */
    this.add.rectangle(w / 2, h / 2, w, h, 0x10243e);

    this.fishG = this.add.graphics();

    this.msgText = this.add.text(w / 2, h * 0.08, 'הַדָּגִים מְחַפְּשִׂים אֶת הַמַּנְגִּינָה', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.scoreText = this.add.text(w / 2, h * 0.14, '', {
      fontFamily: 'Heebo, Arial', fontSize: '15px', color: '#ffd76a',
    }).setOrigin(0.5);

    this.spawnFishes(w, h);
    this.pickGlowing();
    this.updateScore();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private spawnFishes(w: number, h: number): void {
    const colors = [0x4dc9ff, 0x7dffb8, 0xffa552, 0xff8bd4, 0xb39ddb];
    this.fishes = [];
    for (let i = 0; i < this.FISH_COUNT; i++) {
      const baseY = h * 0.3 + (i / (this.FISH_COUNT - 1)) * h * 0.5;
      this.fishes.push({
        x: Math.random() * w,
        y: baseY,
        baseY,
        speed: 30 + Math.random() * 40,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
        glowing: false,
      });
    }
  }

  private pickGlowing(): void {
    for (const f of this.fishes) f.glowing = false;
    this.glowIdx = Math.floor(Math.random() * this.fishes.length);
    this.fishes[this.glowIdx].glowing = true;
  }

  private updateScore(): void {
    this.scoreText.setText('מָצָאתָ: ' + this.found + ' / ' + this.TARGET);
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;

    if (this.fishes[idx].glowing) {
      this.found++;
      this.updateScore();
      if (this.found >= this.TARGET) {
        this.win();
      } else {
        this.msgText.setText('וָאו! מָצָאתָ אוֹתוֹ!');
        this.pickGlowing();
      }
    } else {
      this.msgText.setText('כִּמְעַט! נַסֶּה שׁוּב');
    }
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.fishes.length; i++) {
      const f = this.fishes[i];
      if (Math.hypot(px - f.x, py - f.y) < 40) return i;
    }
    return null;
  }

  update(time: number): void {
    const t = time * 0.001;
    const w = this.scale.width;
    const g = this.fishG;
    g.clear();

    /* bubbles rising */
    for (let i = 0; i < 10; i++) {
      const bx = ((i * 73 + t * 10) % w);
      const by = this.scale.height - ((i * 97 + t * 30) % this.scale.height);
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(bx, by, 3 + (i % 3));
    }

    /* fishes swimming */
    for (const f of this.fishes) {
      f.x += f.speed * (this.game.loop.delta / 1000);
      if (f.x > w + 50) f.x = -50;
      f.y = f.baseY + Math.sin(t * 1.6 + f.phase) * 14;
      this.drawFish(g, f, t);
    }
  }

  private drawFish(g: Phaser.GameObjects.Graphics, f: Fish, t: number): void {
    const r = 20;

    /* glow halo for the glowing fish */
    if (f.glowing) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      g.fillStyle(0xffd76a, 0.18 * pulse);
      g.fillCircle(f.x, f.y, r * 2.4);
      g.fillStyle(0xffd76a, 0.3 * pulse);
      g.fillCircle(f.x, f.y, r * 1.6);
    }

    /* body */
    g.fillStyle(f.glowing ? 0xffd76a : f.color, 0.9);
    g.fillEllipse(f.x, f.y, r * 2, r * 1.3);

    /* tail */
    const tail = Math.sin(t * 6 + f.phase) * 4;
    g.fillTriangle(
      f.x - r * 0.9, f.y,
      f.x - r * 1.6, f.y - 8 + tail,
      f.x - r * 1.6, f.y + 8 + tail
    );

    /* eye */
    g.fillStyle(0xffffff, 1);
    g.fillCircle(f.x + r * 0.5, f.y - 3, 4);
    g.fillStyle(0x0a0416, 1);
    g.fillCircle(f.x + r * 0.55, f.y - 3, 2);
  }

  private win(): void {
    this.done = true;
    const w = this.scale.width, h = this.scale.height;
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הַדָּגִים מָצְאוּ אֶת הַמַּנְגִּינָה!');

    /* record progress for the garden */
    try {
      const raw = localStorage.getItem('lenny-garden');
      if (raw) {
        const prog = JSON.parse(raw);
        prog.finished = prog.finished || {};
        prog.finished['attention-stream'] = (prog.finished['attention-stream'] || 0) + 1;
        localStorage.setItem('lenny-garden', JSON.stringify(prog));
      }
    } catch { /* noop */ }

    this.time.delayedCall(1800, () => this.scene.start('portal'));
  }
}
