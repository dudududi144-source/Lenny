/* ============================================================
 * KiteMatchScene — the fifth playable game.
 * Lives in Space Sky (zone: space-sky).
 * Match each kite to its shadow. A spatial matching game.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';

export class KiteMatchScene extends Phaser.Scene {
  private kiteG!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;

  private kiteSpots: { x: number; y: number; color: number; matched: boolean }[] = [];
  private shadowSpots: { x: number; y: number; color: number; matched: boolean }[] = [];
  private selectedKite: number | null = null;
  private matchedCount = 0;
  private readonly TOTAL = 4;
  private done = false;

  private readonly COLORS = [0xf2549a, 0x4dc9ff, 0xffd76a, 0x7dffb8];

  constructor() { super('kite-match'); }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* sky background */
    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x1a2a4a, 0.45);

    this.kiteG = this.add.graphics();

    this.msgText = this.add.text(w / 2, h * 0.08, 'הָעִפְעוֹפִים הִתְבַּלְבְּלוּ בַּשָּׁמַיִם', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.buildBoard(w, h);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private buildBoard(w: number, h: number): void {
    /* kites on the left */
    this.kiteSpots = [];
    for (let i = 0; i < this.TOTAL; i++) {
      this.kiteSpots.push({
        x: w * 0.25,
        y: h * 0.25 + i * h * 0.16,
        color: this.COLORS[i],
        matched: false,
      });
    }
    /* shadows on the right, shuffled order */
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.shadowSpots = [];
    for (let i = 0; i < this.TOTAL; i++) {
      this.shadowSpots.push({
        x: w * 0.75,
        y: h * 0.25 + order[i] * h * 0.16,
        color: this.COLORS[i],
        matched: false,
      });
    }
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;

    /* tap a kite to select it */
    const ki = this.hitKite(p.x, p.y);
    if (ki !== null) {
      this.selectedKite = ki;
      this.msgText.setText('עַכְשָׁיו בּוֹא נִמְצָא אֶת הַצֵּל');
      return;
    }

    /* tap a shadow while a kite is selected */
    if (this.selectedKite !== null) {
      const si = this.hitShadow(p.x, p.y);
      if (si !== null) {
        const kite = this.kiteSpots[this.selectedKite];
        const shadow = this.shadowSpots[si];
        if (!shadow.matched && kite.color === shadow.color) {
          kite.matched = true;
          shadow.matched = true;
          this.matchedCount++;
          this.selectedKite = null;
          if (this.matchedCount >= this.TOTAL) {
            this.win();
          } else {
            this.msgText.setText('וָאו! הִתְאֲמָה מֻשְׁלֶמֶת!');
          }
        } else {
          this.msgText.setText('נַסֶּה צֵל אַחֵר');
        }
      }
    }
  }

  private hitKite(px: number, py: number): number | null {
    for (let i = 0; i < this.kiteSpots.length; i++) {
      const k = this.kiteSpots[i];
      if (k.matched) continue;
      if (Math.hypot(px - k.x, py - k.y) < 42) return i;
    }
    return null;
  }

  private hitShadow(px: number, py: number): number | null {
    for (let i = 0; i < this.shadowSpots.length; i++) {
      const s = this.shadowSpots[i];
      if (s.matched) continue;
      if (Math.hypot(px - s.x, py - s.y) < 42) return i;
    }
    return null;
  }

  update(time: number): void {
    const t = time * 0.001;
    const g = this.kiteG;
    g.clear();

    /* kites */
    for (let i = 0; i < this.kiteSpots.length; i++) {
      const k = this.kiteSpots[i];
      const sway = Math.sin(t * 1.8 + i) * 4;
      const sel = this.selectedKite === i;
      this.drawKite(g, k.x + sway, k.y, k.color, sel, k.matched);
    }

    /* shadows */
    for (const s of this.shadowSpots) {
      this.drawShadow(g, s.x, s.y, s.matched);
    }
  }

  private drawKite(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, selected: boolean, matched: boolean): void {
    const alpha = matched ? 0.4 : 1;
    /* halo if selected */
    if (selected) {
      g.fillStyle(0xffd76a, 0.2);
      g.fillCircle(x, y, 44);
    }
    /* diamond body */
    g.fillStyle(color, alpha);
    g.fillPoints([
      { x, y: y - 26 },
      { x: x + 20, y },
      { x, y: y + 26 },
      { x: x - 20, y },
    ], true);
    /* cross lines */
    g.lineStyle(1.5, 0xfff6ec, 0.4 * alpha);
    g.lineBetween(x, y - 26, x, y + 26);
    g.lineBetween(x - 20, y, x + 20, y);
    /* tail */
    g.lineStyle(2, color, 0.7 * alpha);
    g.beginPath();
    g.moveTo(x, y + 26);
    g.lineTo(x + 6, y + 40);
    g.lineTo(x - 4, y + 52);
    g.strokePath();
  }

  private drawShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, matched: boolean): void {
    const alpha = matched ? 0.15 : 0.5;
    g.fillStyle(0x0a0416, alpha);
    g.fillPoints([
      { x, y: y - 26 },
      { x: x + 20, y },
      { x, y: y + 26 },
      { x: x - 20, y },
    ], true);
    if (matched) {
      g.lineStyle(2, 0x7dffb8, 0.8);
      g.strokePoints([
        { x, y: y - 26 },
        { x: x + 20, y },
        { x, y: y + 26 },
        { x: x - 20, y },
      ], true, true);
    }
  }

  private win(): void {
    this.done = true;
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הָעִפְעוֹפִים מָצְאוּ אֶת הַצְּלָלִים!');

        recordZoneFinish('space-sky');

    this.time.delayedCall(1800, () => this.scene.start('portal'));
  }
}
