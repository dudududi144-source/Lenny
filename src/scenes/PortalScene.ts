/* ============================================================
 * PortalScene — the garden itself, no intro fluff.
 * The HTML hero owns the first impression; this scene is just
 * the garden, ready to play. Clear depth order, one update.
 * ============================================================ */

import Phaser from 'phaser';
import { GardenSystem, GardenProgress, defaultProgress } from '../portal/GardenSystem';
import { gamesInZone } from '../games/builder/GameRegistry';
import { GameFactory } from '../games/builder/GameFactory';

const STORE_KEY = 'lenny-garden';

export class PortalScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private g!: Phaser.GameObjects.Graphics;
  private lenny!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Ellipse;
  private parentIcon!: Phaser.GameObjects.Text;
  private garden!: GardenSystem;
  private progress!: GardenProgress;

  constructor() { super('portal'); }

  preload(): void {
    this.load.image('garden-bg', 'art/garden-bg.png');
    this.load.image('lenny', 'art/lenny.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;
    this.progress = this.loadProgress();
    this.garden = new GardenSystem();

    /* depth 0 — illustrated world */
    this.bg = this.add.image(w / 2, h / 2, 'garden-bg');
    this.bg.setDisplaySize(w, h).setDepth(0).setAlpha(0.95);

    /* depth 2 — path + glowing stations */
    this.g = this.add.graphics().setDepth(2);

    /* depth 4/5 — Lenny */
    this.glow = this.add.ellipse(w * 0.5, h * 0.78, 230, 230, 0xffd76a, 0.16).setDepth(4);
    this.lenny = this.add.image(w * 0.5, h * 0.78, 'lenny').setDisplaySize(150, 150).setDepth(5);
    this.tweens.add({ targets: this.glow, scaleX: 1.18, scaleY: 1.18, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.lenny, y: this.lenny.y - 10, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    /* depth 6 — parent corner */
    this.parentIcon = this.add.text(w - 24, 20, '⬤', {
      fontFamily: 'Arial', fontSize: '14px', color: '#3a3350',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    this.parentIcon.on('pointerdown', () => this.scene.start('parent-lens'));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private onTap(p: Phaser.Input.Pointer): void {
    const zoneId = this.garden.hitTest(p.x, p.y, this.scale.width, this.scale.height);
    if (!zoneId) return;
    const specs = gamesInZone(zoneId);
    if (specs.length > 0) GameFactory.start(this, specs[0]);
  }

  update(time: number): void {
    this.garden.draw(this.g, this.scale.width, this.scale.height, time * 0.001, this.progress);
  }

  private loadProgress(): GardenProgress {
    const base: GardenProgress = {
      unlocked: [...defaultProgress.unlocked],
      finished: { ...defaultProgress.finished },
      current: defaultProgress.current,
    };
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.unlocked) base.unlocked = s.unlocked;
        if (s && s.finished) base.finished = s.finished;
      }
    } catch { /* fresh */ }
    return base;
  }
}
