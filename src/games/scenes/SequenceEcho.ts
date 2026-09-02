import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  ALL_INDICATOR_TYPES,
  buildSequenceTypes,
  colorFor,
  getErrorKind,
  isSameIndicator,
  sequencePlanFor,
  type IndicatorType,
  type SequencePlan,
} from '../fx/IndicatorTypes';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture, ringTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { music } from '../../audio/MusicEngine';

const LEAD_MS = 500;
const REPLAY_DELAY_MS = 900;
const NEXT_ROUND_MS = 1100;
const FIRST_ROUND_DELAY_MS = 1400;
const HIT_R = 56;

const PLATE_HEX = 0x1c2340;
const PLATE_EDGE_HEX = 0x3d4877;
const HINT_GLOW_HEX = 0xff8ad9;

/* crystal choir pitches — a soft pentatonic ladder */
const CRYSTAL_PITCHES = [329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

interface EchoCell {
  x: number;
  y: number;
  baseY: number;
  kind: IndicatorType;
  plate: Container;
  glow: Sprite;
  phase: number;
  pitch: number;
}

/**
 * SequenceEcho v3 — "מַקְהֶלֶת הָאוֹר" (Arena commercial rebuild).
 *
 * DDA contract unchanged (Stage 2c): sequencePlanFor drives length,
 * pacing and the bobbing-distraction axis; buildSequenceTypes drives
 * kind similarity; wrong echo = dda.outcome(false); round complete =
 * outcome(true, 1); the gentle hint replays slower; the show hint
 * badges the sequence. The Arena layer adds:
 *
 * - a crystal choir: six singing crystals with procedural tones,
 *   living bob, glow halos and flash rings
 * - the melody path: a light beam draws itself from crystal to
 *   crystal during playback — the child watches the melody move
 * - echo rewards: every correct tap sings its tone, floats +N and
 *   builds combo chains; clean full echoes celebrate
 * - the concert finale: after the last round, the choir replays the
 *   longest melody as a song with fireworks, then the ceremony
 */
export class SequenceEchoScene extends GameScene {
  private cells: EchoCell[] = [];
  private totalRounds = 3;
  private round = 1;
  private plan: SequencePlan = sequencePlanFor(0);
  private sequence: IndicatorType[] = [];
  private inputIndex = 0;
  private echoTaps: IndicatorType[] = [];
  private phase: 'idle' | 'showing' | 'input' | 'done' = 'idle';
  private hintStrength: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private consecutiveMiss = 0;
  private litCell = -1;
  private flashT = 0;
  private badges: Array<{ bg: Graphics; text: Text }> = [];
  private hintRing: Sprite;
  private board = new Container();
  private melodyPath: Graphics;
  private bestSequence: IndicatorType[] = [];
  private longestEcho = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'music'; /* the crystal choir sings in its own language */
    this.root.addChild(this.board);

    this.melodyPath = new Graphics();
    this.melodyPath.eventMode = 'none';
    this.board.addChildAt(this.melodyPath, 0);

    /* the choir: six singing crystals (every kind always present —
       the keys stay put, the MELODY is what the DDA composes) */
    const kinds = ALL_INDICATOR_TYPES.slice();
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const colX = [this.w * 0.2, this.w * 0.5, this.w * 0.8];
    const rowY = [this.h * 0.36, this.h * 0.58];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        this.cells.push(this.buildCell(colX[c], rowY[r], kinds[r * 3 + c], r * 3 + c));
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

    audio.startMusic();
    this.build();
  }

  private buildCell(x: number, y: number, kind: IndicatorType, order: number): EchoCell {
    const plate = new Container();

    const glass = new Graphics();
    glass.roundRect(-52, -34, 104, 68, 18).fill({ color: PLATE_HEX });
    glass.roundRect(-50, -32, 100, 64, 16).stroke({ color: PLATE_EDGE_HEX, width: 2 });
    /* crystal facet lines */
    glass.moveTo(-18, -32).lineTo(-26, 32).stroke({ color: PLATE_EDGE_HEX, width: 1, alpha: 0.55 });
    glass.moveTo(20, -32).lineTo(28, 32).stroke({ color: PLATE_EDGE_HEX, width: 1, alpha: 0.55 });
    plate.addChild(glass);

    const color = colorFor(kind);
    const g = new Graphics();
    if (kind.shape === 'orb') {
      g.circle(0, 0, 15).fill({ color });
      g.circle(0, 0, 9).stroke({ color: PLATE_HEX, width: 2, alpha: 0.85 });
      g.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.95 });
    } else if (kind.shape === 'chime') {
      g.moveTo(-13, -16).lineTo(13, -16).lineTo(5, 8).lineTo(-5, 8).closePath().fill({ color });
      g.circle(0, 15, 4.5).fill({ color });
    } else {
      g.ellipse(0, 0, 10, 19).fill({ color });
      g.moveTo(0, -16).lineTo(0, 16).stroke({ color: PLATE_HEX, width: 2.4, alpha: 0.9 });
      g.moveTo(-6, -4).lineTo(-9, 2).moveTo(6, -2).lineTo(9, 5).stroke({ color: PLATE_HEX, width: 1.6, alpha: 0.7 });
    }
    if (kind.tone === 'muted') g.alpha = 0.8;
    plate.addChild(g);
    /* Stage 5: every singing crystal carries its tone-colored glow */
    this.glowOn(g, color, 1.1, false);

    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = color;
    glow.blendMode = 'add';
    glow.width = 130;
    glow.height = 100;
    glow.visible = false;
    plate.addChildAt(glow, 0);

    plate.x = x;
    plate.y = y;
    plate.scale.set(0);
    this.board.addChild(plate);
    this.anim.to(plate, { scale: 1 }, { durationMs: 460, delayMs: order * 60, ease: ease.outBack });

    return { x, y, baseY: y, kind, plate, glow, phase: Math.random() * Math.PI * 2, pitch: CRYSTAL_PITCHES[order % CRYSTAL_PITCHES.length] };
  }

  protected build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 3;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('חַזְרִי עַל הַסֵּדֶר');
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
    this.melodyPath.clear();
    this.say(['הִסְתַּכְּלוּ בְּסֵדֶר...']);
    /* the gentle hint's whole job: replay the sequence SLOWER */
    const gap = this.hintStrength === 'gentle' ? Math.round(this.plan.gapMs * 1.5) : this.plan.gapMs;
    const flashS = Math.round(gap * 0.55) / 1000;
    const cellsForSeq = this.sequence.map((t) => this.cellOfKind(t));
    for (let i = 0; i < cellsForSeq.length; i++) {
      this.anim.after(LEAD_MS + i * gap, () => {
        this.litCell = cellsForSeq[i];
        this.flashT = flashS;
        audio.play('tick');
        /* Stage 6: every crystal IS a scale note — the playback sings */
        music.playEchoNote(cellsForSeq[i]);
        /* draw the melody path segment */
        if (i > 0) this.drawPathSegment(cellsForSeq[i - 1], cellsForSeq[i]);
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

  private drawPathSegment(fromIdx: number, toIdx: number): void {
    const a = this.cells[fromIdx];
    const b = this.cells[toIdx];
    if (!a || !b) return;
    this.melodyPath.moveTo(a.x, a.baseY).quadraticCurveTo((a.x + b.x) / 2, Math.min(a.baseY, b.baseY) - 46, b.x, b.baseY);
    this.melodyPath.stroke({ color: COLORS.glow, width: 3.5, alpha: 0.55, cap: 'round' });
  }

  /* ---------- input ---------- */

  override onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.phase !== 'input') return false;
    const idx = this.cells.findIndex((c) => Math.hypot(x - c.x, y - c.y) <= HIT_R);
    if (idx < 0) return false;

    this.litCell = idx;
    this.flashT = 0.3;
    /* Stage 6: the echo tap rings the SAME note the playback sang —
       correct sound = correct note, the hint is the harmony itself */
    music.playEchoNote(idx);

    const userType = this.cells[idx].kind;
    const expected = this.sequence[this.inputIndex];
    if (isSameIndicator(userType, expected)) {
      this.echoTaps.push(expected);
      this.inputIndex++;
      this.score.hit(12, { x: this.cells[idx].x, y: this.cells[idx].y });
      this.sparkle(this.cells[idx].x, this.cells[idx].y, [colorFor(userType), COLORS.glowSoft]);
      /* extend the child's melody path */
      if (this.inputIndex >= 2) {
        const prevIdx = this.cellOfKind(this.sequence[this.inputIndex - 2]);
        if (prevIdx >= 0) this.drawPathSegment(prevIdx, idx);
      }
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
    this.score.miss({ x: this.cells[this.cellOfKind(userType)]?.x ?? this.w / 2, y: this.h * 0.5 });
    audio.play('softError');

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
        return 'מִסְפַּר הַצְּעָדִים שׁוֹנֶה';
      default:
        return 'זֶה לֹא הָאִינְדִיקָטוֹר הַנָּכוֹן';
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
    audio.play('combo', Math.min(4, this.round));

    if (this.sequence.length > this.bestSequence.length) this.bestSequence = this.sequence.slice();
    this.longestEcho = Math.max(this.longestEcho, this.sequence.length);

    if (this.round >= this.totalRounds) {
      this.concertFinale();
    } else {
      this.round++;
      this.say(['וָאו! הַסֵּדֶר גָּדַל! בּוֹאוּ נִזְכֹּר אוֹתוֹ.']);
      this.phase = 'idle';
      this.anim.after(NEXT_ROUND_MS, () => this.startRound());
    }
  }

  /** The concert: the choir replays the longest melody as a song. */
  private concertFinale(): void {
    this.phase = 'done';
    this.fx.announce('הַקוֹנְצֶרְט!', { y: this.h * 0.3, w: this.w, sub: 'הַמַּקְהֶלֶת שָׁרָה אֶת הַמֶּלּוֹדְיָה שֶׁלָּךְ', durMs: 2200 });
    const song = this.bestSequence.length ? this.bestSequence : this.sequence;
    const cellIdx = song.map((t) => this.cellOfKind(t)).filter((i) => i >= 0);
    this.melodyPath.clear();
    const gap = 460;
    cellIdx.forEach((idx, i) => {
      this.anim.after(1200 + i * gap, () => {
        if (this.tornDown) return;
        this.litCell = idx;
        this.flashT = 0.4;
        audio.play('chime', idx % 4);
        this.sparkle(this.cells[idx].x, this.cells[idx].y, [colorFor(this.cells[idx].kind), COLORS.glow]);
        if (i > 0) this.drawPathSegment(cellIdx[i - 1], idx);
        if (i === cellIdx.length - 1) {
          this.anim.after(gap, () => {
            if (this.tornDown) return;
            bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
            this.fx.sparkleRain(this.particles, this.w);
            audio.play('fanfare');
            this.finishWithCeremony({ title: 'הַמַּקְהֶלֶת מְרִיעָה!' });
          });
        }
      });
    });
    if (cellIdx.length === 0) {
      this.finishWithCeremony({ title: 'הַמַּקְהֶלֶת מְרִיעָה!' });
    }
  }

  /* ---------- visible hint ladder ---------- */

  private showBadges(): void {
    this.clearBadges();
    for (let i = 0; i < this.sequence.length; i++) {
      const cellIdx = this.cellOfKind(this.sequence[i]);
      if (cellIdx < 0) continue;
      const cell = this.cells[cellIdx];
      const bg = new Graphics();
      bg.circle(0, 0, 13).fill({ color: 0xfff3dc, alpha: 0.95 });
      bg.circle(0, 0, 13).stroke({ color: HINT_GLOW_HEX, width: 2 });
      const text = new Text({
        text: String(i + 1),
        style: { fontFamily: 'Heebo, sans-serif', fontSize: 15, fontWeight: '800', fill: 0x1c1430 },
      });
      text.anchor.set(0.5);
      text.resolution = 2;
      bg.x = cell.x;
      bg.y = cell.baseY - 50;
      text.x = bg.x;
      text.y = bg.y;
      this.board.addChild(bg, text);
      this.badges.push({ bg, text });
    }
  }

  private clearBadges(): void {
    for (const b of this.badges) {
      b.bg.destroy();
      b.text.destroy();
    }
    this.badges = [];
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;

    /* flash decay */
    if (this.flashT > 0) {
      this.flashT -= dtMs / 1000;
      if (this.flashT <= 0) {
        this.flashT = 0;
        this.litCell = -1;
      }
    }
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.plate.destroyed) continue;
      c.glow.visible = i === this.litCell;
      const bobAmp = this.plan.bobAmp;
      c.plate.y = c.baseY + Math.sin((this.t / this.plan.bobPeriodMs) * Math.PI * 2 + c.phase) * bobAmp;
      c.glow.alpha = i === this.litCell ? 0.5 + 0.5 * Math.sin(this.t / 90) : 0.18 + 0.1 * Math.sin(this.t / 500 + c.phase);
    }

    /* hint ring on 'clear' pulses around the first sequence cell */
    if (this.hintStrength === 'clear' && this.phase !== 'done') {
      const first = this.cellOfKind(this.sequence[0]);
      if (first >= 0) {
        this.hintRing.visible = true;
        this.hintRing.x = this.cells[first].x;
        this.hintRing.y = this.cells[first].baseY;
        this.hintRing.alpha = 0.55 + 0.35 * Math.sin(this.t / 180);
      }
    } else if (this.hintRing.visible && this.hintStrength !== 'clear') {
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
      done: this.isFinished(), /* the concert plays before the real finish */
      cells: this.cells.map((c) => ({ x: Math.round(c.x), y: Math.round(c.plate.y), shape: c.kind.shape, tone: c.kind.tone })),
    };
  }

  destroy(): void {
    super.destroy();
  }
}
