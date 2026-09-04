import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { bubbleMsFor, croakEveryFor, frogPadFor, padLayoutFor, type PadLayout } from '../logic/soundHunt';
import { speak } from './speak';

const PAD = 0x3f7d4e;
const PAD_DARK = 0x2c5c39;
const PAD_RIPPLE = 0x8fe0a8;
const FROG = 0x7fd35c;

interface Pad {
  index: number;
  root: Container;
  body: Graphics;
  padGlow: Sprite;
  bubble: Graphics;
  frog: Container;
  x: number;
  y: number;
  lift: number;
}

/**
 * SoundHunt — "אֵיפֹה הַצָּפְרְדֵּעַ?".
 *
 * A frog hides under one of the pond's lily pads. Every few seconds
 * it CROAKS — and the pad it hides under bubbles for a moment (the
 * eye confirms what the ear heard). Tap the bubbling pad: the frog
 * pops up, delighted, and hops to a new hiding place. An empty pad
 * just lifts and settles — no frog, no fail. The rung shrinks the
 * bubble's visibility and adds pads; patience is the whole skill.
 */
export class SoundHuntScene extends GameScene {
  private board = new Container();
  private pads: Pad[] = [];
  private pondLayout: PadLayout = { n: 0, pads: [] };
  private frogPad = 0;
  private round = 1;
  private totalRounds = 4;
  private done = false;
  private bubbleT = 0;         /* seconds left in the current bubble */
  private croakAcc = 0;
  private revealed = false;    /* frog is out celebrating this round */
  private roundSeed = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'music';
    this.root.addChild(this.board);
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 4;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('מִי קוֹרֵא? גְּעוּ בַּפַּרְפַּרְעָן שֶׁלָּהּ');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['צָפְרְדֵּעַ מִתְחַבֵּא בַּבְּרֵכָה.', 'הַקְשִׁיבוּ לַקּוֹרֵא... וּגְעוּ בָּעָלֶה שֶׁמְּבַעְבַּעַ!'],
    );
    this.dealRound();
  }

  private dealRound(): void {
    for (const p of this.pads) if (!p.root.destroyed) p.root.destroy({ children: true });
    this.pads = [];
    this.bubbleT = 0;
    this.croakAcc = 0;
    this.revealed = false;

    /* deterministic in (tier, round): the same pond on every device */
    this.roundSeed = 500 + this.round * 53;
    this.pondLayout = padLayoutFor(this.dda.tier(), this.roundSeed);
    this.frogPad = frogPadFor(this.pondLayout.n, this.roundSeed);

    const gx = this.w * 0.14;
    const gy = this.h * 0.34;
    const gw = this.w * 0.72;
    const gh = this.h * 0.5;
    for (let i = 0; i < this.pondLayout.n; i++) {
      this.buildPad(i, gx + this.pondLayout.pads[i].x * gw, gy + this.pondLayout.pads[i].y * gh);
    }
  }

  private buildPad(index: number, x: number, y: number): void {
    const root = new Container();
    const body = new Graphics();
    /* a big lily pad with a notch — ≈76px across, well over the 44px floor */
    body.ellipse(0, 0, 38, 30).fill({ color: PAD });
    body.ellipse(0, 0, 38, 30).stroke({ color: PAD_DARK, width: 2.5 });
    body.moveTo(0, 0).lineTo(38, -8).stroke({ color: PAD_DARK, width: 2.5 });
    root.addChild(body);
    this.glowOn(body, PAD_RIPPLE, 0.5, false);

    const padGlow = new Sprite(softGlowTexture());
    padGlow.anchor.set(0.5);
    padGlow.tint = PAD_RIPPLE;
    padGlow.blendMode = 'add';
    padGlow.width = 150;
    padGlow.height = 150;
    padGlow.alpha = 0.25;
    root.addChildAt(padGlow, 0);

    /* the frog's bubble hint — drawn only while it croaks */
    const bubble = new Graphics();
    bubble.circle(-12, -34, 7).fill({ color: 0xdfffe8, alpha: 0.85 });
    bubble.circle(2, -44, 4).fill({ color: 0xdfffe8, alpha: 0.7 });
    bubble.circle(10, -32, 3).fill({ color: 0xdfffe8, alpha: 0.6 });
    bubble.visible = false;
    root.addChild(bubble);

    /* the frog itself — hidden until found */
    const frog = new Container();
    const fg = new Graphics();
    fg.ellipse(0, 4, 26, 18).fill({ color: FROG });
    fg.circle(-10, -10, 7).fill({ color: 0xffffff });
    fg.circle(10, -10, 7).fill({ color: 0xffffff });
    fg.circle(-10, -10, 3).fill({ color: 0x1c2a14 });
    fg.circle(10, -10, 3).fill({ color: 0x1c2a14 });
    fg.moveTo(-8, 8).quadraticCurveTo(0, 14, 8, 8).stroke({ color: 0x4a7a34, width: 2 });
    frog.addChild(fg);
    frog.y = 6;
    frog.visible = false;
    root.addChild(frog);

    root.x = x;
    root.y = y;
    root.scale.set(0);
    this.board.addChild(root);
    this.anim.to(root, { scale: 1 }, { durationMs: 430, delayMs: index * 70, ease: ease.outBack });

    this.pads.push({ index, root, body, padGlow, bubble, frog, x, y, lift: 0 });
  }

  /* ---------- the croak loop ---------- */

  private croak(): void {
    if (this.done || this.revealed) return;
    const pad = this.pads[this.frogPad];
    if (!pad) return;
    audio.play('croak', this.round % 3);
    this.bubbleT = bubbleMsFor(this.dda.tier()) / 1000;
    pad.bubble.visible = true;
  }

  override onTap(x: number, y: number): boolean {
    if (this.done || this.revealed) return false;
    for (const p of this.pads) {
      if (Math.hypot(x - p.x, y - p.y) > 48) continue;
      if (p.index === this.frogPad) {
        this.found(p);
      } else {
        this.empty(p);
      }
      return true;
    }
    this.ripple(x, y, 0x5f8fa8);
    return false;
  }

  private found(p: Pad): void {
    this.revealed = true;
    this.bubbleT = 0;
    for (const q of this.pads) q.bubble.visible = false;
    p.frog.visible = true;
    p.frog.scale.set(0);
    p.frog.y = 6;
    this.anim.to(p.frog, { scale: 1.15 }, {
      durationMs: 380,
      ease: ease.outBack,
      onDone: () => this.anim.to(p.frog, { scale: 1 }, { durationMs: 200, ease: ease.outCubic }),
    });
    /* the victory hop: up, then a happy landing */
    this.anim.to(p.frog, { y: -26 }, {
      durationMs: 300,
      delayMs: 260,
      ease: ease.outQuad,
      onDone: () => this.anim.to(p.frog, { y: 6 }, { durationMs: 340, ease: ease.outBounce }),
    });
    this.score.hit(14, { x: p.x, y: p.y });
    this.sparkle(p.x, p.y - 20, [PAD_RIPPLE, COLORS.glowSoft]);
    audio.play('combo', Math.min(4, this.round));
    speak('מָצָאתֶם אוֹתִי!');
    this.signals.attempt('attention.auditory', true);
    this.roundComplete();
  }

  private empty(p: Pad): void {
    /* an empty pad lifts, shrugs, settles — the frog giggles elsewhere */
    this.anim.to(p.root, { y: p.y - 10 }, { durationMs: 130, ease: ease.outQuad, onDone: () => this.anim.to(p.root, { y: p.y }, { durationMs: 260, ease: ease.outBack }) });
    audio.play('splash');
    this.score.miss({ x: p.x, y: p.y });
    this.dda.outcome(false);
    this.signals.attempt('attention.auditory', false);
    /* the honest hint: the frog croaks again right away */
    this.croakAcc = Math.max(0, croakEveryFor(this.dda.tier()) - 900);
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
    this.dda.outcome(true, 1);
    this.fx.announce('הַצָּפְרְדֵּעַ נִמְצָא!', { y: this.h * 0.16, w: this.w, durMs: 1500 });
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(1400, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'הַבְּרֵכָה מְרִיעָה!' });
      });
    } else {
      this.round++;
      this.anim.after(1600, () => this.dealRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown || this.done) return;
    const dt = dtMs / 1000;

    /* the bubble countdown */
    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 0;
        for (const q of this.pads) q.bubble.visible = false;
      } else {
        const pad = this.pads[this.frogPad];
        if (pad) {
          const k = this.bubbleT;
          pad.bubble.alpha = Math.min(1, k * 3);
          pad.bubble.y = -Math.sin((1 - k) * Math.PI) * 6;
        }
      }
    }

    /* the croak heartbeat */
    if (!this.revealed) {
      this.croakAcc += dtMs;
      const every = croakEveryFor(this.dda.tier());
      if (this.croakAcc >= every) {
        this.croakAcc = 0;
        this.croak();
      }
    }

    /* pads bob gently; the frog pad glows faintly only while bubbling */
    for (const p of this.pads) {
      if (p.root.destroyed) continue;
      p.body.y = Math.sin(this.t / 650 + p.index * 1.4) * 3;
      p.padGlow.alpha = p.index === this.frogPad && this.bubbleT > 0 ? 0.5 : 0.22;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'sound-hunt',
      round: this.round,
      totalRounds: this.totalRounds,
      done: this.done || this.isFinished(),
      revealed: this.revealed,
      /* the e2e taps the frog pad directly (the wind-chime precedent:
         the answer key is observable through the bridge only) */
      frogPad: this.frogPad,
      bubblePad: this.bubbleT > 0 ? this.frogPad : -1,
      pads: this.pads.map((p) => ({ index: p.index, x: Math.round(p.x), y: Math.round(p.y) })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
