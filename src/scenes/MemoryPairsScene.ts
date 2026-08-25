/* ============================================================
 * MemoryPairsScene — upgraded to use the reusable fx library.
 * Lives in Memory Hill (zone: memory-hill).
 *
 * v2 changes:
 *   - CardFlipSystem handles grid layout + smooth flip tweens
 *   - ProgressRing shows pairs found so far
 *   - DialogueBox gives Lenny a warm voice
 *   - ParticleBurst celebrates each matched pair
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';
import { PlayerModel } from '../games/core/PlayerModel';
import { LearningSignals } from '../games/core/LearningSignals';
import { CardFlipSystem } from '../games/fx/CardFlipSystem';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, bloomBurst } from '../games/fx/ParticleBurst';

interface Card {
  pairId: number;
  icon: string;
  matched: boolean;
}

export class MemoryPairsScene extends Phaser.Scene {
  /* cognitive core engines */
  private dda = new AdaptiveDifficulty('memory-hill');
  private pm = new PlayerModel();
  private signals = new LearningSignals();
  private roundStart = 0;
  private mistakes = 0;

  private grid!: CardFlipSystem;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  private cardG!: Phaser.GameObjects.Graphics;
  private iconTexts: Map<number, Phaser.GameObjects.Text> = new Map();
  private cards: Card[] = [];
  private firstPick: number | null = null;
  private lock = false;
  private foundPairs = 0;
  private readonly TOTAL_PAIRS = 6;
  private done = false;

  private readonly ICONS = ['🌸', '🦋', '🐟', '🌳', '☀️', '💗'];

  constructor() { super('memory-pairs'); }

  preload(): void {
    this.load.image('butterfly', 'art/butterfly.png');
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const bg = this.add.image(w / 2, h / 2, 'garden-bg');
    bg.setDisplaySize(w, h);
    bg.setAlpha(0.6);

    /* butterfly companion top-right */
    const bf = this.add.image(w * 0.85, h * 0.12, 'butterfly');
    bf.setDisplaySize(70, 70);
    this.tweens.add({ targets: bf, y: bf.y - 6, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(w / 2, h / 2, w, h, 0x1a1040, 0.45);
    this.cardG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* card grid: 4 cols x 3 rows in the middle area */
    this.grid = new CardFlipSystem(this, {
      rows: 3,
      cols: 4,
      areaX: w * 0.08,
      areaY: h * 0.22,
      areaW: w * 0.84,
      areaH: h * 0.5,
      gap: 10,
    });

    /* progress ring top-right */
    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });
    this.ring.setCounts(0, this.TOTAL_PAIRS);

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.88, width: w * 0.85 });
    this.dialogue.say([
      'הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ.',
      'בּוֹא נִמְצָא אֶת הַזּוּגוֹת!',
    ]);

    /* build shuffled card data */
    const ids: number[] = [];
    for (let i = 0; i < this.TOTAL_PAIRS; i++) ids.push(i, i);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this.cards = ids.map((pairId) => ({ pairId, icon: this.ICONS[pairId], matched: false }));

    this.grid.drawBacks();

    this.roundStart = this.time.now;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.lock || this.done) return;
    this.dialogue.skip();
    const idx = this.grid.hitTest(p.x, p.y);
    if (idx === null) return;
    const card = this.cards[idx];
    if (card.matched) return;

    this.grid.flipUp(idx, () => this.showIcon(idx));

    if (this.firstPick === null) {
      this.firstPick = idx;
    } else {
      const first = this.firstPick;
      this.firstPick = null;
      if (this.cards[first].pairId === card.pairId) {
        this.lock = true;
        this.time.delayedCall(500, () => {
          this.cards[first].matched = true;
          card.matched = true;
          this.foundPairs++;
          this.ring.setCounts(this.foundPairs, this.TOTAL_PAIRS);
          const slot = this.grid.slots[idx];
          this.burst.emit(bloomBurst(slot.x, slot.y));
          this.lock = false;
          if (this.foundPairs >= this.TOTAL_PAIRS) this.win();
        });
      } else {
        this.lock = true;
        this.time.delayedCall(800, () => {
          this.grid.flipDown(first, () => this.hideIcon(first));
          this.grid.flipDown(idx, () => this.hideIcon(idx));
          this.lock = false;
        });
      }
    }
  }

  private showIcon(idx: number): void {
    const slot = this.grid.slots[idx];
    const t = this.add.text(slot.x, slot.y, this.cards[idx].icon, {
      fontFamily: 'Arial', fontSize: '30px',
    }).setOrigin(0.5);
    this.iconTexts.set(idx, t);
  }

  private hideIcon(idx: number): void {
    const t = this.iconTexts.get(idx);
    if (t) { t.destroy(); this.iconTexts.delete(idx); }
  }

  private win(): void {
    this.done = true;
    const secs = (this.time.now - this.roundStart) / 1000;
    this.dda.outcome(true, Math.max(0.3, 1 - this.mistakes * 0.2));
    this.pm.recordRound('memory-hill', true, secs);
    this.signals.attempt('memory.pairs', true);
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַפַּרְפַּר נִזְכַּר בַּכֹּל!']);

        recordZoneFinish('memory-hill');

    this.time.delayedCall(2600, () => this.scene.start('portal'));
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.burst.update(dt, 60, 0.985);
    this.ring.update(dt);
    this.dialogue.update(dt);
    this.grid.drawBacks();
  }
}
