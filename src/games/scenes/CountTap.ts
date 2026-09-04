import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { acornFieldFor, countWord, isCountComplete, type AcornField } from '../logic/countTap';
import { speak } from './speak';

const ACORN = 0xb98a4a;
const ACORN_DARK = 0x8a5f2e;
const CAP = 0x5d3d1e;
const BASKET = 0x9a6f3f;

interface Acorn {
  index: number;
  root: Container;
  body: Graphics;
  glow: Sprite;
  counted: boolean;
  x: number;
  y: number;
}

/**
 * CountTap — "סְפִירַת בְּלוּטִים".
 *
 * The squirrel's acorns lie scattered in the clearing. Tap each
 * one ONCE to count it: every new acorn sings the next number
 * word ("אַחַת… שְׁתַּיִם…") and hops into the basket. The last
 * number sung is how many there are — order-irrelevant
 * cardinality, with no way to fail. Higher rungs drop more
 * acorns, never harder rules.
 */
export class CountTapScene extends GameScene {
  private board = new Container();
  private acorns: Acorn[] = [];
  private field: AcornField = { n: 0, acorns: [] };
  private counted = 0;
  private round = 1;
  private totalRounds = 3;
  private done = false;
  private basket: Graphics | null = null;
  private basketLabel: Container | null = null;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'forest';
    this.root.addChild(this.board);
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 3;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('גְּעוּ בְּכָל בְּלוּט — וְסִפְרוּ!');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הַסְּנַאי פִּזֵר בְּלוּטִים.', 'גְּעוּ בְּכָל בְּלוּט — אַחַת, שְׁתַּיִם, שָׁלוֹשׁ!'],
    );
    this.dealRound();
  }

  private dealRound(): void {
    this.counted = 0;
    this.buildBasket();
    for (const a of this.acorns) if (!a.root.destroyed) a.root.destroy({ children: true });
    this.acorns = [];

    /* deterministic in (tier, round): the same stash on every device */
    this.field = acornFieldFor(this.dda.tier(), 300 + this.round * 37);
    const gx = this.w * 0.08;
    const gy = this.h * 0.34;
    const gw = this.w * 0.84;
    const gh = this.h * 0.5;
    for (let i = 0; i < this.field.n; i++) {
      this.buildAcorn(i, gx + this.field.acorns[i].x * gw, gy + this.field.acorns[i].y * gh);
    }
  }

  /* the basket the counted acorns hop into — count made visible */
  private buildBasket(): void {
    if (this.basket && !this.basket.destroyed) this.basket.destroy();
    if (this.basketLabel && !this.basketLabel.destroyed) this.basketLabel.destroy();
    const bx = this.w / 2;
    const by = this.h * 0.22;
    const basket = new Graphics();
    basket.ellipse(0, 14, 58, 22).fill({ color: BASKET });
    basket.ellipse(0, 8, 58, 20).fill({ color: 0x7a5330 });
    basket.roundRect(-56, 2, 112, 14, 7).fill({ color: BASKET });
    basket.roundRect(-56, 2, 112, 14, 7).stroke({ color: 0x6d4a28, width: 2 });
    this.board.addChild(basket);
    this.basket = basket;

    const label = new Container();
    const txt = this.label('0', 30, 0xfff3d9, '800');
    txt.y = -18;
    label.addChild(txt);
    label.x = bx;
    label.y = by + 34;
    this.board.addChild(label);
    this.basketLabel = label;
    this.basketLabel.scale.set(0);
    this.anim.to(label, { scale: 1 }, { durationMs: 400, ease: ease.outBack });
  }

  private buildAcorn(index: number, x: number, y: number): void {
    const root = new Container();
    const body = new Graphics();
    /* a plump acorn: cap + nut, big and grabable (≈64px hit) */
    body.ellipse(0, 8, 24, 20).fill({ color: ACORN });
    body.ellipse(0, 8, 24, 20).stroke({ color: ACORN_DARK, width: 2 });
    body.roundRect(-20, -14, 40, 16, 8).fill({ color: CAP });
    body.roundRect(-3, -24, 6, 12, 3).fill({ color: CAP });
    root.addChild(body);
    this.glowOn(body, 0xffd76a, 0.7, false);

    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = 0xffd76a;
    glow.blendMode = 'add';
    glow.width = 120;
    glow.height = 120;
    glow.alpha = 0.35;
    root.addChildAt(glow, 0);

    root.x = x;
    root.y = y;
    root.scale.set(0);
    this.board.addChild(root);
    this.anim.to(root, { scale: 1 }, { durationMs: 420, delayMs: index * 60, ease: ease.outBack });

    this.acorns.push({ index, root, body, glow, counted: false, x, y });
  }

  override onTap(x: number, y: number): boolean {
    if (this.done) return false;
    for (const a of this.acorns) {
      if (Math.hypot(x - a.x, y - a.y) > 44) continue; /* ≥44px hit target */
      if (a.counted) {
        this.wiggle(a);
      } else {
        this.count(a);
      }
      return true;
    }
    /* a tap on the dirt is a heartbeat, not a mistake */
    this.ripple(x, y, 0x9a8a6a);
    return false;
  }

  private wiggle(a: Acorn): void {
    /* a gentle "already counted" shake — information, not punishment */
    this.anim.to(a.root, { rotation: 0.16 }, {
      durationMs: 90,
      ease: ease.outQuad,
      onDone: () => this.anim.to(a.root, { rotation: 0 }, { durationMs: 160, ease: ease.outQuad }),
    });
  }

  private count(a: Acorn): void {
    a.counted = true;
    this.counted++;
    const n = this.counted;

    /* the count: the number word IS the feedback (no text, pure voice) */
    audio.play('pop', Math.min(7, n - 1));
    speak(countWord(n));
    this.score.hit(10, { x: a.x, y: a.y });
    this.sparkle(a.x, a.y, [0xffd76a, COLORS.glowSoft]);

    /* the acorn hops into the basket */
    if (this.basketLabel) {
      const targetX = this.basketLabel.x + (n % 2 === 0 ? 16 : -16);
      const targetY = this.basketLabel.y + 10;
      this.anim.to(a.root, { x: targetX, y: targetY, scale: 0.55 }, { durationMs: 460, delayMs: 120, ease: ease.outBack });
    }

    /* the basket counter ticks up */
    if (this.basketLabel) {
      const txt = this.basketLabel.children[0] as { text?: string } | undefined;
      if (txt && txt.text !== undefined) txt.text = String(n);
      this.basketLabel.scale.set(1.25);
      this.anim.to(this.basketLabel, { scale: 1 }, { durationMs: 220, ease: ease.outCubic });
    }

    if (isCountComplete(this.counted, this.field.n)) {
      this.signals.attempt('logic.counting', true);
      this.roundComplete();
    }
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.3);
    this.dda.outcome(true, 1);
    audio.play('combo', Math.min(4, this.round));
    this.fx.announce(`סָפַרְנוּ ${countWord(this.field.n)}!`, { y: this.h * 0.14, w: this.w, durMs: 1600 });
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(1400, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'הַסְּנַאי שָׂמֵחַ!' });
      });
    } else {
      this.round++;
      this.anim.after(1700, () => this.dealRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    for (const a of this.acorns) {
      if (a.root.destroyed) continue;
      if (a.counted) {
        a.glow.alpha = 0.08;
        continue;
      }
      /* uncounted acorns breathe — "I am still waiting" */
      a.glow.alpha = 0.22 + 0.16 * Math.sin(this.t / 420 + a.index);
      a.root.rotation = Math.sin(this.t / 700 + a.index * 1.3) * 0.05;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'count-tap',
      round: this.round,
      totalRounds: this.totalRounds,
      counted: this.counted,
      total: this.field.n,
      done: this.done || this.isFinished(),
      acorns: this.acorns.map((a) => ({
        x: Math.round(a.x),
        y: Math.round(a.y),
        counted: a.counted,
      })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
