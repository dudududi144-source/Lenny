/* ============================================================
 * EmotionFaceScene — the seventh playable game.
 * Lives in Feelings Garden (zone: feelings-garden).
 * Help the turtle name its feeling. An emotion-recognition game.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';
import { GameSpec } from '../games/builder/GameSpec';

type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'calm';

export class EmotionFaceScene extends Phaser.Scene {
  private faceG!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private optionSpots: { x: number; y: number }[] = [];

  private current: Emotion = 'happy';
  private options: Emotion[] = [];
  private correctIdx = 0;
  private found = 0;
  private TARGET = 5;
  private spec: GameSpec | null = null;
  private done = false;
  private lock = false;

  /* cognitive core: DDA drives how many emotion options are shown */
  private dda = new AdaptiveDifficulty('feelings-garden');
  private wrongSinceLastCorrect = 0;
  private optionCount = 3;

  private readonly LABELS: Record<Emotion, string> = {
    happy: 'שָׂמֵחַ',
    sad: 'עָצוּב',
    angry: 'כּוֹעֵס',
    surprised: 'מוּפְתָּע',
    calm: 'רָגוּעַ',
  };
  private readonly COLORS: Record<Emotion, number> = {
    happy: 0xffd76a,
    sad: 0x4dc9ff,
    angry: 0xf2549a,
    surprised: 0xffa552,
    calm: 0x7dffb8,
  };

  constructor() { super('emotion-face'); }

  init(data: { spec?: GameSpec }): void {
    this.spec = (data && data.spec) ? data.spec : null;
  }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    this.found = 0;
    this.done = false;
    this.lock = false;
    this.wrongSinceLastCorrect = 0;
    this.TARGET = (this.spec && this.spec.params.rounds) ? this.spec.params.rounds : 5;
    /* DDA adapts the option count: options = 2 + floor(level * 3) (2..5) */
    this.optionCount = Math.min(5, Math.max(2, 2 + Math.floor(this.dda.level() * 3)));
    const w = this.scale.width, h = this.scale.height;

    /* feelings garden background */
    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x2e1a3a, 0.45);

    this.faceG = this.add.graphics();

    this.msgText = this.add.text(w / 2, h * 0.07, 'הַצָּב מַרְגִּישׁ מַשֶּׁהוּ. מַה הוּא מַרְגִּישׁ?', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.scoreText = this.add.text(w / 2, h * 0.92, '', {
      fontFamily: 'Heebo, Arial', fontSize: '15px', color: '#fff6ec',
    }).setOrigin(0.5);

    /* option buttons at the bottom, evenly spaced for the adaptive count */
    this.optionSpots = [];
    for (let i = 0; i < this.optionCount; i++) {
      this.optionSpots.push({ x: w * ((i + 1) / (this.optionCount + 1)), y: h * 0.78 });
    }

    this.newRound(w, h);
    this.updateScore();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private newRound(w: number, h: number): void {
    /* pick the current emotion + (optionCount - 1) distractors */
    const all: Emotion[] = ['happy', 'sad', 'angry', 'surprised', 'calm'];
    this.current = all[Math.floor(Math.random() * all.length)];
    const others = all.filter((e) => e !== this.current);
    const picked: Emotion[] = [this.current];
    while (picked.length < this.optionCount) {
      const idx = Math.floor(Math.random() * others.length);
      picked.push(others[idx]);
      others.splice(idx, 1);
    }
    /* shuffle */
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    this.options = picked;
    this.correctIdx = picked.indexOf(this.current);

    /* rebuild option texts */
    for (const t of this.optionTexts) t.destroy();
    this.optionTexts = [];
    for (let i = 0; i < this.optionCount; i++) {
      const spot = this.optionSpots[i];
      const t = this.add.text(spot.x, spot.y, this.LABELS[this.options[i]], {
        fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
        backgroundColor: '#7c4dff', padding: { x: 10, y: 8 },
      }).setOrigin(0.5);
      this.optionTexts.push(t);
    }
  }

  private updateScore(): void {
    this.scoreText.setText('הִכַּרְתָּ: ' + this.found + ' / ' + this.TARGET);
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done || this.lock) return;
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;

    if (idx === this.correctIdx) {
      this.found++;
      this.updateScore();
      /* one named emotion = one DDA round; score reflects its cleanliness */
      this.dda.outcome(true, Math.max(0.3, 1 - this.wrongSinceLastCorrect * 0.2));
      this.wrongSinceLastCorrect = 0;
      if (this.found >= this.TARGET) {
        this.win();
      } else {
        this.lock = true;
        this.msgText.setText('כֵּן! הַצָּב מַרְגִּישׁ ' + this.LABELS[this.current]);
        this.time.delayedCall(700, () => {
          this.lock = false;
          this.msgText.setText('מַה הַצָּב מַרְגִּישׁ עַכְשָׁו?');
          this.newRound(this.scale.width, this.scale.height);
        });
      }
    } else {
      this.wrongSinceLastCorrect++;
      this.dda.outcome(false);
      this.msgText.setText('נַסֶּה לְהַבִּיט בַּפָּנִים שׁוּב');
    }
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.optionTexts.length; i++) {
      const t = this.optionTexts[i];
      if (Math.abs(px - t.x) < 55 && Math.abs(py - t.y) < 30) return i;
    }
    return null;
  }

  update(): void {
    const g = this.faceG;
    g.clear();
    const w = this.scale.width, h = this.scale.height;
    this.drawTurtleFace(g, w / 2, h * 0.4, this.current);
  }

  private drawTurtleFace(g: Phaser.GameObjects.Graphics, x: number, y: number, emo: Emotion): void {
    const r = 60;
    /* shell ring */
    g.fillStyle(0x4caf6e, 0.9);
    g.fillCircle(x, y, r + 12);
    /* face */
    g.fillStyle(0x7dffb8, 1);
    g.fillCircle(x, y, r);

    /* eyes */
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x - 22, y - 15, 12);
    g.fillCircle(x + 22, y - 15, 12);
    g.fillStyle(0x0a0416, 1);
    if (emo === 'surprised') {
      g.fillCircle(x - 22, y - 15, 6);
      g.fillCircle(x + 22, y - 15, 6);
    } else {
      g.fillCircle(x - 22, y - 15, 4);
      g.fillCircle(x + 22, y - 15, 4);
    }

    /* eyebrows for angry/sad */
    if (emo === 'angry') {
      g.lineStyle(3, 0x0a0416, 1);
      g.lineBetween(x - 32, y - 30, x - 12, y - 24);
      g.lineBetween(x + 32, y - 30, x + 12, y - 24);
    } else if (emo === 'sad') {
      g.lineStyle(3, 0x0a0416, 1);
      g.lineBetween(x - 32, y - 24, x - 12, y - 30);
      g.lineBetween(x + 32, y - 24, x + 12, y - 30);
    }

    /* mouth by emotion */
    g.lineStyle(3, 0x0a0416, 1);
    if (emo === 'happy') {
      g.beginPath();
      g.arc(x, y + 15, 22, 0.2, Math.PI - 0.2, false);
      g.strokePath();
    } else if (emo === 'sad') {
      g.beginPath();
      g.arc(x, y + 42, 22, Math.PI + 0.3, -0.3, false);
      g.strokePath();
    } else if (emo === 'angry') {
      g.lineBetween(x - 18, y + 25, x + 18, y + 20);
    } else if (emo === 'surprised') {
      g.fillStyle(0x0a0416, 1);
      g.fillCircle(x, y + 22, 10);
    } else {
      g.lineBetween(x - 15, y + 22, x + 15, y + 22);
    }
  }

  private win(): void {
    this.done = true;
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הַצָּב מַרְגִּישׁ הַרְבֵּה יוֹתֵר טוֹב!');

        recordZoneFinish('feelings-garden');

    this.time.delayedCall(1800, () => this.scene.start('portal'));
  }
}
