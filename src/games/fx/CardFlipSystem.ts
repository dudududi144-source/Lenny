/* ============================================================
 * CardFlipSystem — a reusable card grid with flip animation.
 *
 * Why this exists: memory/matching games all need a grid of
 * cards that flip. Instead of re-implementing flip logic and
 * grid layout in each scene, we build ONE solid system.
 *
 * Design notes (the exemplar part):
 *  - Layout is data-driven: rows x cols, auto-sized to bounds.
 *  - Flip is a smooth scaleX tween (fake 3D), no real 3D needed.
 *  - State machine per card: faceDown -> flipping -> faceUp.
 *  - The scene only handles WHAT is on the cards, not HOW they flip.
 * ============================================================ */

import Phaser from 'phaser';

export type CardState = 'down' | 'flipping' | 'up';

export interface CardSlot {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  state: CardState;
}

export interface CardGridConfig {
  rows: number;
  cols: number;
  /* bounding area for the whole grid */
  areaX: number;
  areaY: number;
  areaW: number;
  areaH: number;
  gap?: number;
  radius?: number;
}

export class CardFlipSystem {
  private scene: Phaser.Scene;
  private cfg: Required<CardGridConfig>;
  slots: CardSlot[] = [];
  private backs: Phaser.GameObjects.Graphics;
  private flipTweens: Map<number, Phaser.Tweens.Tween> = new Map();

  constructor(scene: Phaser.Scene, cfg: CardGridConfig) {
    this.scene = scene;
    this.cfg = {
      rows: cfg.rows,
      cols: cfg.cols,
      areaX: cfg.areaX,
      areaY: cfg.areaY,
      areaW: cfg.areaW,
      areaH: cfg.areaH,
      gap: cfg.gap ?? 12,
      radius: cfg.radius ?? 12,
    };
    this.backs = scene.add.graphics();
    this.buildSlots();
  }

  /** Compute slot positions and sizes from the config. */
  private buildSlots(): void {
    const c = this.cfg;
    const cellW = (c.areaW - (c.cols - 1) * c.gap) / c.cols;
    const cellH = (c.areaH - (c.rows - 1) * c.gap) / c.rows;
    let idx = 0;
    for (let r = 0; r < c.rows; r++) {
      for (let col = 0; col < c.cols; col++) {
        const x = c.areaX + col * (cellW + c.gap) + cellW / 2;
        const y = c.areaY + r * (cellH + c.gap) + cellH / 2;
        this.slots.push({ index: idx, x, y, w: cellW, h: cellH, state: 'down' });
        idx++;
      }
    }
  }

  /** Draw all face-down card backs. Call once from scene create/update. */
  drawBacks(color: number = 0x7c4dff): void {
    const g = this.backs;
    g.clear();
    for (const s of this.slots) {
      if (s.state === 'down') {
        g.fillStyle(color, 0.9);
        g.fillRoundedRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, this.cfg.radius);
        g.lineStyle(2, 0xfff6ec, 0.3);
        g.strokeRoundedRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, this.cfg.radius);
      }
    }
  }

  /** Flip a card to face-up. Fires the provided callback at the midpoint. */
  flipUp(index: number, onMid: () => void): void {
    const s = this.slots[index];
    if (!s || s.state !== 'down') return;
    s.state = 'flipping';
    const proxy = { sx: 1 };
    const tween = this.scene.tweens.add({
      targets: proxy,
      sx: 0,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        onMid();
        this.scene.tweens.add({
          targets: proxy,
          sx: 1,
          duration: 160,
          ease: 'Quad.easeOut',
          onComplete: () => { s.state = 'up'; this.flipTweens.delete(index); },
        });
      },
    });
    this.flipTweens.set(index, tween);
  }

  /** Flip a card back face-down (e.g. a wrong pair). */
  flipDown(index: number, onMid: () => void): void {
    const s = this.slots[index];
    if (!s || s.state !== 'up') return;
    s.state = 'flipping';
    const proxy = { sx: 1 };
    this.scene.tweens.add({
      targets: proxy,
      sx: 0,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        onMid();
        this.scene.tweens.add({
          targets: proxy,
          sx: 1,
          duration: 160,
          ease: 'Quad.easeOut',
          onComplete: () => { s.state = 'down'; },
        });
      },
    });
  }

  /** Which slot is under a pointer, or null. */
  hitTest(px: number, py: number): number | null {
    for (const s of this.slots) {
      if (Math.abs(px - s.x) < s.w / 2 && Math.abs(py - s.y) < s.h / 2) {
        return s.index;
      }
    }
    return null;
  }

  /** Clean up. */
  destroy(): void {
    this.backs.destroy();
    for (const tw of this.flipTweens.values()) tw.stop();
    this.flipTweens.clear();
  }
}
