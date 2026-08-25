/* ============================================================
 * AffirmationSystem — VISIBLE encouragement messages.
 * Per docs/ETHICS.md section 5: every message is shown clearly
 * to the child for a few seconds. Nothing is hidden, flashed
 * below awareness, or delivered without the child being able to
 * see it. This replaces the previous subliminal approach.
 * ============================================================ */

import Phaser from 'phaser';
import { AFFIRMATIONS } from '../data/portalConfig';

export class AffirmationSystem {
  private nextAt: number;      /* ms timestamp of next message */
  private hideAt: number = 0;  /* ms timestamp to fade out */
  private shown: string[] = [];
  private visible = false;

  constructor(private text: Phaser.GameObjects.Text, private now: () => number) {
    this.text.setVisible(false);
    this.text.setAlpha(0);
    this.nextAt = this.now() + this.randomGap();
  }

  /** Call every frame. */
  update(): void {
    const t = this.now();

    /* fade out when the visible window ends */
    if (this.visible && t >= this.hideAt) {
      this.visible = false;
      this.text.scene.tweens.add({
        targets: this.text,
        alpha: 0,
        duration: 600,
        onComplete: () => this.text.setVisible(false),
      });
      this.nextAt = t + this.randomGap();
      return;
    }

    /* show the next message clearly */
    if (!this.visible && t >= this.nextAt) {
      this.show(t);
    }
  }

  private show(t: number): void {
    const msg = this.pickMessage();
    const w = this.text.scene.scale.width;
    const h = this.text.scene.scale.height;

    /* place where the child can actually see it (lower area, centered) */
    this.text.setText(msg);
    this.text.setPosition(w / 2, h * 0.72);
    this.text.setVisible(true);
    this.text.scene.tweens.add({
      targets: this.text,
      alpha: 1,
      duration: 500,
    });

    this.visible = true;
    this.hideAt = t + AFFIRMATIONS.displayMs;
  }

  private pickMessage(): string {
    const pool = AFFIRMATIONS.messages;
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
    const { minGapMs, maxGapMs } = AFFIRMATIONS;
    return minGapMs + Math.random() * (maxGapMs - minGapMs);
  }
}
