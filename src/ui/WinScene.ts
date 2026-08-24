import Phaser from 'phaser';
import { drawAurora } from '../fx/aurora';
import { drawDiorama } from '../fx/diorama';
import { drawMascot } from '../fx/mascot';

/* Win v2 — full awakening, no window globals */
export class WinScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private dio!: Phaser.GameObjects.Graphics;
  private mg!: Phaser.GameObjects.Graphics;
  private fg!: Phaser.GameObjects.Graphics;

  constructor() { super('win'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;
    this.bg = this.add.graphics();
    this.dio = this.add.graphics();
    this.mg = this.add.graphics();
    this.fg = this.add.graphics();

    this.add.text(w / 2, h * 0.2, 'הָעוֹלָם הֵאִיר!', {
      fontFamily: 'Heebo', fontSize: '40px', color: '#FFD76A'
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.3, 'כָּל הָאוֹרוֹת חָזְרוּ. תּוֹדָה גִּבּוֹרָה!', {
      fontFamily: 'Heebo', fontSize: '18px', color: '#FFF6EC'
    }).setOrigin(0.5);
  }

  update(time: number): void {
    const w = this.scale.width, h = this.scale.height;
    const t = time * 0.001;

    drawAurora(this.bg, w, h, t, 10);
    drawDiorama(this.dio, w, h, t, w / 2, 10);
    drawMascot(this.mg, w / 2, h * 0.62, 1.6, t, 'joy', 0, true);

    this.fg.clear();
    for (let i = 0; i < 24; i++) {
      const x = (i * 53 + t * 40) % w;
      const y = (i * 97 + t * 60) % h;
      this.fg.fillStyle([0xffd76a, 0x7dffb8, 0xff8bd4, 0x4dc9ff][i % 4], 0.8);
      this.fg.fillCircle(x, y, 3);
    }
  }
}
