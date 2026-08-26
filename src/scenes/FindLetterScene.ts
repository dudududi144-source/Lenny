/* ============================================================
 * FindLetterScene — the sixth playable game.
 * Lives in Words Valley (zone: words-valley).
 * Help the rabbit find the right letter. A letter-recognition game.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { SkillGraph, LITERACY_GRAPH } from '../games/core/SkillGraph';

export class FindLetterScene extends Phaser.Scene {
  private msgText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private letterTexts: Phaser.GameObjects.Text[] = [];
  private letterSpots: { x: number; y: number }[] = [];

  private targetIdx = 0;
  private found = 0;
  private readonly TARGET = 5;
  private done = false;

  /* basic Hebrew letters, no niqqud, for easy recognition */
  private readonly LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];

  constructor() { super('find-letter'); }

  preload(): void {
    this.load.image('garden-bg', 'art/garden-bg.png');
    this.load.image('rabbit', 'art/rabbit.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* illustrated rabbit companion */
    const rb = this.add.image(w * 0.85, h * 0.1, 'rabbit');
    rb.setDisplaySize(70, 70);
    this.tweens.add({ targets: rb, y: rb.y - 6, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    /* valley background */
    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x2a1a3e, 0.45);

    this.msgText = this.add.text(w / 2, h * 0.07, 'הָאַרְנֶבֶת אִבְּדָה אֶת הָאוֹתִיּוֹת', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.targetText = this.add.text(w / 2, h * 0.16, '', {
      fontFamily: 'Heebo, Arial', fontSize: '18px', color: '#ffd76a',
    }).setOrigin(0.5);

    this.scoreText = this.add.text(w / 2, h * 0.92, '', {
      fontFamily: 'Heebo, Arial', fontSize: '15px', color: '#fff6ec',
    }).setOrigin(0.5);

    /* letter spots in a loose grid */
    this.letterSpots = [];
    const cols = 3, rows = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.letterSpots.push({
          x: w * (0.25 + c * 0.25),
          y: h * (0.42 + r * 0.22),
        });
      }
    }

    this.newRound(w, h);
    this.updateScore();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private newRound(w: number, h: number): void {
    /* clear old letters */
    for (const t of this.letterTexts) t.destroy();
    this.letterTexts = [];

    /* pick 6 distinct letters, one is the target */
    const pool = [...this.LETTERS];
    const chosen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    this.targetIdx = Math.floor(Math.random() * 6);
    const target = chosen[this.targetIdx];

    this.targetText.setText('אֵיפֹה הָאוֹת ' + target + '?');

    for (let i = 0; i < 6; i++) {
      const spot = this.letterSpots[i];
      const t = this.add.text(spot.x, spot.y, chosen[i], {
        fontFamily: 'Heebo, Arial', fontSize: '40px', color: '#fff6ec',
        backgroundColor: '#7c4dff', padding: { x: 14, y: 8 },
      }).setOrigin(0.5);
      this.letterTexts.push(t);
    }
  }

  private updateScore(): void {
    this.scoreText.setText('מָצָאתָ: ' + this.found + ' / ' + this.TARGET);
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;

    if (idx === this.targetIdx) {
      this.found++;
      this.updateScore();
      if (this.found >= this.TARGET) {
        this.win();
      } else {
        this.msgText.setText('וָאו! מָצָאתָ אוֹתָהּ!');
        this.time.delayedCall(500, () => this.newRound(this.scale.width, this.scale.height));
      }
    } else {
      this.msgText.setText('כִּמְעַט! נַסֶּה שׁוּב');
    }
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.letterTexts.length; i++) {
      const t = this.letterTexts[i];
      if (Math.abs(px - t.x) < 40 && Math.abs(py - t.y) < 40) return i;
    }
    return null;
  }

  private win(): void {
    this.done = true;
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הָאַרְנֶבֶת מָצְאָה אֶת הָאוֹתִיּוֹת!');

        recordZoneFinish('words-valley');

    /* advance the literacy path so the ParentLens skill progress grows */
    try {
      const skills = new SkillGraph(LITERACY_GRAPH);
      const next = skills.frontier();
      if (next.length > 0) skills.acquire(next[0]);
    } catch { /* noop */ }

    this.time.delayedCall(1800, () => this.scene.start('portal'));
  }
}
