import Phaser from 'phaser';
import { stateManager } from '../core/StateManager';
import worldsData from '../content/worlds.json';
import { drawAurora } from '../fx/aurora';

/* Hub v2 — world selection using clean StateManager */
export class HubScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private fg!: Phaser.GameObjects.Graphics;
  private bubbles: { x: number; y: number; r: number; i: number }[] = [];
  private lightsText!: Phaser.GameObjects.Text;

  constructor() { super('hub'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;
    this.bg = this.add.graphics();
    this.fg = this.add.graphics();

    this.add.text(w / 2, h * 0.1, 'בַּחֲרִי עוֹלָם', {
      fontFamily: 'Heebo', fontSize: '26px', color: '#FFF6EC'
    }).setOrigin(0.5);

    this.lightsText = this.add.text(w / 2, h * 0.16, 'אוֹרוֹת: ' + stateManager.getLights() + '/10', {
      fontFamily: 'Heebo', fontSize: '16px', color: '#FFD76A'
    }).setOrigin(0.5);

    const cols = 5;
    worldsData.worlds.forEach((wd: any, i: number) => {
      const cx = w * 0.5 + ((i % cols) - 2) * (w * 0.16);
      const cy = h * 0.34 + Math.floor(i / cols) * h * 0.2;
      this.bubbles.push({ x: cx, y: cy, r: 26, i });
      this.add.text(cx, cy + 40, wd.name, {
        fontFamily: 'Heebo', fontSize: '11px', color: '#FFF6EC'
      }).setOrigin(0.5);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      for (const b of this.bubbles) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.r) {
          if (b.i <= stateManager.getLights()) {
            stateManager.setWorld(b.i);
            this.scene.start('world');
          }
          return;
        }
      }
    });
  }

  update(time: number): void {
    const w = this.scale.width, h = this.scale.height;
    const t = time * 0.001;
    const lights = stateManager.getLights();

    drawAurora(this.bg, w, h, t, lights);
    this.lightsText.setText('אוֹרוֹת: ' + lights + '/10');

    this.fg.clear();
    for (const b of this.bubbles) {
      const open = b.i <= lights;
      this.fg.fillStyle(open ? 0x7dffb8 : 0x3a3350, 1);
      this.fg.fillCircle(b.x, b.y, b.r);
      this.fg.lineStyle(2, open ? 0xffd76a : 0x55506a, 1);
      this.fg.strokeCircle(b.x, b.y, b.r);
    }
  }
}
