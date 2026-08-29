/* ============================================================
 * DialogueBox — a reusable speech bubble for Lenny.
 *
 * Why this exists: many games need Lenny to give instructions,
 * encouragement, or story beats. Instead of each scene drawing
 * its own text bubble, we build ONE warm, consistent voice box.
 *
 * Design notes (the exemplar part):
 *  - Typewriter reveal: text appears letter by letter (calm pace).
 *  - Auto-dismiss or tap-to-continue, configurable.
 *  - Queue support: pass several lines, they play in order.
 *  - Fires a callback when the whole queue finishes.
 * ============================================================ */

import Phaser from 'phaser';

export interface DialogueConfig {
  x: number;
  y: number;
  width: number;
  /* seconds per character for the typewriter effect */
  charDelay?: number;
  /* seconds a line stays fully visible before auto-advancing */
  holdTime?: number;
}

export class DialogueBox {
  private scene: Phaser.Scene;
  private cfg: Required<DialogueConfig>;
  private bubble: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private queue: string[] = [];
  private shownChars = 0;
  private current = '';
  private charTimer: number = 0;
  private holdTimer: number = 0;
  private phase: 'idle' | 'typing' | 'holding' = 'idle';
  private onFinish: (() => void) | null = null;

  constructor(scene: Phaser.Scene, cfg: DialogueConfig) {
    this.scene = scene;
    this.cfg = {
      x: cfg.x,
      y: cfg.y,
      width: cfg.width,
      charDelay: cfg.charDelay ?? 0.045,
      holdTime: cfg.holdTime ?? 1.6,
    };
    this.bubble = scene.add.graphics();
    this.text = scene.add.text(this.cfg.x, this.cfg.y, '', {
      fontFamily: 'Heebo, Arial',
      fontSize: '17px',
      color: '#fff6ec',
      align: 'center',
      wordWrap: { width: this.cfg.width - 28 },
    }).setOrigin(0.5);
    this.bubble.setVisible(false);
    this.text.setVisible(false);
  }

  /** Speak one or more lines. Fires cb when all lines are done. */
  say(lines: string | string[], cb?: () => void): void {
    this.queue = Array.isArray(lines) ? [...lines] : [lines];
    this.onFinish = cb ?? null;
    this.nextLine();
  }

  private nextLine(): void {
    const line = this.queue.shift();
    if (line === undefined) {
      this.bubble.setVisible(false);
      this.text.setVisible(false);
      this.phase = 'idle';
      if (this.onFinish) this.onFinish();
      return;
    }
    this.current = line;
    this.shownChars = 0;
    this.charTimer = 0;
    this.holdTimer = 0;
    this.phase = 'typing';
    this.bubble.setVisible(true);
    this.text.setVisible(true);
  }

  /** Call every frame from the scene update loop. */
  update(dt: number): void {
    if (this.phase === 'idle') return;

    if (this.phase === 'typing') {
      this.charTimer += dt;
      const total = this.visibleLength(this.current);
      while (this.charTimer >= this.cfg.charDelay && this.shownChars < total) {
        this.charTimer -= this.cfg.charDelay;
        this.shownChars++;
      }
      this.text.setText(this.safeSlice(this.current, this.shownChars));
      this.drawBubble();
      if (this.shownChars >= total) this.phase = 'holding';
    } else if (this.phase === 'holding') {
      this.holdTimer += dt;
      if (this.holdTimer >= this.cfg.holdTime) this.nextLine();
    }
  }

  /** Skip the current line (tap to continue). */
  skip(): void {
    if (this.phase === 'typing') {
      this.shownChars = this.visibleLength(this.current);
      this.text.setText(this.current);
      this.phase = 'holding';
      this.holdTimer = 0;
    } else if (this.phase === 'holding') {
      this.nextLine();
    }
  }

  /**
   * Slice by visible characters, keeping base letters + combining
   * marks (Hebrew niqqud) together. A naive slice(0, n) can cut
   * between a base letter and its niqqud, making marks flicker or
   * float over the wrong letter mid-typewriter.
   */
  private safeSlice(str: string, charCount: number): string {
    if (charCount <= 0) return '';
    /* count visible characters (base chars, not combining marks) */
    let visible = 0;
    let cutIndex = 0;
    for (let i = 0; i < str.length && visible < charCount; i++) {
      if (this.isCombiningMark(str.charCodeAt(i))) continue; /* skip niqqud */
      visible++;
      cutIndex = i + 1;
    }
    /* include any trailing combining marks after the cut */
    while (cutIndex < str.length && this.isCombiningMark(str.charCodeAt(cutIndex))) {
      cutIndex++;
    }
    return str.slice(0, cutIndex);
  }

  /** Number of visible (non-combining-mark) characters. */
  private visibleLength(str: string): number {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (this.isCombiningMark(str.charCodeAt(i))) continue;
      count++;
    }
    return count;
  }

  /** Hebrew niqqud (U+05B0..U+05C7) + general combining marks. */
  private isCombiningMark(code: number): boolean {
    return (code >= 0x05b0 && code <= 0x05c7) || (code >= 0x0300 && code <= 0x036f);
  }

  private drawBubble(): void {
    const g = this.bubble;
    g.clear();
    const h = this.text.height + 24;
    const w = this.cfg.width;
    g.fillStyle(0x2a1a4a, 0.85);
    g.fillRoundedRect(this.cfg.x - w / 2, this.cfg.y - h / 2, w, h, 14);
    g.lineStyle(2, 0xffd76a, 0.4);
    g.strokeRoundedRect(this.cfg.x - w / 2, this.cfg.y - h / 2, w, h, 14);
  }

  /** Clean up. */
  destroy(): void {
    this.bubble.destroy();
    this.text.destroy();
  }
}
