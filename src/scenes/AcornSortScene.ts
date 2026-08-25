/* ============================================================
 * AcornSortScene — the fourth playable game.
 * Lives in Thinking Forest (zone: thinking-forest).
 * Help the squirrel sort acorns from small to big.
 * A gentle logic / ordering game.
 * ============================================================ */

import Phaser from 'phaser';

interface Acorn {
  x: number;
  y: number;
  size: number;      /* 1..4, 1 = smallest */
  collected: boolean;
}

export class AcornSortScene extends Phaser.Scene {
  private acornG!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;

  private acorns: Acorn[] = [];
  private nextSize = 1;
  private round = 1;
  private readonly ROUNDS = 3;
  private done = false;

  constructor() { super('acorn-sort'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* forest background */
    this.add.rectangle(w / 2, h / 2, w, h, 0x14301e);

    this.acornG = this.add.graphics();

    this.msgText = this.add.text(w / 2, h * 0.08, 'הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.roundText = this.add.text(w / 2, h * 0.14, 'סִבּוּב 1 / 3', {
      fontFamily: 'Heebo, Arial', fontSize: '15px', color: '#ffd76a',
    }).setOrigin(0.5);

    this.spawnRound(w, h);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private spawnRound(w: number, h: number): void {
    this.acorns = [];
    this.nextSize = 1;
    /* 4 acorns, sizes 1..4, placed in shuffled spots */
    const spots = [
      { x: w * 0.25, y: h * 0.35 },
      { x: w * 0.75, y: h * 0.35 },
      { x: w * 0.25, y: h * 0.6 },
      { x: w * 0.75, y: h * 0.6 },
    ];
    /* shuffle spots */
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let s = 1; s <= 4; s++) {
      this.acorns.push({ x: spots[s - 1].x, y: spots[s - 1].y, size: s, collected: false });
    }
    this.roundText.setText('סִבּוּב ' + this.round + ' / ' + this.ROUNDS);
    this.msgText.setText('בּוֹא נְסַדֵּר מֵהַקָּטָן לַגָּדוֹל');
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;
    const a = this.acorns[idx];
    if (a.collected) return;

    if (a.size === this.nextSize) {
      a.collected = true;
      this.nextSize++;
      if (this.nextSize > 4) {
        if (this.round >= this.ROUNDS) {
          this.win();
        } else {
          this.round++;
          this.msgText.setText('וָאו! עוֹד סִבּוּב!');
          this.time.delayedCall(800, () => this.spawnRound(this.scale.width, this.scale.height));
        }
      } else {
        this.msgText.setText('כָּל הַכָּבוֹד! מַה הַבָּא?');
      }
    } else {
      this.msgText.setText('נַסֶּה אֶת הַקָּטָן יוֹתֵר');
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

  update(): void {
    const g = this.acornG;
    g.clear();

    /* basket at bottom */
    const w = this.scale.width, h = this.scale.height;
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
    /* body */
    g.fillStyle(0xc8873a, 1);
    g.fillEllipse(x, y + r * 0.2, r * 1.6, r * 1.8);
    /* cap */
    g.fillStyle(0x8d5a3b, 1);
    g.fillEllipse(x, y - r * 0.5, r * 1.7, r * 0.9);
    /* stem */
    g.lineStyle(2, 0x5a3a20, 1);
    g.lineBetween(x, y - r * 0.9, x, y - r * 1.1);
  }

  private win(): void {
    this.done = true;
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הַסְּנַאי מְאֻשָּׁר!');

    /* record progress for the garden */
    try {
      const raw = localStorage.getItem('lenny-garden');
      if (raw) {
        const prog = JSON.parse(raw);
        prog.finished = prog.finished || {};
        prog.finished['thinking-forest'] = (prog.finished['thinking-forest'] || 0) + 1;
        localStorage.setItem('lenny-garden', JSON.stringify(prog));
      }
    } catch { /* noop */ }

    this.time.delayedCall(1800, () => this.scene.start('portal'));
  }
}
