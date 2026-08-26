/* ============================================================
 * AcornSortScene — a drag-and-drop sorting game.
 * Lives in Thinking Forest (zone: thinking-forest).
 *
 * v3 changes:
 *   - Now a REAL drag-and-drop game on top of DragDropSystem
 *     (was tap-to-select). Dragging exercises motor planning and
 *     makes the "small -> large" ordering tangible.
 *   - Drop targets show a faint size hint so the order is readable.
 *   - Failed drops snap back home with a gentle tween.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst } from '../games/fx/ParticleBurst';
import { DragDropSystem } from '../games/fx/DragDropSystem';

export class AcornSortScene extends Phaser.Scene {
  private acornG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  private drag!: DragDropSystem;
  private placedCount = 0;
  private round = 1;
  private readonly ROUNDS = 3;
  private done = false;

  constructor() { super('acorn-sort'); }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x14301e, 0.45);
    this.acornG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* progress ring top-right */
    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.9, width: w * 0.85 });
    this.dialogue.say([
      'הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים.',
      'גִּרְרוּ כָּל בְּלוּט לָעִגוּל שֶׁבַּגֹּדֶל שֶׁלּוֹ!',
    ]);

    this.spawnRound(w, h);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.done) return;
      this.dialogue.skip();
      this.drag.pointerDown(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.drag.pointerMove(p.x, p.y));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.drag.pointerUp(p.x, p.y));
  }

  private spawnRound(w: number, h: number): void {
    this.placedCount = 0;
    this.ring.setCounts(0, 4);

    this.drag = new DragDropSystem(this, {
      isValidDrop: (itemId: string, targetId: string) =>
        itemId.split('-')[1] === targetId.split('-')[1],
      onDrop: (itemId: string) => this.onCorrectDrop(itemId),
      onReject: () => this.dialogue.say(['נַסּוּ שׁוּב — אֵיזֶה עִגוּל מַתְאִים?']),
    });

    /* scatter the 4 acorns (shuffled) across the upper area */
    const xs = [0.18, 0.4, 0.62, 0.84];
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    for (let s = 1; s <= 4; s++) {
      this.drag.addItem('acorn-' + s, w * xs[s - 1], h * 0.28);
    }

    /* drop circles along the bottom, left -> right = small -> large */
    for (let n = 1; n <= 4; n++) {
      this.drag.addTarget('slot-' + n, w * (0.14 + (n - 1) * 0.24), h * 0.66, 44);
    }
  }

  private onCorrectDrop(itemId: string): void {
    this.placedCount++;
    const it = this.drag.items.find((i) => i.id === itemId);
    if (it) this.burst.emit(sparkleBurst(it.x, it.y));
    this.ring.setCounts(this.placedCount, 4);

    if (this.placedCount >= 4) {
      if (this.round >= this.ROUNDS) {
        this.win();
      } else {
        this.round++;
        this.dialogue.say(['וָאו! עוֹד סִבּוּב!']);
        this.time.delayedCall(800, () => this.spawnRound(this.scale.width, this.scale.height));
      }
    } else {
      this.dialogue.say(['כָּל הַכָּבוֹד! מַה הַבָּא?']);
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.burst.update(dt, 0, 0.99);
    this.ring.update(dt);
    this.dialogue.update(dt);

    const g = this.acornG;
    g.clear();

    /* drop circles with a faint size hint */
    for (const t of this.drag.targets) {
      const n = parseInt(t.id.split('-')[1], 10);
      const active = this.drag.activeDrag() !== null;
      g.lineStyle(2.5, t.occupied ? 0x7dffb8 : 0xfff6ec, t.occupied ? 0.8 : (active ? 0.6 : 0.35));
      g.strokeCircle(t.x, t.y, t.radius);
      if (!t.occupied) this.drawAcorn(g, t.x, t.y, n * 3, 0.22);
    }

    /* acorns (dragging one drawn a bit bigger for feedback) */
    for (const it of this.drag.items) {
      const size = parseInt(it.id.split('-')[1], 10);
      const dragging = this.drag.activeDrag() === it.id;
      this.drawAcorn(g, it.x, it.y, size * (dragging ? 7 : 6), 1);
    }
  }

  private drawAcorn(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha: number): void {
    g.fillStyle(0xc8873a, alpha);
    g.fillEllipse(x, y + r * 0.2, r * 1.6, r * 1.8);
    g.fillStyle(0x8d5a3b, alpha);
    g.fillEllipse(x, y - r * 0.5, r * 1.7, r * 0.9);
    g.lineStyle(2, 0x5a3a20, alpha);
    g.lineBetween(x, y - r * 0.9, x, y - r * 1.1);
  }

  private win(): void {
    this.done = true;
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַסְּנַאי מְאֻשָּׁר!']);

    recordZoneFinish('thinking-forest');

    this.time.delayedCall(2600, () => this.scene.start('portal'));
  }
}
