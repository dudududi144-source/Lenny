/* ============================================================
 * AcornSortScene — upgraded to use the reusable fx library.
 * Lives in Thinking Forest (zone: thinking-forest).
 *
 * v2 changes:
 *   - ProgressRing shows acorns sorted this round
 *   - DialogueBox gives Lenny a warm voice
 *   - ParticleBurst celebrates each correct acorn
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst } from '../games/fx/ParticleBurst';

interface Acorn {
  x: number;
  y: number;
  size: number;
  collected: boolean;
}

export class AcornSortScene extends Phaser.Scene {
  private acornG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  private acorns: Acorn[] = [];
  private nextSize = 1;
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
    this.ring.setCounts(0, 4);

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.9, width: w * 0.85 });
    this.dialogue.say([
      'הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים.',
      'בּוֹא נְסַדֵּר מֵהַקָּטָן לַגָּדוֹל!',
    ]);

    this.spawnRound(w, h);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private spawnRound(w: number, h: number): void {
    this.acorns = [];
    this.nextSize = 1;
    this.ring.setCounts(0, 4);
    const spots = [
      { x: w * 0.25, y: h * 0.35 },
      { x: w * 0.75, y: h * 0.35 },
      { x: w * 0.25, y: h * 0.6 },
      { x: w * 0.75, y: h * 0.6 },
    ];
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let s = 1; s <= 4; s++) {
      this.acorns.push({ x: spots[s - 1].x, y: spots[s - 1].y, size: s, collected: false });
    }
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    this.dialogue.skip();
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;
    const a = this.acorns[idx];
    if (a.collected) return;

    if (a.size === this.nextSize) {
      a.collected = true;
      this.nextSize++;
      this.ring.setCounts(this.nextSize - 1, 4);
      this.burst.emit(sparkleBurst(a.x, a.y));
      if (this.nextSize > 4) {
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
    } else {
      this.dialogue.say(['נַסּוּ אֶת הַקָּטָן יוֹתֵר']);
    }
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.acorns.length; i++) {
      const a = this.acorns[i];
      if (a.collected) continue;
      if (Math.hypot(px - a.x, py - a.y) < 36) return i;
    }
    return null;
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.burst.update(dt, 0, 0.99);
    this.ring.update(dt);
    this.dialogue.update(dt);

    const g = this.acornG;
    g.clear();
    const w = this.scale.width, h = this.scale.height;

    /* basket */
    g.fillStyle(0x8d5a3b, 0.9);
    g.fillRoundedRect(w / 2 - 60, h * 0.82, 120, 44, 10);
    g.lineStyle(2, 0xfff6ec, 0.3);
    g.strokeRoundedRect(w / 2 - 60, h * 0.82, 120, 44, 10);

    /* collected acorns in basket */
    let placed = 0;
    for (const a of this.acorns) {
      if (a.collected) {
        const bx = w / 2 - 40 + placed * 26;
        const by = h * 0.82 + 22;
        this.drawAcorn(g, bx, by, a.size * 3);
        placed++;
      }
    }

    /* remaining acorns */
    for (const a of this.acorns) {
      if (!a.collected) {
        this.drawAcorn(g, a.x, a.y, a.size * 6);
      }
    }
  }

  private drawAcorn(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    g.fillStyle(0xc8873a, 1);
    g.fillEllipse(x, y + r * 0.2, r * 1.6, r * 1.8);
    g.fillStyle(0x8d5a3b, 1);
    g.fillEllipse(x, y - r * 0.5, r * 1.7, r * 0.9);
    g.lineStyle(2, 0x5a3a20, 1);
    g.lineBetween(x, y - r * 0.9, x, y - r * 1.1);
  }

  private win(): void {
    this.done = true;
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַסְּנַאי מְאֻשָּׁר!']);

        recordZoneFinish('thinking-forest');

    this.time.delayedCall(2600, () => this.scene.start('portal'));
  }
}
