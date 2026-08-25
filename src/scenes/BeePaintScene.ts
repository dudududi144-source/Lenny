/* ============================================================
 * BeePaintScene — the eighth playable game.
 * Lives in Creativity Meadow (zone: creativity-meadow).
 *
 * The bee wants to paint a flower. The child picks colors and
 * fills each petal. Every filled petal blooms with particles.
 * A full flower triggers a confetti celebration.
 *
 * This is the first game built on the reusable ParticleBurst
 * system — the exemplar pattern for all future games.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { ParticleBurst, bloomBurst, confettiBurst, sparkleBurst } from '../games/fx/ParticleBurst';

interface Petal {
  angle: number;      /* position around the flower center */
  color: number;      /* filled color, 0 = empty */
  filled: boolean;
}

export class BeePaintScene extends Phaser.Scene {
  private flowerG!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private burst!: ParticleBurst;

  private petals: Petal[] = [];
  private readonly PETALS = 5;
  private palette: number[] = [0xf2549a, 0xffd76a, 0x4dc9ff, 0x7dffb8, 0x7c4dff, 0xffa552];
  private selectedColor = 0xf2549a;
  private paletteSpots: { x: number; y: number; color: number }[] = [];
  private beeAngle = 0;
  private done = false;

  constructor() { super('bee-paint'); }

  preload(): void {
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* meadow background */
    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x1e3a20, 0.45);

    this.flowerG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    this.msgText = this.add.text(w / 2, h * 0.07, 'הַדְּבוֹרָה רוֹצָה לְצַיֵּר פֶּרַח', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    /* init petals empty */
    for (let i = 0; i < this.PETALS; i++) {
      this.petals.push({ angle: (i / this.PETALS) * Math.PI * 2, color: 0, filled: false });
    }

    /* color palette at the bottom */
    this.paletteSpots = [];
    for (let i = 0; i < this.palette.length; i++) {
      this.paletteSpots.push({
        x: w * (0.15 + (i / (this.palette.length - 1)) * 0.7),
        y: h * 0.88,
        color: this.palette[i],
      });
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private flowerCenter(): { x: number; y: number } {
    return { x: this.scale.width / 2, y: this.scale.height * 0.42 };
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    const w = this.scale.width, h = this.scale.height;

    /* tap palette -> pick color */
    for (const spot of this.paletteSpots) {
      if (Math.hypot(p.x - spot.x, p.y - spot.y) < 30) {
        this.selectedColor = spot.color;
        this.burst.emit(sparkleBurst(spot.x, spot.y));
        this.msgText.setText('צֶבַע יָפֶה! עַכְשָׁיו בּוֹא נְמַלֵּא עָלֶה');
        return;
      }
    }

    /* tap a petal -> fill it with the selected color */
    const c = this.flowerCenter();
    const petalIdx = this.hitPetal(p.x, p.y);
    if (petalIdx !== null) {
      const petal = this.petals[petalIdx];
      if (!petal.filled) {
        petal.filled = true;
        petal.color = this.selectedColor;
        /* bloom effect at the petal position */
        const px = c.x + Math.cos(petal.angle) * 55;
        const py = c.y + Math.sin(petal.angle) * 55;
        this.burst.emit(bloomBurst(px, py));
        this.msgText.setText('וָאו! הֶעָלֶה פּוֹרֵחַ!');
        this.checkComplete();
      }
    }
  }

  private hitPetal(px: number, py: number): number | null {
    const c = this.flowerCenter();
    for (let i = 0; i < this.petals.length; i++) {
      const x = c.x + Math.cos(this.petals[i].angle) * 55;
      const y = c.y + Math.sin(this.petals[i].angle) * 55;
      if (Math.hypot(px - x, py - y) < 40) return i;
    }
    return null;
  }

  private checkComplete(): void {
    const allFilled = this.petals.every((pt) => pt.filled);
    if (allFilled && !this.done) {
      this.done = true;
      const c = this.flowerCenter();
      this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הַפֶּרַח פָּרַח!');
      this.burst.emit(confettiBurst(c.x, c.y));

            recordZoneFinish('creativity-meadow');

      this.time.delayedCall(2200, () => this.scene.start('portal'));
    }
  }

  update(time: number): void {
    const dt = this.game.loop.delta / 1000;
    const t = time * 0.001;
    this.burst.update(dt, 60, 0.99);
    this.drawFlower(t);
    this.drawBee(t);
    this.drawPalette();
  }

  private drawFlower(t: number): void {
    const g = this.flowerG;
    const c = this.flowerCenter();
    g.clear();

    /* stem */
    g.lineStyle(5, 0x4caf6e, 1);
    g.beginPath();
    g.moveTo(c.x, c.y + 60);
    g.lineTo(c.x + Math.sin(t * 1.2) * 3, this.scale.height * 0.75);
    g.strokePath();

    /* petals */
    for (const pt of this.petals) {
      const px = c.x + Math.cos(pt.angle) * 55;
      const py = c.y + Math.sin(pt.angle) * 55;
      if (pt.filled) {
        g.fillStyle(pt.color, 0.95);
        g.fillEllipse(px, py, 70, 44);
        g.lineStyle(2, 0xfff6ec, 0.4);
        g.strokeEllipse(px, py, 70, 44);
      } else {
        g.lineStyle(2, 0xfff6ec, 0.4);
        g.strokeEllipse(px, py, 70, 44);
      }
    }

    /* flower center */
    g.fillStyle(0xffd76a, 1);
    g.fillCircle(c.x, c.y, 28);
    g.fillStyle(0xffa552, 0.6);
    g.fillCircle(c.x, c.y, 16);
  }

  private drawBee(t: number): void {
    const g = this.flowerG;
    const c = this.flowerCenter();
    this.beeAngle += 0.012;
    const bx = c.x + Math.cos(this.beeAngle) * 110;
    const by = c.y + Math.sin(this.beeAngle) * 80 + Math.sin(t * 3) * 6;

    /* wings */
    const flap = Math.sin(t * 18) * 4;
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(bx - 4, by - 12 + flap, 12, 8);
    g.fillEllipse(bx + 4, by - 12 - flap, 12, 8);

    /* body */
    g.fillStyle(0xffd76a, 1);
    g.fillEllipse(bx, by, 20, 14);
    /* stripes */
    g.fillStyle(0x0a0416, 0.8);
    g.fillRect(bx - 5, by - 7, 3, 14);
    g.fillRect(bx + 2, by - 7, 3, 14);
    /* eye */
    g.fillStyle(0x0a0416, 1);
    g.fillCircle(bx + 7, by - 2, 2);
  }

  private drawPalette(): void {
    const g = this.flowerG;
    for (const spot of this.paletteSpots) {
      const isSel = spot.color === this.selectedColor;
      g.fillStyle(spot.color, 1);
      g.fillCircle(spot.x, spot.y, isSel ? 22 : 17);
      if (isSel) {
        g.lineStyle(3, 0xfff6ec, 0.9);
        g.strokeCircle(spot.x, spot.y, 24);
      }
    }
  }
}
