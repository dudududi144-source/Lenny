/* ============================================================
 * AcornSortScene — a drag-and-drop sorting game.
 * Lives in Thinking Forest (zone: thinking-forest).
 *
 * v3 changes:
 *   - Now a REAL drag-and-drop game on top of DragDropSystem
 *     (was tap-to-select). Dragging exercises motor planning and
 *     makes the "small -> large" ordering tangible.
 *   - Drop targets show a faint size hint so the order is readable.
 *   - Failed drops snap back home with a gentle tween.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst } from '../games/fx/ParticleBurst';
import { DragDropSystem } from '../games/fx/DragDropSystem';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';
import { LearningSignals } from '../games/core/LearningSignals';
import { GameSpec } from '../games/builder/GameSpec';

export class AcornSortScene extends Phaser.Scene {
  private acornG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  private drag!: DragDropSystem;
  private placedCount = 0;
  private round = 1;
  private readonly ROUNDS = 3;
  private acornCount = 4;
  private spec: GameSpec | null = null;
  private done = false;

  /* cognitive core: DDA drives the acorn count when no spec provides one */
  private dda = new AdaptiveDifficulty('thinking-forest');
  private signals = new LearningSignals();
  private rejectsThisRound = 0;
  private consecutiveMiss = 0;

  private roundStart = 0;

  constructor() { super('acorn-sort'); }

  init(data: { spec?: GameSpec }): void {
    this.spec = (data && data.spec) ? data.spec : null;
  }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    this.round = 1;
    this.roundStart = this.time.now;
    this.done = false;
    /* a GameSpec variant authors the count; otherwise DDA adapts it:
       acorns = 4 + floor(level * 6), clamped for layout sanity */
    this.acornCount = (this.spec && this.spec.params.itemCount)
      ? Math.min(this.spec.params.itemCount, 5)
      : Math.min(4 + Math.floor(this.dda.level() * 6), 8);
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x14301e, 0.45);
    this.acornG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* progress ring top-right */
    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.9, width: w * 0.85 });
    this.dialogue.say([
      'הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים.',
      'גִּרְרוּ כָּל בְּלוּט לָעִגוּל שֶׁבַּגֹּדֶל שֶׁלּוֹ!',
    ]);

    this.spawnRound(w, h);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.done) return;
      this.dialogue.skip();
      this.drag.pointerDown(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.drag.pointerMove(p.x, p.y));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.drag.pointerUp(p.x, p.y));
  }

  private spawnRound(w: number, h: number): void {
    this.placedCount = 0;
    this.rejectsThisRound = 0;
    this.consecutiveMiss = 0;
    this.ring.setCounts(0, this.acornCount);

    this.drag = new DragDropSystem(this, {
      isValidDrop: (itemId: string, targetId: string) =>
        itemId.split('-')[1] === targetId.split('-')[1],
      onDrop: (itemId: string) => this.onCorrectDrop(itemId),
      onReject: () => {
        this.rejectsThisRound++;
        this.consecutiveMiss++;
        /* a rejected drop is NOT a round loss: the round is one whole
           sort, judged once in onCorrectDrop. It feeds LearningSignals
           and the visible hint ladder instead. */
        this.signals.attempt('logic.ordering', false);
        /* error taxonomy: a rejected drop in a size-ordering game is
           an ordering mistake */
        this.signals.errorKind('logic.ordering', 'wrong-order');
        const hint = this.dda.suggestHint(this.consecutiveMiss);
        this.dialogue.say([
          hint === 'show'
            ? 'כָּל עִגוּל מְבַקֵּשׁ בְּלוּט גָּדוֹל מִשֶּׁל הָעִגּוּל שֶׁלִּפְנָיו'
            : hint === 'clear'
              ? 'סַדְּרוּ אֶת הַבְּלוּטִים מֵהַקָּטָן אֶל הַגָּדוֹל'
              : 'נַסּוּ שׁוּב — אֵיזֶה עִגוּל מַתְאִים?',
        ]);
      },
    });

    /* scatter the 4 acorns (shuffled) across the upper area */
    const xs: number[] = [];
    for (let i = 0; i < this.acornCount; i++) {
      xs.push(0.14 + (this.acornCount > 1 ? (i * 0.72) / (this.acornCount - 1) : 0.5));
    }
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    for (let s = 1; s <= this.acornCount; s++) {
      this.drag.addItem('acorn-' + s, w * xs[s - 1], h * 0.28);
    }

    /* drop circles along the bottom, left -> right = small -> large;
       radius shrinks with high counts so slots never overlap */
    const spacing = w * (this.acornCount > 1 ? 0.72 / (this.acornCount - 1) : 0.5);
    const slotR = Math.max(24, Math.min(44, Math.floor(spacing * 0.45)));
    for (let k = 1; k <= this.acornCount; k++) {
      const sx = 0.14 + (this.acornCount > 1 ? ((k - 1) * 0.72) / (this.acornCount - 1) : 0.5);
      this.drag.addTarget('slot-' + k, w * sx, h * 0.66, slotR);
    }
  }

  private onCorrectDrop(itemId: string): void {
    this.placedCount++;
    const it = this.drag.items.find((i) => i.id === itemId);
    if (it) this.burst.emit(sparkleBurst(it.x, it.y));
    this.ring.setCounts(this.placedCount, this.acornCount);

    if (this.placedCount >= this.acornCount) {
      /* a completed round = one DDA round; score reflects its cleanliness */
      this.consecutiveMiss = 0;
      this.dda.outcome(true, Math.max(0.3, 1 - this.rejectsThisRound * 0.2));
      this.signals.attempt('logic.ordering', true);
      if (this.round >= this.ROUNDS) {
        this.win();
      } else {
        this.round++;
        this.dialogue.say(['וָאו! עוֹד סִבּוּב!']);
        this.time.delayedCall(800, () => this.spawnRound(this.scale.width, this.scale.height));
      }
    } else {
      this.dialogue.say(['כָּל הַכָּבוֹד! מַה הַבָּא?']);
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.burst.update(dt);
    this.ring.update(dt);
    this.dialogue.update(dt);

    const g = this.acornG;
    g.clear();

    /* drop circles with a faint size hint */
    for (const t of this.drag.targets) {
      const n = parseInt(t.id.split('-')[1], 10);
      const active = this.drag.activeDrag() !== null;
      g.lineStyle(2.5, t.occupied ? 0x7dffb8 : 0xfff6ec, t.occupied ? 0.8 : (active ? 0.6 : 0.35));
      g.strokeCircle(t.x, t.y, t.radius);
      if (!t.occupied) this.drawAcorn(g, t.x, t.y, n * 3, 0.22);
    }

    /* acorns (dragging one drawn a bit bigger for feedback) */
    for (const it of this.drag.items) {
      const size = parseInt(it.id.split('-')[1], 10);
      const dragging = this.drag.activeDrag() === it.id;
      this.drawAcorn(g, it.x, it.y, size * (dragging ? 7 : 6), 1);
    }
  }

  private drawAcorn(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha: number): void {
    g.fillStyle(0xc8873a, alpha);
    g.fillEllipse(x, y + r * 0.2, r * 1.6, r * 1.8);
    g.fillStyle(0x8d5a3b, alpha);
    g.fillEllipse(x, y - r * 0.5, r * 1.7, r * 0.9);
    g.lineStyle(2, 0x5a3a20, alpha);
    g.lineBetween(x, y - r * 0.9, x, y - r * 1.1);
  }

  private win(): void {
    this.done = true;
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַסְּנַאי מְאֻשָּׁר!']);

    const secs = (this.time.now - this.roundStart) / 1000;
    /* real elapsed seconds feed the PlayerModel tempo signal */
    recordZoneFinish('thinking-forest', secs);

    this.time.delayedCall(2600, () => this.scene.start('portal'));
  }
}
