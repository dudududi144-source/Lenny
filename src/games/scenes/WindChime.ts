import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { CHIME_COUNT, melodyFor, echoComplete } from '../logic/windChime';

const PLATE = 0x1a2440;
const EDGE = 0x3a4c78;
const WOOD = 0x8a6a48;

interface Chime {
  index: number;
  root: Container;
  glow: Sprite;
  baseY: number;
  phase: number;
}

/**
 * WindChime — "פַּעֲמוֹנֵי הָרוּחַ".
 *
 * Six chimes hang from a wooden bar, all identical to the eye and
 * tuned a step apart for the ear. The wind hums a melody; the child
 * echoes it. A miss replays the melody SLOWER (the gentle hint IS
 * the tempo). Pure auditory working memory — no colors, no shapes.
 */
export class WindChimeScene extends GameScene {
  private board = new Container();
  private chimes: Chime[] = [];
  private melody: number[] = [];
  private input: number[] = [];
  private phase: 'idle' | 'showing' | 'input' | 'done' = 'idle';
  private round = 1;
  private totalRounds = 3;
  private consecutiveMiss = 0;
  private litIndex = -1;
  private flashT = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'music';
    this.root.addChild(this.board);
    this.buildBar();
    this.buildChimes();
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 3;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('הַחזִירוּ אֶת הַמֶּלוֹדְיָה');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הָרוּחַ מְנַגֶּנֶת בַּפַּעֲמוֹנִים.', 'הַקְשִׁיבוּ... וְהַחֲזִירוּ אֶת הַמֶּלוֹדְיָה!'],
    );
    this.anim.after(1300, () => this.startRound());
  }

  private buildBar(): void {
    const bar = new Graphics();
    const w = Math.min(this.w * 0.86, 380);
    bar.roundRect(this.w / 2 - w / 2, this.h * 0.3 - 14, w, 18, 9).fill({ color: WOOD });
    bar.roundRect(this.w / 2 - w / 2, this.h * 0.3 - 14, w, 18, 9).stroke({ color: 0x6d4f33, width: 2 });
    this.board.addChild(bar);
  }

  private buildChimes(): void {
    const w = Math.min(this.w * 0.86, 380);
    const gap = w / (CHIME_COUNT + 1);
    for (let i = 0; i < CHIME_COUNT; i++) {
      const root = new Container();
      const x = this.w / 2 - w / 2 + gap * (i + 1);
      const baseY = this.h * 0.3 + 66;

      /* the hanging cord */
      const cord = new Graphics();
      cord.moveTo(0, -52).lineTo(0, -18).stroke({ color: 0xcabfa8, width: 2, alpha: 0.7 });
      root.addChild(cord);

      /* the chime: identical brass tube for every index — the EAR decides */
      const tube = new Graphics();
      tube.roundRect(-14, -18, 28, 66, 13).fill({ color: PLATE });
      tube.roundRect(-13, -17, 26, 64, 12).stroke({ color: EDGE, width: 2 });
      tube.ellipse(0, 48, 8, 4).fill({ color: EDGE, alpha: 0.8 });
      root.addChild(tube);
      this.glowOn(tube, COLORS.glow, 0.7, false);

      const glow = new Sprite(softGlowTexture());
      glow.anchor.set(0.5);
      glow.tint = COLORS.glow;
      glow.blendMode = 'add';
      glow.width = 120;
      glow.height = 120;
      glow.visible = false;
      root.addChildAt(glow, 0);

      /* the clapper — taps read wherever the child grabs the tube */
      root.eventMode = 'none';
      root.x = x;
      root.y = baseY;
      root.scale.set(0);
      this.board.addChild(root);
      this.anim.to(root, { scale: 1 }, { durationMs: 420, delayMs: i * 55, ease: ease.outBack });

      this.chimes.push({ index: i, root, glow, baseY, phase: i * 0.9 });
    }
  }

  private startRound(): void {
    if (this.phase === 'done') return;
    this.melody = melodyFor(this.dda.tier(), 100 + this.round * 17);
    this.input = [];
    this.playMelody();
  }

  private playMelody(): void {
    if (this.phase === 'done') return;
    this.phase = 'showing';
    this.say(['הַקְשִׁיבוּ לָרוּחַ...']);
    /* the gentle hint's whole job: the wind repeats SLOWER */
    const gap = this.consecutiveMiss > 0 ? 720 : 460;
    for (let i = 0; i < this.melody.length; i++) {
      this.anim.after(500 + i * gap, () => {
        if (this.tornDown || this.phase === 'done') return;
        this.litIndex = this.melody[i];
        this.flashT = 0.34;
        audio.play('chime', this.melody[i]);
      });
    }
    this.anim.after(500 + this.melody.length * gap, () => {
      if (this.tornDown || this.phase === 'done') return;
      this.phase = 'input';
      this.input = [];
      this.say(['עַכְשָׁו תּוֹרְכֶם — הַחֲזִירוּ אֶת הַמֶּלוֹדְיָה.']);
    });
  }

  override onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.phase !== 'input') return false;
    let best = -1;
    let bestD = Infinity;
    for (const c of this.chimes) {
      const d = Math.hypot(x - c.root.x, y - c.root.y);
      if (d < bestD) {
        bestD = d;
        best = c.index;
      }
    }
    if (best < 0 || bestD > 58) return false;

    this.litIndex = best;
    this.flashT = 0.3;
    audio.play('chime', best);

    if (best === this.melody[this.input.length]) {
      this.input.push(best);
      this.score.hit(12, { x: this.chimes[best].root.x, y: this.chimes[best].root.y });
      this.sparkle(this.chimes[best].root.x, this.chimes[best].root.y, [COLORS.glow, COLORS.glowSoft]);
      if (echoComplete(this.input, this.melody)) {
        this.signals.attempt('memory.working', true);
        this.roundComplete();
      }
    } else {
      this.onEchoMiss();
    }
    return true;
  }

  private onEchoMiss(): void {
    this.dda.outcome(false);
    this.signals.attempt('memory.working', false);
    this.score.miss({ x: this.w / 2, y: this.h * 0.45 });
    audio.play('softError');
    this.consecutiveMiss++;
    /* failure-free: the wind simply sings it again, slower */
    this.say(['כִּמְעַט! הָרוּחַ תְּנַגֵּן לְאַט יוֹתֵר.']);
    this.phase = 'idle';
    this.anim.after(900, () => this.playMelody());
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.42);
    this.consecutiveMiss = 0;
    this.dda.outcome(true, 1);
    audio.play('combo', Math.min(4, this.round));
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.phase = 'done';
      this.fx.announce('נְגִינַת הָרוּחַ!', { y: this.h * 0.28, w: this.w, durMs: 1800 });
      /* the finale: the whole melody sings once more, then home */
      const gap = 430;
      this.melody.forEach((idx, i) => {
        this.anim.after(1000 + i * gap, () => {
          if (this.tornDown) return;
          this.litIndex = idx;
          this.flashT = 0.4;
          audio.play('chime', idx);
          this.sparkle(this.chimes[idx].root.x, this.chimes[idx].root.y, [COLORS.glow]);
        });
      });
      this.anim.after(1000 + this.melody.length * gap + 400, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'הָרוּחַ מְרִיעָה!' });
      });
    } else {
      this.round++;
      this.phase = 'idle';
      this.anim.after(1200, () => this.startRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    if (this.flashT > 0) {
      this.flashT -= dtMs / 1000;
      if (this.flashT <= 0) {
        this.flashT = 0;
        this.litIndex = -1;
      }
    }
    for (const c of this.chimes) {
      if (c.root.destroyed) continue;
      const lit = c.index === this.litIndex;
      c.glow.visible = lit;
      c.glow.alpha = lit ? 0.55 + 0.4 * Math.sin(this.t / 70) : 0.12;
      /* chimes sway after being struck — a soft pendulum */
      const swing = lit ? Math.sin(this.t / 55) * 0.06 : Math.sin(this.t / 900 + c.phase) * 0.015;
      c.root.rotation = swing;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'wind-chime',
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.phase,
      melodyLength: this.melody.length,
      /* the melody itself — the e2e drives real taps from it (the
         sequence-echo precedent: the answer key is observable) */
      melody: this.melody.slice(),
      echoCount: this.input.length,
      done: this.isFinished(),
      chimes: this.chimes.map((c) => ({ index: c.index, x: Math.round(c.root.x), y: Math.round(c.root.y) })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
