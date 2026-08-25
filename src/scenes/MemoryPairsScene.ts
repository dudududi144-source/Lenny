/* ============================================================
 * MemoryPairsScene — the second playable game.
 * Lives in Memory Hill (zone: memory-hill). Warm, gentle, no
 * pressure. Helping the butterfly remember where its flowers are.
 * ============================================================ */

import Phaser from 'phaser';

interface Card {
  pairId: number;
  x: number;
  y: number;
  revealed: boolean;
  matched: boolean;
  icon: string;
}

export class MemoryPairsScene extends Phaser.Scene {
  private cards: Card[] = [];
  private cardGraphics!: Phaser.GameObjects.Graphics;
  private iconTexts: Phaser.GameObjects.Text[] = [];
  private msgText!: Phaser.GameObjects.Text;

  private firstPick: number | null = null;
  private lock = false;
  private foundPairs = 0;
  private totalPairs = 6;

  private readonly COLS = 4;
  private readonly ROWS = 3;
  private readonly CARD_W = 78;
  private readonly CARD_H = 92;
  private readonly GAP = 12;

  /* garden-themed pairs */
  private readonly ICONS = ['🌸', '🦋', '🐟', '🌳', '☀️', '💗'];

  constructor() { super('memory-pairs'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* soft background */
    this.add.rectangle(w / 2, h / 2, w, h, 0x1a1040);

    this.cardGraphics = this.add.graphics();

    this.msgText = this.add.text(w / 2, h * 0.08, 'הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.buildBoard(w, h);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private buildBoard(w: number, h: number): void {
    /* prepare 12 cards: 6 pairs, shuffled */
    const ids: number[] = [];
    for (let i = 0; i < this.totalPairs; i++) { ids.push(i, i); }
    this.shuffle(ids);

    const boardW = this.COLS * this.CARD_W + (this.COLS - 1) * this.GAP;
    const boardH = this.ROWS * this.CARD_H + (this.ROWS - 1) * this.GAP;
    const startX = (w - boardW) / 2;
    const startY = (h - boardH) / 2 + h * 0.04;

    this.cards = [];
    for (let i = 0; i < ids.length; i++) {
      const col = i % this.COLS;
      const row = Math.floor(i / this.COLS);
      const x = startX + col * (this.CARD_W + this.GAP) + this.CARD_W / 2;
      const y = startY + row * (this.CARD_H + this.GAP) + this.CARD_H / 2;
      this.cards.push({
        pairId: ids[i],
        x, y,
        revealed: false,
        matched: false,
        icon: this.ICONS[ids[i]],
      });
    }

    /* icon texts (hidden until revealed) */
    for (const c of this.cards) {
      const t = this.add.text(c.x, c.y, c.icon, {
        fontFamily: 'Arial', fontSize: '34px',
      }).setOrigin(0.5).setVisible(false);
      this.iconTexts.push(t);
    }

    this.render();
  }

  private shuffle(a: number[]): void {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.lock) return;
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;

    const card = this.cards[idx];
    if (card.revealed || card.matched) return;

    card.revealed = true;
    this.iconTexts[idx].setVisible(true);
    this.render();

    if (this.firstPick === null) {
      this.firstPick = idx;
    } else {
      const first = this.cards[this.firstPick];
      const second = card;
      const firstIdx = this.firstPick;
      this.firstPick = null;

      if (first.pairId === second.pairId) {
        first.matched = true;
        second.matched = true;
        this.foundPairs++;
        this.render();
        if (this.foundPairs >= this.totalPairs) this.win();
      } else {
        this.lock = true;
        this.time.delayedCall(700, () => {
          first.revealed = false;
          second.revealed = false;
          this.iconTexts[firstIdx].setVisible(false);
          this.iconTexts[idx].setVisible(false);
          this.render();
          this.lock = false;
        });
      }
    }
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (Math.abs(px - c.x) < this.CARD_W / 2 && Math.abs(py - c.y) < this.CARD_H / 2) {
        return i;
      }
    }
    return null;
  }

  private render(): void {
    const g = this.cardGraphics;
    g.clear();
    for (const c of this.cards) {
      const x = c.x - this.CARD_W / 2;
      const y = c.y - this.CARD_H / 2;
      if (c.matched) {
        g.fillStyle(0x7dffb8, 0.16);
        g.fillRoundedRect(x, y, this.CARD_W, this.CARD_H, 12);
        g.lineStyle(2, 0x7dffb8, 0.5);
        g.strokeRoundedRect(x, y, this.CARD_W, this.CARD_H, 12);
      } else if (c.revealed) {
        g.fillStyle(0x2a1a4a, 1);
        g.fillRoundedRect(x, y, this.CARD_W, this.CARD_H, 12);
        g.lineStyle(2, 0xffd76a, 0.8);
        g.strokeRoundedRect(x, y, this.CARD_W, this.CARD_H, 12);
      } else {
        g.fillStyle(0x7c4dff, 0.85);
        g.fillRoundedRect(x, y, this.CARD_W, this.CARD_H, 12);
        g.lineStyle(2, 0xfff6ec, 0.3);
        g.strokeRoundedRect(x, y, this.CARD_W, this.CARD_H, 12);
      }
    }
  }

  private win(): void {
    const w = this.scale.width, h = this.scale.height;
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הַפַּרְפַּר נִזְכַּר!');
    this.add.text(w / 2, h * 0.92, 'בּוֹא נַחֲזֹר לַגַּן', {
      fontFamily: 'Heebo, Arial', fontSize: '18px', color: '#ffd76a',
    }).setOrigin(0.5);

    /* record progress for the garden */
    try {
      const raw = localStorage.getItem('lenny-garden');
      if (raw) {
        const prog = JSON.parse(raw);
        prog.finished = prog.finished || {};
        prog.finished['memory-hill'] = (prog.finished['memory-hill'] || 0) + 1;
        localStorage.setItem('lenny-garden', JSON.stringify(prog));
      }
    } catch { /* noop */ }

    this.time.delayedCall(1600, () => this.scene.start('portal'));
  }
}
