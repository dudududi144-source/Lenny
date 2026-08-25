/* ============================================================
 * PortalScene — CLEAN REBUILD.
 *
 * The old PortalScene became patch-on-patch. This is a single,
 * coherent, layered scene with a clear depth order:
 *   depth 0  illustrated garden background (full strength)
 *   depth 2  garden path + glowing stations (GardenSystem)
 *   depth 4  Lenny glow halo
 *   depth 5  Lenny sprite
 *   depth 6  text / parent icon
 *
 * One state, one update, no layered cruft.
 * ============================================================ */

import Phaser from 'phaser';
import { GardenSystem, GardenProgress, defaultProgress } from '../portal/GardenSystem';
import { gamesInZone } from '../games/builder/GameRegistry';
import { GameFactory } from '../games/builder/GameFactory';
import { MemoryGarden } from '../games/core/MemoryGarden';

const STORE_KEY = 'lenny-garden';

export class PortalScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private g!: Phaser.GameObjects.Graphics;
  private lenny!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Ellipse;
  private greetText!: Phaser.GameObjects.Text;
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

    /* depth 0 — the illustrated world, full strength */
    this.bg = this.add.image(w / 2, h / 2, 'garden-bg');
    this.bg.setDisplaySize(w, h);
    this.bg.setDepth(0);

    /* depth 2 — path + glowing stations */
    this.g = this.add.graphics();
    this.g.setDepth(2);

    /* depth 4/5 — Lenny glow + sprite */
    this.glow = this.add.ellipse(w * 0.5, h * 0.78, 230, 230, 0xffd76a, 0.16);
    this.glow.setDepth(4);
    this.lenny = this.add.image(w * 0.5, h * 0.78, 'lenny');
    this.lenny.setDisplaySize(150, 150);
    this.lenny.setDepth(5);
    this.tweens.add({ targets: this.glow, scaleX: 1.18, scaleY: 1.18, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.lenny, y: this.lenny.y - 10, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    /* depth 6 — greeting from memory */
    this.greetText = this.add.text(w / 2, h * 0.09, '', {
      fontFamily: 'Heebo, Arial', fontSize: '18px', color: '#fff6ec',
      wordWrap: { width: w - 60 },
    }).setOrigin(0.5).setDepth(6);
    const lines = new MemoryGarden().greeting();
    if (lines.length > 0) this.greetText.setText(lines.join('\n'));

    /* depth 6 — parent corner */
    this.parentIcon = this.add.text(w - 24, 20, '⬤', {
      fontFamily: 'Arial', fontSize: '14px', color: '#3a3350',
    }).setOrigin(0.5).setDepth(6).setInteractive();
    this.parentIcon.on('pointerdown', () => this.scene.start('parent-lens'));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private onTap(p: Phaser.Input.Pointer): void {
    const w = this.scale.width, h = this.scale.height;
    const zoneId = this.garden.hitTest(p.x, p.y, w, h);
    if (!zoneId) return;
    const specs = gamesInZone(zoneId);
    if (specs.length > 0) GameFactory.start(this, specs[0]);
  }

  update(time: number): void {
    const t = time * 0.001;
    this.garden.draw(this.g, this.scale.width, this.scale.height, t, this.progress);
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
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.unlocked)) base.unlocked = saved.unlocked;
        if (saved && saved.finished) base.finished = saved.finished;
      }
    } catch { /* fresh start */ }
    return base;
  }
}
