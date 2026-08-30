/* ============================================================
 * SequenceEchoScene — a working-memory pattern-recall game.
 * Lives in Memory Hill (zone: memory-hill).
 *
 * The fireflies light up in a pattern. Watch, then tap the orbs
 * in the same order. Each round the pattern grows by one, so the
 * child's working memory is gently stretched (Zone of Proximal
 * Development). Built on the reusable fx library.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst, confettiBurst } from '../games/fx/ParticleBurst';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';
import { LearningSignals } from '../games/core/LearningSignals';
import { GameSpec } from '../games/builder/GameSpec';

interface Orb {
  x: number;
  y: number;
  color: number;
}

export class SequenceEchoScene extends Phaser.Scene {
  private orbG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;

  private orbs: Orb[] = [];
  private sequence: number[] = [];
  private inputIndex = 0;
  private round = 1;
  private totalRounds = 3;
  private state: 'idle' | 'showing' | 'input' | 'done' = 'idle';
  private litOrb = -1;
  private flashT = 0;
  private spec: GameSpec | null = null;

  /* cognitive core: DDA drives how long the echo sequence grows */
  private dda = new AdaptiveDifficulty('memory-hill');
  private signals = new LearningSignals();

  private roundStart = 0;

  constructor() { super('sequence-echo'); }

  init(data: { spec?: GameSpec }): void {
    this.spec = (data && data.spec) ? data.spec : null;
  }

  preload(): void {
    showLoader(this);
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    this.round = 1;
    this.state = 'idle';
    this.sequence = [];
    this.inputIndex = 0;
    this.roundStart = this.time.now;
    this.totalRounds = (this.spec && this.spec.params.rounds) ? this.spec.params.rounds : 3;
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x150e33, 0.5);

    this.orbG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* four glowing orbs in a diamond */
    const cx = w / 2, cy = h * 0.46, r = Math.min(w, h) * 0.24;
    this.orbs = [
      { x: cx, y: cy - r, color: 0xffd76a },      /* top */
      { x: cx + r, y: cy, color: 0x4dc9ff },      /* right */
      { x: cx, y: cy + r, color: 0xf2549a },      /* bottom */
      { x: cx - r, y: cy, color: 0x7dffb8 },      /* left */
    ];

    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });
    this.ring.setCounts(0, this.totalRounds);

    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.88, width: w * 0.85 });
    const intro = (this.spec && this.spec.narrative.intro.length > 0)
      ? this.spec.narrative.intro
      : ['הַגּוּפִים הַזּוֹהֲרִים יָאִירוּ בְּסֵדֶר.', 'הִסְתַּכְּלוּ, אַחַר כָּךְ חַזְרוּ עַל הַסֵּדֶר!'];
    this.dialogue.say(intro);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));

    /* begin the first round after a short pause */
    this.time.delayedCall(1400, () => this.startRound());
  }

  private startRound(): void {
    if (this.state === 'done') return;
    this.sequence = [];
    /* the pattern still grows by one each round, but the DDA level
       caps its length: len = min(round + 1, 2 + floor(level * 4)) */
    const cap = 2 + Math.floor(this.dda.level() * 4);
    const len = Math.min(this.round + 1, cap);
    for (let i = 0; i < len; i++) {
      this.sequence.push(Math.floor(Math.random() * this.orbs.length));
    }
    this.inputIndex = 0;
    this.playSequence();
  }

  private playSequence(): void {
    this.state = 'showing';
    this.dialogue.say(['הִסְתַּכְּלוּ בְּסֵדֶר...']);
    const step = 650;
    for (let i = 0; i < this.sequence.length; i++) {
      this.time.delayedCall(500 + i * step, () => {
        this.litOrb = this.sequence[i];
        this.flashT = 0.45;
      });
    }
    this.time.delayedCall(500 + this.sequence.length * step, () => {
      this.state = 'input';
      this.inputIndex = 0;
      this.dialogue.say(['עַכְשָׁיו תּוֹרְכֶם! חַזְרוּ עַל הַסֵּדֶר.']);
    });
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.state !== 'input') {
      this.dialogue.skip();
      return;
    }
    const idx = this.hitOrb(p.x, p.y);
    if (idx === null) return;

    /* brief flash feedback for the tapped orb */
    this.litOrb = idx;
    this.flashT = 0.3;

    if (idx === this.sequence[this.inputIndex]) {
      this.inputIndex++;
      this.burst.emit(sparkleBurst(this.orbs[idx].x, this.orbs[idx].y));
      if (this.inputIndex >= this.sequence.length) {
        this.signals.attempt('memory.working', true);
        this.roundComplete();
      }
    } else {
      this.dda.outcome(false); /* wrong echo = a failed attempt */
      this.signals.attempt('memory.working', false);
      /* error taxonomy: the right orb at the wrong time = wrong
         position; an orb that is not next at all = wrong item */
      const remaining = this.sequence.slice(this.inputIndex);
      const kind = remaining.includes(idx) ? 'wrong-position' : 'wrong-item';
      this.signals.errorKind('memory.working', kind);
      this.dialogue.say(['כִּמְעַט! בּוֹאוּ נִרְאֶה אֶת הַסֵּדֶר עוֹד פַּעַם.']);
      this.time.delayedCall(900, () => this.playSequence());
      this.state = 'idle';
    }
  }

  private roundComplete(): void {
    this.ring.setCounts(this.round, this.totalRounds);
    const c = { x: this.scale.width / 2, y: this.scale.height * 0.46 };
    this.burst.emit(confettiBurst(c.x, c.y));
    /* a fully echoed pattern = one DDA round, clean win */
    this.dda.outcome(true, 1);
    if (this.round >= this.totalRounds) {
      this.win();
    } else {
      this.round++;
      this.dialogue.say(['וָאו! הַסֵּדֶר גָּדַל! בּוֹאוּ נִזְכֹּר אוֹתוֹ.']);
      this.time.delayedCall(1100, () => this.startRound());
    }
  }

  private hitOrb(px: number, py: number): number | null {
    for (let i = 0; i < this.orbs.length; i++) {
      if (Math.hypot(px - this.orbs[i].x, py - this.orbs[i].y) < 55) return i;
    }
    return null;
  }

  private win(): void {
    this.state = 'done';
    const winMsg = (this.spec && this.spec.narrative.win)
      ? this.spec.narrative.win
      : 'וָאו, כָּל הַכָּבוֹד! זָכַרְתָּ אֶת כָּל הַסְּדָרִים!';
    this.dialogue.say([winMsg]);

    const secs = (this.time.now - this.roundStart) / 1000;
    /* real elapsed seconds feed the PlayerModel tempo signal */
    recordZoneFinish('memory-hill', secs);

    this.time.delayedCall(2400, () => this.scene.start('portal'));
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    if (this.flashT > 0) this.flashT -= dt;
    else this.litOrb = -1;

    this.burst.update(dt);
    this.ring.update(dt);
    this.dialogue.update(dt);

    const g = this.orbG;
    g.clear();
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      const lit = this.litOrb === i;
      /* soft glow */
      g.fillStyle(o.color, lit ? 0.5 : 0.14);
      g.fillCircle(o.x, o.y, lit ? 58 : 44);
      /* core */
      g.fillStyle(o.color, lit ? 1 : 0.75);
      g.fillCircle(o.x, o.y, lit ? 34 : 26);
      g.lineStyle(2.5, 0xfff6ec, lit ? 0.95 : 0.4);
      g.strokeCircle(o.x, o.y, lit ? 34 : 26);
    }
  }
}
