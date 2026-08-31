import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  ALL_INDICATOR_TYPES,
  colorFor,
  getErrorKind,
  isSameIndicator,
  sequencePlanFor,
  buildSequenceTypes,
  type IndicatorType,
  type SequencePlan,
} from '../fx/IndicatorTypes';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ringTexture, softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';

const LEAD_MS = 500;
const REPLAY_DELAY_MS = 900;
const NEXT_ROUND_MS = 1100;
const TAP_FLASH_S = 0.3;
const FIRST_ROUND_DELAY_MS = 1400;
const HIT_R = 52;
const PLATE_W = 96;
const PLATE_H = 58;
/* the platform-wide hint language: a pink used nowhere else here */
const HINT_GLOW_HEX = 0xff8ad9;
const PLATE_HEX = 0x1c1440;
const PLATE_EDGE_HEX = 0x2a2058;

interface EchoCell {
  x: number;
  y: number;
  baseY: number;
  kind: IndicatorType;
  plate: Graphics;
  glow: Sprite;
}

/**
 * SequenceEcho — working-memory echo (memory-hill).
 * Faithful port of the Stage-2c level generator: a fixed 3x2 keyboard
 * of six (shape,tone) kinds, similarity-driven sequences, playback
 * ladder, taxonomy feedback and a VISIBLE hint ladder (gentle = slower
 * replay; clear = pulsing pink ring on the next-needed cell; show =
 * cream number badges beside the echoed cells).
 */
export class SequenceEchoScene extends GameScene {
  private cells: EchoCell[] = [];
  private sequence: IndicatorType[] = [];
  private echoTaps: IndicatorType[] = [];
  private inputIndex = 0;
  private round = 1;
  private totalRounds = 3;
  private phase: 'idle' | 'showing' | 'input' | 'done' = 'idle';
  private litCell = -1;
  private flashT = 0;
  private plan: SequencePlan = sequencePlanFor(0.35);
  private consecutiveMiss = 0;
  private hintStrength: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private badges: Array<{ bg: Graphics; text: Text }> = [];
  private hintRing: Sprite;
  private board = new Container();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.root.addChild(this.board);

    /* the 3x2 keyboard: six stone plates, every kind always on the
       board (shuffled once per game — the keys stay put, the MELODY
       is what the DDA composes) */
    const colX = [this.w * 0.2, this.w * 0.5, this.w * 0.8];
    const rowY = [this.h * 0.34, this.h * 0.56];
    const kinds = ALL_INDICATOR_TYPES.slice();
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        this.cells.push(this.buildCell(colX[c], rowY[r], kinds[r * 3 + c]));
      }
    }

    this.hintRing = new Sprite(ringTexture());
    this.hintRing.anchor.set(0.5);
    this.hintRing.tint = HINT_GLOW_HEX;
    this.hintRing.blendMode = 'add';
    this.hintRing.width = 118;
    this.hintRing.height = 86;
    this.hintRing.visible = false;
    this.board.addChild(this.hintRing);

    this.build();
  }

  private buildCell(x: number, y: number, kind: IndicatorType): EchoCell {
    const plate = new Graphics();
    plate.roundRect(-PLATE_W / 2, -PLATE_H / 2, PLATE_W, PLATE_H, 16);
    plate.fill({ color: PLATE_HEX });
    plate.roundRect(-PLATE_W / 2 + 2, -PLATE_H / 2 + 2, PLATE_W - 4, PLATE_H - 4, 14);
    plate.stroke({ color: PLATE_EDGE_HEX, width: 2 });

    const color = colorFor(kind);
    const g = new Graphics();
    if (kind.shape === 'orb') {
      g.circle(0, 0, 15).fill({ color });
      g.circle(0, 0, 9).stroke({ color: PLATE_HEX, width: 2, alpha: 0.85 });
      g.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.95 });
    } else if (kind.shape === 'chime') {
      g.moveTo(-13, -16);
      g.lineTo(13, -16);
      g.lineTo(5, 8);
      g.lineTo(-5, 8);
      g.closePath();
      g.fill({ color });
      g.circle(0, 15, 4.5).fill({ color });
    } else {
      g.ellipse(0, 0, 10, 19).fill({ color });
      g.moveTo(0, -16);
      g.lineTo(0, 16);
      g.stroke({ color: PLATE_HEX, width: 2.4, alpha: 0.9 });
      g.moveTo(-6, -4);
      g.lineTo(-9, 2);
      g.moveTo(6, -2);
      g.lineTo(9, 5);
      g.stroke({ color: PLATE_HEX, width: 1.6, alpha: 0.7 });
    }
    if (kind.tone === 'muted') g.alpha = 0.8;
    plate.addChild(g);

    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = color;
    glow.blendMode = 'add';
    glow.width = 120;
    glow.height = 90;
    glow.visible = false;
    plate.addChildAt(glow, 0);

    plate.x = x;
    plate.y = y;
    this.board.addChild(plate);
    return { x, y, baseY: y, kind, plate, glow };
  }

  protected build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 3;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הַגּוּפִים הַזּוֹהֲרִים יָאִירוּ בְּסֵדֶר.', 'הִסְתַּכְּלוּ, אַחַר כָּךְ חַזְרוּ עַל הַסֵּדֶר!'],
    );
    this.anim.after(FIRST_ROUND_DELAY_MS, () => this.startRound());
  }

  /* ---------- level generator (Stage 2c, unchanged) ---------- */

  private startRound(): void {
    if (this.phase === 'done') return;
    const level = this.dda.level();
    this.plan = sequencePlanFor(level);
    this.sequence = buildSequenceTypes(this.plan.length, level);
    this.inputIndex = 0;
    this.echoTaps = [];
    this.clearBadges();
    this.playSequence();
  }

  private cellOfKind(kind: IndicatorType): number {
    return this.cells.findIndex((c) => isSameIndicator(c.kind, kind));
  }

  /* ---------- playback ---------- */

  private playSequence(): void {
    if (this.phase === 'done') return;
    this.phase = 'showing';
    this.hintRing.visible = false;
    this.say(['הִסְתַּכְּלוּ בְּסֵדֶר...']);
    /* the gentle hint's whole job: replay the sequence SLOWER */
    const gap = this.hintStrength === 'gentle' ? Math.round(this.plan.gapMs * 1.5) : this.plan.gapMs;
    const flashS = Math.round(gap * 0.55) / 1000;
    const cellsForSeq = this.sequence.map((t) => this.cellOfKind(t));
    for (let i = 0; i < cellsForSeq.length; i++) {
      this.anim.after(LEAD_MS + i * gap, () => {
        this.litCell = cellsForSeq[i];
        this.flashT = flashS;
      });
    }
    this.anim.after(LEAD_MS + cellsForSeq.length * gap, () => {
      if (this.phase === 'done') return;
      this.phase = 'input';
      this.inputIndex = 0;
      this.echoTaps = [];
      this.say(['עַכְשָׁיו תּוֹרְכֶם! חַזְרוּ עַל הַסֵּדֶר.']);
    });
  }

  /* ---------- input ---------- */

  onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.phase !== 'input') return false;
    const idx = this.cells.findIndex((c) => Math.hypot(x - c.x, y - c.y) <= HIT_R);
    if (idx < 0) return false;

    this.litCell = idx;
    this.flashT = TAP_FLASH_S;

    const userType = this.cells[idx].kind;
    const expected = this.sequence[this.inputIndex];
    if (isSameIndicator(userType, expected)) {
      this.echoTaps.push(expected);
      this.inputIndex++;
      this.sparkle(this.cells[idx].x, this.cells[idx].y, [colorFor(userType), COLORS.glowSoft]);
      if (this.inputIndex >= this.sequence.length) {
        this.signals.attempt('memory.working', true);
        this.roundComplete();
      }
    } else {
      this.onEchoFail(userType);
    }
    return true;
  }

  private onEchoFail(userType: IndicatorType): void {
    const kind = getErrorKind(this.sequence, this.echoTaps.concat([userType]));
    this.dda.outcome(false); /* wrong echo = a failed attempt (Gate B, unchanged) */
    this.signals.attempt('memory.working', false);
    this.signals.errorKind('memory.working', kind);

    this.consecutiveMiss++;
    this.hintStrength = this.suggestHint(this.consecutiveMiss);
    if (this.hintStrength !== 'none') this.signals.hintUsed('memory.working');
    if (this.hintStrength === 'show') this.showBadges();

    this.say([this.lineFor(kind)]);
    this.phase = 'idle';
    this.anim.after(REPLAY_DELAY_MS, () => this.playSequence());
  }

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

  /* ---------- round boundary (Gate B: the only outcome(true)) ---------- */

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.46);
    this.consecutiveMiss = 0;
    this.hintStrength = 'none';
    this.clearBadges();
    this.hintRing.visible = false;
    this.dda.outcome(true, 1);
    if (this.round >= this.totalRounds) {
      this.win();
    } else {
      this.round++;
      this.say(['וָאו! הַסֵּדֶר גָּדַל! בּוֹאוּ נִזְכֹּר אוֹתוֹ.']);
      this.phase = 'idle';
      this.anim.after(NEXT_ROUND_MS, () => this.startRound());
    }
  }

  private win(): void {
    this.phase = 'done';
    this.say([this.ctx.spec?.narrative.win ?? 'וָאו, כָּל הַכָּבוֹד! זָכַרְתָּ אֶת כָּל הַסְּדָרִים!']);
    this.finish(2400);
  }

  /* ---------- visible hint ladder ---------- */

  private showBadges(): void {
    this.clearBadges();
    for (let i = 0; i < this.sequence.length; i++) {
      const cell = this.cells[this.cellOfKind(this.sequence[i])];
      const bg = new Graphics();
      bg.circle(0, 0, 13).fill({ color: 0xfff3dc, alpha: 0.95 });
      bg.x = cell.x + 44;
      bg.y = cell.y - 44;
      const badge = this.label(String(i + 1), 16, 0x3a2a55, '800');
      badge.x = bg.x;
      badge.y = bg.y;
      this.board.addChild(bg, badge);
      this.badges.push({ bg, text: badge });
    }
  }

  private clearBadges(): void {
    for (const badge of this.badges) {
      badge.bg.destroy();
      badge.text.destroy();
    }
    this.badges = [];
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;

    /* lit-cell flash */
    if (this.flashT > 0) {
      this.flashT -= dtMs / 1000;
      if (this.flashT <= 0) this.litCell = -1;
    }
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].glow.visible = i === this.litCell;
    }

    /* idle bobbing per the playback ladder */
    const bobAmp = this.plan.bobAmp;
    if (bobAmp > 0) {
      const offset = Math.sin((this.t / this.plan.bobPeriodMs) * Math.PI * 2) * bobAmp;
      for (const cell of this.cells) cell.plate.y = cell.baseY + offset;
    }

    /* clear hint: pulsing pink ring on the next-needed cell */
    if (this.phase === 'input' && this.hintStrength === 'clear') {
      const next = this.cells[this.cellOfKind(this.sequence[this.inputIndex])];
      if (next) {
        this.hintRing.visible = true;
        this.hintRing.x = next.x;
        this.hintRing.y = next.y;
        const pulse = 0.55 + 0.35 * Math.sin(this.t / 180);
        this.hintRing.alpha = pulse;
        this.hintRing.scale.set(1 + 0.06 * Math.sin(this.t / 180));
      }
    } else if (this.phase !== 'input') {
      this.hintRing.visible = false;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'sequence-echo',
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.phase,
      sequence: this.sequence.map((k) => ({ shape: k.shape, tone: k.tone })),
      echoCount: this.inputIndex,
      hint: this.hintStrength,
      done: this.isFinished(),
      cells: this.cells.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), shape: c.kind.shape, tone: c.kind.tone })),
    };
  }
}
