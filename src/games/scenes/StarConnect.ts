import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { starFieldFor, NUMERAL_NAMES, type StarField } from '../logic/starConnect';
import { speak } from './speak';

const STAR_HEX = 0xffe08a;
const LINE_HEX = 0xffd76a;

interface Star {
  n: number; /* the numeral it wears (1-based) */
  root: Container;
  glow: Sprite;
  reached: boolean;
}

/**
 * StarConnect — "קִשּׁוּר הַכּוֹכָבִים".
 *
 * Stars wear the numerals 1..N over the night sky. Tap them in
 * counting order: every hit sings its number and threads a golden
 * line to the next star, until a constellation closes and the sky
 * celebrates. Numeral order as a spatial journey.
 */
export class StarConnectScene extends GameScene {
  private board = new Container();
  private lines: Graphics;
  private stars: Star[] = [];
  private field: StarField = { n: 0, stars: [] };
  private picked = 0;
  private round = 1;
  private totalRounds = 3;
  private consecutiveMiss = 0;
  private hint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private done = false;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'night';
    this.root.addChild(this.board);
    this.lines = new Graphics();
    this.board.addChild(this.lines);
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 3;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('קִשְׁרוּ 1 → 2 → 3...');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הַכּוֹכָבִים מְמַתְנִים בִּמְסִפָּר.', 'גַּעוּ בָּהֶן בַּסֵּדֶר — 1, 2, 3!'],
    );
    this.dealRound();
  }

  private dealRound(): void {
    this.picked = 0;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.lines.clear();
    for (const s of this.stars) if (!s.root.destroyed) s.root.destroy({ children: true });
    this.stars = [];

    /* the field is deterministic in (tier, round): the same sky on
       every device, the constellation redrawn each round */
    this.field = starFieldFor(this.dda.tier(), 700 + this.round * 31);
    const gx = this.w * 0.1;
    const gy = this.h * 0.3;
    const gw = this.w * 0.8;
    const gh = this.h * 0.52;
    for (let i = 0; i < this.field.n; i++) {
      this.buildStar(i + 1, gx + this.field.stars[i].x * gw, gy + this.field.stars[i].y * gh);
    }
  }

  private buildStar(n: number, x: number, y: number): void {
    const root = new Container();
    const g = new Graphics();
    /* a five-point star, big and grabable */
    const R = 30;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? R : R * 0.46;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath().fill({ color: STAR_HEX });
    g.circle(0, 0, R).stroke({ color: 0xfff3c4, width: 2, alpha: 0.5 });
    root.addChild(g);
    this.glowOn(g, STAR_HEX, 1.1, false);

    const num = this.label(String(n), 24, 0x241a05, '800');
    root.addChild(num);

    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = STAR_HEX;
    glow.blendMode = 'add';
    glow.width = 140;
    glow.height = 140;
    glow.visible = false;
    root.addChildAt(glow, 0);

    root.x = x;
    root.y = y;
    root.scale.set(0);
    this.board.addChild(root);
    this.anim.to(root, { scale: 1 }, { durationMs: 430, delayMs: n * 60, ease: ease.outBack });

    this.stars.push({ n, root, glow, reached: false });
  }

  private drawThread(fromStar: Star, toStar: Star): void {
    this.lines.moveTo(fromStar.root.x, fromStar.root.y)
      .lineTo(toStar.root.x, toStar.root.y)
      .stroke({ color: LINE_HEX, width: 3.5, alpha: 0.75, cap: 'round' });
  }

  override onTap(x: number, y: number): boolean {
    if (this.done) return false;
    for (const s of this.stars) {
      if (s.reached) continue;
      if (Math.hypot(x - s.root.x, y - s.root.y) > 54) continue;
      if (s.n === this.picked + 1) {
        this.hitStar(s);
      } else {
        this.missStar(s);
      }
      return true;
    }
    return false;
  }

  private hitStar(s: Star): void {
    s.reached = true;
    this.picked++;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.score.hit(12, { x: s.root.x, y: s.root.y });
    this.sparkle(s.root.x, s.root.y, [STAR_HEX, COLORS.glowSoft]);
    audio.play('star', Math.min(5, s.n - 1));
    speak(NUMERAL_NAMES[s.n - 1] ?? String(s.n));
    const prev = this.stars.find((c) => c.n === s.n - 1);
    if (prev) this.drawThread(prev, s);
    if (this.picked >= this.field.n) {
      this.signals.attempt('logic.ordering', true);
      this.roundComplete();
    }
  }

  private missStar(s: Star): void {
    this.dda.outcome(false);
    this.signals.attempt('logic.ordering', false);
    this.score.miss({ x: s.root.x, y: s.root.y });
    audio.play('softError');
    this.consecutiveMiss++;
    this.hint = this.suggestHint(this.consecutiveMiss);
    if (this.hint !== 'none') this.signals.hintUsed('logic.ordering');
    const want = NUMERAL_NAMES[this.picked] ?? String(this.picked + 1);
    this.say([`מַתְנִים לְ${want}...`]);
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
    this.dda.outcome(true, 1);
    audio.play('combo', Math.min(4, this.round));
    this.fx.announce('קְבוּצַת כּוֹכָבִים!', { y: this.h * 0.22, w: this.w, durMs: 1500 });
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(1100, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'הַשָּׁמַיִם שֶׁלְּךָ!' });
      });
    } else {
      this.round++;
      this.anim.after(1600, () => this.dealRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    for (const s of this.stars) {
      if (s.root.destroyed) continue;
      const next = s.n === this.picked + 1;
      /* the hint ladder: the needed star pulses at 'clear', holds at 'show' */
      const hinting = (this.hint === 'clear' || this.hint === 'show') && next;
      s.glow.visible = hinting || (next && this.t % 2000 < 400);
      s.glow.alpha = 0.3 + 0.3 * Math.sin(this.t / 150);
      s.root.scale.set(1 + Math.sin(this.t / 500 + s.n) * 0.04);
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'star-connect',
      round: this.round,
      totalRounds: this.totalRounds,
      picked: this.picked,
      total: this.field.n,
      hint: this.hint,
      done: this.done || this.isFinished(),
      stars: this.stars.map((s) => ({ n: s.n, x: Math.round(s.root.x), y: Math.round(s.root.y), reached: s.reached })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
