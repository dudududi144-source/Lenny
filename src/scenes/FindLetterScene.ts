/* ============================================================
 * FindLetterScene — the sixth playable game.
 * Lives in Words Valley (zone: words-valley).
 * Help the rabbit find the right letter. A letter-recognition game.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';
import { LearningSignals } from '../games/core/LearningSignals';
import { SkillBridge } from '../games/core/SkillBridge';
import { GameSpec } from '../games/builder/GameSpec';

export class FindLetterScene extends Phaser.Scene {
  private msgText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private letterTexts: Phaser.GameObjects.Text[] = [];
  private letterSpots: { x: number; y: number }[] = [];

  private targetIdx = 0;
  private found = 0;
  private TARGET = 5;
  private spec: GameSpec | null = null;
  private done = false;
  private lock = false;
  private targetLetter = '';

  /* cognitive core: DDA drives distractor similarity */
  private dda = new AdaptiveDifficulty('words-valley');
  private signals = new LearningSignals();
  /* shares the scene's signals: acquisition fires only when a skill
     crosses the mastery threshold (3 corrects), never on 1 success */
  private skillBridge = new SkillBridge(this.signals);
  private wrongSinceLastFind = 0;

  /* letters whose SkillGraph acquisition is wired through the bridge;
     everything else keeps the aggregate skill id */
  private readonly GLYPH_SKILL: Record<string, string> = {
    'א': 'letter.alef',
    'ב': 'letter.bet',
  };

  /* visually confusable Hebrew letter pairs (task-spec taxonomy);
   * higher DDA levels inject the target's partner as a distractor */
  private readonly CONFUSABLES: Record<string, string> = {
    'ב': 'כ', 'כ': 'ב',
    'מ': 'ס', 'ס': 'מ',
    'ד': 'ר', 'ר': 'ד',
  };

  /* basic Hebrew letters, no niqqud, for easy recognition */
  private readonly LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];

  private roundStart = 0;

  constructor() { super('find-letter'); }

  init(data: { spec?: GameSpec }): void {
    this.spec = (data && data.spec) ? data.spec : null;
  }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
    this.load.image('rabbit', 'art/rabbit.png');
  }

  create(): void {
    this.found = 0;
    this.done = false;
    this.lock = false;
    this.wrongSinceLastFind = 0;
    this.roundStart = this.time.now;
    this.TARGET = (this.spec && this.spec.params.rounds) ? this.spec.params.rounds : 5;
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

    /* pick 6 distinct letters, one is the target.
       DDA level raises distractor similarity: from level 0.5 up, the
       target's confusable partner (ב/כ, מ/ס, ד/ר) is planted among them. */
    const pool = [...this.LETTERS];
    const chosen: string[] = [];
    const level = this.dda.level();
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    this.targetIdx = Math.floor(Math.random() * 6);
    const target = chosen[this.targetIdx];
    this.targetLetter = target;
    const partner = this.CONFUSABLES[target];
    if (level >= 0.5 && partner && !chosen.includes(partner)) {
      /* replace one non-target slot with the confusable partner */
      const slot = chosen.findIndex((c, i) => i !== this.targetIdx);
      chosen[slot] = partner;
    }

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
    if (this.done || this.lock) return;
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;

    if (idx === this.targetIdx) {
      this.found++;
      this.updateScore();
      /* one found letter = one DDA round; score reflects its cleanliness */
      this.dda.outcome(true, Math.max(0.3, 1 - this.wrongSinceLastFind * 0.2));
      /* exactly ONE attempt per find: mapped letters (א/ב) log under
         their own skill id so mastery counts per letter; everything
         else logs under the aggregate id. 3 corrects (across
         sessions) fire mastery -> SkillBridge acquires the node. */
      this.signals.attempt(this.skillIdFor(this.targetLetter), true);
      this.wrongSinceLastFind = 0;
      if (this.found >= this.TARGET) {
        this.win();
      } else {
        this.lock = true;
        this.msgText.setText('וָאו! מָצָאתָ אוֹתָהּ!');
        this.time.delayedCall(500, () => { this.lock = false; this.newRound(this.scale.width, this.scale.height); });
      }
    } else {
      this.wrongSinceLastFind++;
      /* a wrong tap is NOT a round loss (the round is one found
         letter, judged in the correct branch above). It is a failed
         recognition OF THE TARGET letter: it feeds LearningSignals
         and the hint ladder, and counts against that letter's
         accuracy -- but never resets its mastery count. */
      this.signals.attempt(this.skillIdFor(this.targetLetter), false);
      this.signals.errorKind(
        'language.letter-recognition',
        this.getLetterErrorKind(this.targetLetter, this.letterTexts[idx].text),
      );
      /* visible, escalating help (gentle -> clear -> show) instead of
         a silent difficulty drop -- same pattern as MemoryPairs */
      const hint = this.dda.suggestHint(this.wrongSinceLastFind);
      this.msgText.setText(
        hint === 'show'
          ? 'הַשְׁוֵה כָּל אוֹת לְמַטָּה עִם הָאוֹת שֶׁלְּמַעְלָה'
          : hint === 'clear'
            ? 'הִסְתַּכֵּל לְאָט עַל כָּל הָאוֹתִיּוֹת'
            : 'כִּמְעַט! נַסֶּה שׁוּב',
      );
    }
  }

  /** Map a tapped letter to a specific confusion category. */
  private getLetterErrorKind(target: string, tapped: string): string {
    void target;
    const confusables: Record<string, string> = {
      'ב': 'confused-bet-kaf', 'כ': 'confused-bet-kaf',
      'מ': 'confused-mem-samech', 'ס': 'confused-mem-samech',
      'ד': 'confused-dalet-resh', 'ר': 'confused-dalet-resh',
    };
    return confusables[tapped] || 'wrong-letter';
  }

  /** The LearningSignals skill id for the target letter of a round. */
  private skillIdFor(letter: string): string {
    return this.GLYPH_SKILL[letter] ?? 'language.letter-recognition';
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

    const secs = (this.time.now - this.roundStart) / 1000;
    /* real elapsed seconds feed the PlayerModel tempo signal */
    recordZoneFinish('words-valley', secs);

    /* NOTE: no acquisition here on purpose. Skill nodes are acquired
       ONLY through the mastery threshold (3 corrects per skill,
       wired via SkillBridge in this scene's constructor). The old
       code acquired a frontier node after every win and called
       onSkillMastered for any letter seen ONCE -- both let ParentLens
       progress grow with no mastery evidence behind it. */

    this.time.delayedCall(1800, () => this.scene.start('portal'));
  }
}
