/* ============================================================
 * SubliminalSystem — positive affirmations below awareness
 * Flashes a Hebrew affirmation for ~90ms at random intervals
 * (12-17s) in a random screen region. The conscious mind does
 * not register it; the intent is gentle emotional priming.
 * Rendered as a Phaser Text owned by the scene.
 * ============================================================ */

import Phaser from 'phaser';
import { SUBLIMINAL } from '../data/portalConfig';

export class SubliminalSystem {
  private nextAt: number;      /* ms timestamp of next flash */
  private hideAt: number = 0;  /* ms timestamp to hide current */
  private shown: string[] = [];

  constructor(private text: Phaser.GameObjects.Text, private now: () => number) {
    this.text.setVisible(false);
    this.text.setAlpha(0.85);
    this.nextAt = this.now() + this.randomGap();
  }

  /** Call every frame. */
  update(): void {
    const t = this.now();

    if (this.text.visible && t >= this.hideAt) {
      this.text.setVisible(false);
      this.nextAt = t + this.randomGap();
      return;
    }

    if (!this.text.visible && t >= this.nextAt) {
      this.flash(t);
    }
  }

  private flash(t: number): void {
    const msg = this.pickMessage();
    const w = this.text.scene.scale.width;
    const h = this.text.scene.scale.height;

    /* place in a calm margin zone (never dead center) */
    const zone = Math.floor(Math.random() * 4);
    let x: number, y: number;
    if (zone === 0) { x = w * (0.15 + Math.random() * 0.2); y = h * 0.12; }
    else if (zone === 1) { x = w * (0.65 + Math.random() * 0.2); y = h * 0.14; }
    else if (zone === 2) { x = w * 0.2; y = h * (0.82 + Math.random() * 0.08); }
    else { x = w * 0.8; y = h * (0.84 + Math.random() * 0.06); }

    this.text.setText(msg);
    this.text.setPosition(x, y);
    this.text.setVisible(true);
    this.hideAt = t + SUBLIMINAL.flashMs;
  }

  private pickMessage(): string {
    const pool = SUBLIMINAL.messages;
    /* avoid immediate repeats */
    let candidates = pool.filter((m) => !this.shown.includes(m));
    if (candidates.length === 0) {
      this.shown = [];
      candidates = pool;
    }
    const msg = candidates[Math.floor(Math.random() * candidates.length)];
    this.shown.push(msg);
    if (this.shown.length > 3) this.shown.shift();
    return msg;
  }

  private randomGap(): number {
    const { minGapMs, maxGapMs } = SUBLIMINAL;
    return minGapMs + Math.random() * (maxGapMs - minGapMs);
  }
}
