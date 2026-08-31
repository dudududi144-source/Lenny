/* ============================================================
 * SequenceEchoScene — Stage 2c: a LEVEL GENERATOR for working
 * memory. Lives in Memory Hill (zone: memory-hill).
 *
 * What Stage 2c changed (the GlowFish/MemoryPairs template applied
 * to a sequence-echo game):
 *  - Every indicator is a (shape, tone) KIND (6 kinds, IndicatorTypes):
 *    orb / chime / leaf, in bright (sun-gold, spring-mint) or muted
 *    (dusk-lilac, sea-sage) clothing. Vector-drawn on stone plates,
 *    no emoji, no letters on the indicators.
 *  - The board is a fixed 3x2 "keyboard" — every kind is always on
 *    the board, so the child learns the keys; the SEQUENCE is what
 *    the DDA makes hard: which kinds (similarity), how many, how
 *    fast. The round's echo is built by selectIndicatorTypes:
 *    wanted mutual similarity = 0.15 + level * 0.55 — low level ->
 *    echoed kinds are strangers, high level -> near-twins.
 *  - The playback ladder is a difficulty axis too: length
 *    2 + floor(level * 3) (2..5), gap 800 - level * 400 ms
 *    (800..400), and below level 0.35 the indicators are perfectly
 *    static while higher levels add a gentle idle bobbing.
 *  - Echo mistakes are classified (near-miss-similar /
 *    near-miss-same-shape / near-miss-same-tone / wrong-item /
 *    wrong-length) and answered with Lenny's specific Hebrew
 *    feedback. The hint ladder is now VISIBLE: gentle -> slower
 *    replay; clear -> + a pulsing pink glow (0xff8ad9 — a pink used
 *    nowhere else in this scene) on the next-needed indicator;
 *    show -> + numbered badges (1,2,3...) beside the sequence.
 *
 * Gate B contract preserved (unchanged from Stage 0-1):
 *  - a wrong echo fires outcome(false) immediately (a failed attempt);
 *    a fully echoed pattern fires outcome(true, 1) — one DDA round.
 *  - recordZoneFinish gets real elapsed seconds.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst, confettiBurst } from '../games/fx/ParticleBurst';
import { AdaptiveDifficulty, HintStrength } from '../games/core/AdaptiveDifficulty';
import { LearningSignals } from '../games/core/LearningSignals';
import { GameSpec } from '../games/builder/GameSpec';
import {
  IndicatorType,
  SequencePlan,
  ALL_INDICATOR_TYPES,
  colorFor,
  isSameIndicator,
  selectIndicatorTypes,
  sequencePlanFor,
  getErrorKind,
} from '../games/fx/IndicatorTypes';

interface IndicatorCell {
  x: number;
  y: number;
  kind: IndicatorType;
}

/* tuning constants (kept in one place for review) */
const LEAD_MS = 500;        /* quiet pad before the first lit indicator */
const REPLAY_DELAY_MS = 900;
const NEXT_ROUND_MS = 1100;
const WIN_GAP_MS = 2400;
const TAP_FLASH_S = 0.3;
/* the hint glow: a pink used NOWHERE else in this scene, so the
   e2e suite can locate it by pixels alone (same hue as MemoryPairs'
   show-aura — one platform-wide hint language) */
const HINT_GLOW_HEX = 0xff8ad9;
/* number badges (show-hint): a cream used nowhere else in the grid
   band (indicator inks top out at lum ~210; dialogue text lives at
   the bottom, outside the census band) */
const BADGE_HEX = 0xfff3dc;
const BADGE_TEXT_HEX = '#3a2a55';
/* stone plate under every indicator: a uniform dark backdrop that
   steadies the contrast for the child and gives the pixel e2e a
   known background (the garden art behind is textured) */
const PLATE_HEX = 0x1c1440;
const PLATE_EDGE_HEX = 0x2a2058;
const VEIN_HEX = 0x0b0726;

export class SequenceEchoScene extends Phaser.Scene {
  private indG!: Phaser.GameObjects.Graphics;
  private hintG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;

  private cells: IndicatorCell[] = [];
  private sequence: IndicatorType[] = [];
  private sequenceCells: number[] = [];
  private echoTaps: IndicatorType[] = [];
  private inputIndex = 0;
  private round = 1;
  private totalRounds = 3;
  private state: 'idle' | 'showing' | 'input' | 'done' = 'idle';
  private litCell = -1;
  private flashT = 0;
  private spec: GameSpec | null = null;
  private plan: SequencePlan = sequencePlanFor(0.35);

  /* cognitive core: DDA drives similarity, length, pace and motion */
  private dda = new AdaptiveDifficulty('memory-hill');
  private signals = new LearningSignals();

  private roundStart = 0;
  private consecutiveMiss = 0;
  private hintStrength: HintStrength = 'none';
  private badges: Phaser.GameObjects.GameObject[] = [];

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
    this.sequenceCells = [];
    this.echoTaps = [];
    this.inputIndex = 0;
    this.consecutiveMiss = 0;
    this.hintStrength = 'none';
    this.badges = [];
    this.plan = sequencePlanFor(this.dda.level());
    this.roundStart = this.time.now;
    this.totalRounds = (this.spec && this.spec.params.rounds) ? this.spec.params.rounds : 3;
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const bg = this.add.image(w / 2, h / 2, 'garden-bg');
    bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x150e33, 0.5);

    /* layers by insertion order: indicators < particles < hints */
    this.indG = this.add.graphics();
    this.burst = new ParticleBurst(this);
    this.hintG = this.add.graphics();

    /* the 3x2 keyboard: six stone plates, every kind always on the
       board (shuffled once per game — the keys stay put, the MELODY
       is what the DDA composes) */
    const colX = [w * 0.2, w * 0.5, w * 0.8];
    const rowY = [h * 0.34, h * 0.56];
    const kinds = ALL_INDICATOR_TYPES.slice();
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    this.cells = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        this.cells.push({ x: colX[c], y: rowY[r], kind: kinds[r * 3 + c] });
      }
    }

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

  /* ==========================================================
   * The level generator (Stage 2c spec, section 2.2)
   * ========================================================== */

  /**
   * Pick the round's echo kinds, in play order. Wanted mutual
   * similarity = 0.15 + level * 0.55 (0.15..0.7): higher level ->
   * kinds that are harder to tell apart. The greedy algorithm is
   * the same one MemoryPairs uses for its card deck
   * (selectPairTypes), shared via the pure IndicatorTypes module;
   * the returned selection is distinct kinds, shuffled into play
   * order — the echo never repeats a kind.
   */
  private selectIndicatorTypes(indicatorCount: number, level: number): IndicatorType[] {
    return selectIndicatorTypes(indicatorCount, level);
  }

  private startRound(): void {
    if (this.state === 'done') return;
    const level = this.dda.level();
    this.plan = sequencePlanFor(level);
    this.sequence = this.selectIndicatorTypes(this.plan.length, level);
    this.sequenceCells = this.sequence.map((t) => this.cellOfKind(t));
    this.inputIndex = 0;
    this.echoTaps = [];
    this.playSequence();
  }

  private cellOfKind(kind: IndicatorType): number {
    return this.cells.findIndex((c) => isSameIndicator(c.kind, kind));
  }

  /* ==========================================================
   * Playback (the show phase)
   * ========================================================== */

  private playSequence(): void {
    if (this.state === 'done') return;
    this.state = 'showing';
    this.dialogue.say(['הִסְתַּכְּלוּ בְּסֵדֶר...']);
    /* the gentle hint's whole job: replay the sequence SLOWER */
    const gap = this.hintStrength === 'gentle'
      ? Math.round(this.plan.gapMs * 1.5)
      : this.plan.gapMs;
    const flashS = Math.round(gap * 0.55) / 1000;
    for (let i = 0; i < this.sequenceCells.length; i++) {
      this.time.delayedCall(LEAD_MS + i * gap, () => {
        this.litCell = this.sequenceCells[i];
        this.flashT = flashS;
      });
    }
    this.time.delayedCall(LEAD_MS + this.sequenceCells.length * gap, () => {
      if (this.state === 'done') return;
      this.state = 'input';
      this.inputIndex = 0;
      this.echoTaps = [];
      this.dialogue.say(['עַכְשָׁיו תּוֹרְכֶם! חַזְרוּ עַל הַסֵּדֶר.']);
    });
  }

  /* ==========================================================
   * Input (the echo phase)
   * ========================================================== */

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.state !== 'input') {
      this.dialogue.skip();
      return;
    }
    const idx = this.hitCell(p.x, p.y);
    if (idx === null) return;

    /* brief flash feedback for the tapped indicator */
    this.litCell = idx;
    this.flashT = TAP_FLASH_S;

    const userType = this.cells[idx].kind;
    const expected = this.sequence[this.inputIndex];
    if (isSameIndicator(userType, expected)) {
      this.echoTaps.push(expected);
      this.inputIndex++;
      this.burst.emit(sparkleBurst(this.cells[idx].x, this.cells[idx].y));
      if (this.inputIndex >= this.sequence.length) {
        this.signals.attempt('memory.working', true);
        this.roundComplete();
      }
    } else {
      this.onEchoFail(userType);
    }
  }

  private onEchoFail(userType: IndicatorType): void {
    /* error taxonomy on the KINDS: the feedback names WHAT was
       almost right (shape? tone? the whole look?) instead of a
       generic "try again". The user sequence = the correct taps so
       far + the wrong one; the first divergent position decides. */
    const kind = getErrorKind(this.sequence, this.echoTaps.concat([userType]));
    this.dda.outcome(false); /* wrong echo = a failed attempt (Gate B, unchanged) */
    this.signals.attempt('memory.working', false);
    this.signals.errorKind('memory.working', kind);

    /* visible, escalating help: gentle -> clear -> show */
    this.consecutiveMiss++;
    this.hintStrength = this.dda.suggestHint(this.consecutiveMiss);
    if (this.hintStrength !== 'none') this.signals.hintUsed('memory.working');
    if (this.hintStrength === 'show') this.showBadges();

    this.dialogue.say([this.lineFor(kind)]);
    this.state = 'idle';
    this.time.delayedCall(REPLAY_DELAY_MS, () => this.playSequence());
  }

  /* Hebrew feedback: taxonomy lines verbatim (spec 2.6) */
  private lineFor(kind: string): string {
    switch (kind) {
      case 'near-miss-similar':
        return 'כַּמְעַט! זֶה דּוֹמֶה מְאֹד לַסֵּדֶר, אֲבָל לֹא בְּדִיּוּק';
      case 'near-miss-same-shape':
        return 'אוֹתָהּ צוּרָה — שִׂימִי לֵב לַגַּוָּן';
      case 'near-miss-same-tone':
        return 'אוֹתוֹ גַּוָּן — שִׂימִי לֵב לַצּוּרָה';
      case 'wrong-length':
        return 'מִסְפָּר הַצְּעָדִים שׁוֹנֶה';
      default:
        return 'זֶה לֹא הָאִינְדִּיקָטוֹר הַנָּכוֹן';
    }
  }

  /* ==========================================================
   * Round boundary (the ONLY places outcome() fires — Gate B)
   * ========================================================== */

  private roundComplete(): void {
    this.ring.setCounts(this.round, this.totalRounds);
    const c = { x: this.scale.width / 2, y: this.scale.height * 0.46 };
    this.burst.emit(confettiBurst(c.x, c.y));
    this.consecutiveMiss = 0;
    this.hintStrength = 'none';
    this.clearBadges();
    /* a fully echoed pattern = one DDA round, clean win */
    this.dda.outcome(true, 1);
    if (this.round >= this.totalRounds) {
      this.win();
    } else {
      this.round++;
      this.dialogue.say(['וָאו! הַסֵּדֶר גָּדַל! בּוֹאוּ נִזְכֹּר אוֹתוֹ.']);
      this.time.delayedCall(NEXT_ROUND_MS, () => this.startRound());
    }
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

    this.time.delayedCall(WIN_GAP_MS, () => this.scene.start('portal'));
  }

  /* ==========================================================
   * Hint ladder visuals (gentle / clear / show)
   * ========================================================== */

  /* clear + show: a pulsing pink ring on the NEXT-NEEDED indicator
     (the cell holding the kind the child must tap now) */
  private drawNextNeededGlow(): void {
    const g = this.hintG;
    g.clear();
    if (this.state !== 'input') return;
    if (this.hintStrength !== 'clear' && this.hintStrength !== 'show') return;
    if (this.inputIndex >= this.sequenceCells.length) return;
    const cell = this.cells[this.sequenceCells[this.inputIndex]];
    const pulse = 0.55 + 0.35 * Math.sin((this.time.now / 180) * Math.PI * 2);
    g.lineStyle(5, HINT_GLOW_HEX, pulse);
    g.strokeCircle(cell.x, cell.y, 30);
  }

  /* show: numbered badges (1,2,3...) beside each echoed indicator */
  private showBadges(): void {
    this.clearBadges();
    this.sequenceCells.forEach((cellIdx, k) => {
      const c = this.cells[cellIdx];
      const bx = c.x + 40, by = c.y - 46;
      this.badges.push(this.add.circle(bx, by, 12, BADGE_HEX));
      this.badges.push(
        this.add.text(bx, by, String(k + 1), {
          fontFamily: 'Arial',
          fontSize: '17px',
          fontStyle: 'bold',
          color: BADGE_TEXT_HEX,
        }).setOrigin(0.5),
      );
    });
  }

  private clearBadges(): void {
    for (const b of this.badges) b.destroy();
    this.badges = [];
  }

  /* ==========================================================
   * Rendering (vector indicators — no emoji, no letters)
   * ========================================================== */

  private hitCell(px: number, py: number): number | null {
    for (let i = 0; i < this.cells.length; i++) {
      if (Math.hypot(px - this.cells[i].x, py - this.cells[i].y) < 55) return i;
    }
    return null;
  }

  /* one shared renderer per shape; signatures are deliberately
     distinct for pixel classification (48x48 units, u = 48):
       orb    concentric circles, centered round mass (+ a tiny white
              sparkle core on bright kinds)
       chime  wide-top pendant tapering DOWN + DETACHED clapper dot
              below (gap ~0.17u so AA can never fuse them)
       leaf   tall lens split by a dark central vein channel */
  private drawKind(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    alpha: number,
    kind: IndicatorType,
  ): void {
    const hex = colorFor(kind);
    const u = 48;
    g.fillStyle(hex, alpha);

    switch (kind.shape) {
      case 'orb': {
        /* radial-gradient feel: three concentric layers */
        g.fillStyle(hex, alpha * 0.32);
        g.fillCircle(cx, cy, u * 0.42);
        g.fillStyle(hex, alpha * 0.62);
        g.fillCircle(cx, cy, u * 0.3);
        g.fillStyle(hex, alpha);
        g.fillCircle(cx, cy, u * 0.17);
        if (kind.tone === 'bright') {
          g.fillStyle(0xffffff, alpha * 0.85);
          g.fillCircle(cx - u * 0.06, cy - u * 0.07, u * 0.055);
        }
        break;
      }
      case 'chime': {
        /* pendant: wide top edge, apex down, clapper below */
        g.fillTriangle(
          cx - u * 0.36, cy - u * 0.26,
          cx + u * 0.36, cy - u * 0.26,
          cx, cy + u * 0.18,
        );
        g.fillStyle(hex, alpha);
        g.fillCircle(cx, cy + u * 0.44, u * 0.09);
        break;
      }
      case 'leaf': {
        g.fillEllipse(cx, cy, u * 0.5, u * 0.9);
        /* veins cut dark channels through the ink */
        g.fillStyle(VEIN_HEX, 1);
        g.fillRect(cx - u * 0.045, cy - u * 0.34, u * 0.09, u * 0.68);
        g.lineStyle(2.5, VEIN_HEX, 1);
        g.beginPath();
        g.moveTo(cx, cy - u * 0.12);
        g.lineTo(cx + u * 0.14, cy - u * 0.02);
        g.strokePath();
        g.beginPath();
        g.moveTo(cx, cy + u * 0.05);
        g.lineTo(cx - u * 0.14, cy + u * 0.15);
        g.strokePath();
        break;
      }
    }
  }

  /* indicators + plates, drawn every frame (bob included) */
  private drawIndicators(): void {
    const g = this.indG;
    g.clear();
    const now = this.time.now;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const bob = this.plan.bobAmp
        * Math.sin((now / this.plan.bobPeriodMs) * Math.PI * 2 + i * 1.3);
      const cx = c.x, cy = c.y + bob;
      const lit = this.litCell === i;

      /* stone plate */
      g.fillStyle(PLATE_HEX, 0.92);
      g.fillRoundedRect(cx - 29, cy - 29, 58, 58, 12);
      g.lineStyle(1.5, PLATE_EDGE_HEX, 1);
      g.strokeRoundedRect(cx - 29, cy - 29, 58, 58, 12);

      if (lit) {
        const hex = colorFor(c.kind);
        g.fillStyle(hex, 0.4);
        g.fillCircle(cx, cy, 34);
        g.lineStyle(3, hex, 0.9);
        g.strokeCircle(cx, cy, 26);
      }
      this.drawKind(g, cx, cy, lit ? 1 : 0.85, c.kind);
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    if (this.flashT > 0) this.flashT -= dt;
    else this.litCell = -1;

    this.burst.update(dt);
    this.ring.update(dt);
    this.dialogue.update(dt);

    this.drawIndicators();
    this.drawNextNeededGlow();
  }
}
