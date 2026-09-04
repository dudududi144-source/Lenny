import { Container, Graphics } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { optionCountFor, roundFor, type RhymeRound } from '../logic/rhymePick';
import { speak } from './speak';

const CARD = 0x2c2352;
const CARD_EDGE = 0x6d5fb8;
const CARD_HIT = 0x3f3272;
const TARGET_TINT = 0xffd76a;

interface Card {
  word: string;
  rhymes: boolean;
  root: Container;
  g: Graphics;
  x: number;
  y: number;
}

/**
 * RhymePick — "מִי חָרִיזָה?".
 *
 * The owl sings a word; the cards answer. One card rhymes with the
 * target, the others come from different families. Every card speaks
 * itself when tapped (voice, not text — the game plays fully before
 * reading), the right tap sings both words together. A wrong tap
 * simply sings the target again, slower. Phonological awareness.
 */
export class RhymePickScene extends GameScene {
  private board = new Container();
  private target: Card | null = null;
  private cards: Card[] = [];
  private roundData: RhymeRound | null = null;
  private round = 1;
  private totalRounds = 4;
  private done = false;
  private lockMs = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'garden';
    this.root.addChild(this.board);
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 4;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('הַקְשִׁיבוּ וּבְחֲרוּ אֶת הַמִּלָּה שֶׁחוֹרֵפֶת');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הַיַּנְשׁוּף שָׁר מִלָּה.', 'מִי מֵהַמִּלִּים מִתְחָרֵז אִתָּהּ? הַקְשִׁיבוּ!'],
    );
    this.anim.after(1200, () => this.dealRound());
  }

  private dealRound(): void {
    if (this.done) return;
    for (const c of this.cards) if (!c.root.destroyed) c.root.destroy({ children: true });
    this.cards = [];
    if (this.target && !this.target.root.destroyed) this.target.root.destroy({ children: true });
    this.target = null;

    /* deterministic in (tier, round): the same words on every device */
    this.roundData = roundFor(this.dda.tier(), 900 + this.round * 29);
    const data = this.roundData;

    /* the target card — the owl's word, big, top of the screen */
    const target = this.buildCard(data.target, true, this.w / 2, this.h * 0.3, 1.25);
    this.target = target;

    /* the answer cards — a row under the target */
    const opts = data.options.slice(0, optionCountFor(this.dda.tier()));
    const gap = this.w / (opts.length + 1);
    for (const o of opts) {
      const card = this.buildCard(o.word, o.rhymes, gap * (opts.indexOf(o) + 1), this.h * 0.62, 1);
      this.cards.push(card);
    }

    /* the owl sings the target word (and again on tap) */
    this.anim.after(500, () => speak(data.target));
  }

  private buildCard(word: string, rhymes: boolean, x: number, y: number, scale: number): Card {
    const root = new Container();
    const g = new Graphics();
    const w = 128 * scale;
    const h = 120 * scale;
    g.roundRect(-w / 2, -h / 2, w, h, 18 * scale).fill({ color: CARD });
    g.roundRect(-w / 2, -h / 2, w, h, 18 * scale).stroke({ color: CARD_EDGE, width: 2.5 });
    root.addChild(g);

    const txt = this.label(word, 40 * scale, 0xfff3d9, '700');
    root.addChild(txt);

    /* a small speaker glyph — "touch me and I will sing" */
    const glyph = new Graphics();
    const gy = h / 2 - 16 * scale;
    glyph.moveTo(-w / 2 + 18 * scale, gy).lineTo(-w / 2 + 26 * scale, gy).stroke({ color: 0xbfb2f0, width: 2 });
    glyph.circle(-w / 2 + 34 * scale, gy, 5).stroke({ color: 0xbfb2f0, width: 2 });
    root.addChild(glyph);

    root.x = x;
    root.y = y;
    root.scale.set(0);
    this.board.addChild(root);
    this.anim.to(root, { scale }, { durationMs: 420, ease: ease.outBack });

    return { word, rhymes, root, g, x, y };
  }

  override onTap(x: number, y: number): boolean {
    if (this.done || this.lockMs > 0) return false;

    /* the target card re-sings itself on demand */
    if (this.target && Math.hypot(x - this.target.x, y - this.target.y) < 92) {
      audio.play('tick');
      speak(this.target.word);
      this.anim.to(this.target.root, { scale: this.target.root.scale.x * 1.06 }, {
        durationMs: 140,
        ease: ease.outQuad,
        onDone: () => this.target && this.anim.to(this.target.root, { scale: 1.25 }, { durationMs: 200, ease: ease.outCubic }),
      });
      return true;
    }

    for (const c of this.cards) {
      if (Math.hypot(x - c.x, y - c.y) > 78) continue; /* ≥44px hit, generously */
      if (c.rhymes) {
        this.hit(c);
      } else {
        this.miss(c);
      }
      return true;
    }
    this.ripple(x, y, 0x8a7fc0);
    return false;
  }

  private hit(c: Card): void {
    this.lockMs = 1; /* one beat: the round is decided, taps settle */
    c.g.clear();
    c.g.roundRect(-64, -60, 128, 120, 18).fill({ color: CARD_HIT });
    c.g.roundRect(-64, -60, 128, 120, 18).stroke({ color: TARGET_TINT, width: 3 });
    this.score.hit(14, { x: c.x, y: c.y });
    this.sparkle(c.x, c.y, [TARGET_TINT, COLORS.glowSoft]);
    audio.play('star', this.round % 5);
    /* both words sing together — the rhyme, heard */
    speak(`${this.target?.word ?? ''}, ${c.word}!`);
    this.signals.attempt('language.rhyme', true);
    this.roundComplete();
  }

  private miss(c: Card): void {
    this.score.miss({ x: c.x, y: c.y });
    audio.play('softError');
    this.dda.outcome(false);
    this.signals.attempt('language.rhyme', false);
    /* no fail: the target simply sings again, a touch slower */
    this.anim.to(c.root, { rotation: 0.1 }, {
      durationMs: 110,
      ease: ease.outQuad,
      onDone: () => this.anim.to(c.root, { rotation: 0 }, { durationMs: 200, ease: ease.outQuad }),
    });
    if (this.target) {
      const t = this.target;
      this.anim.to(t.root, { scale: 1.32 }, { durationMs: 200, ease: ease.outQuad, onDone: () => this.anim.to(t.root, { scale: 1.25 }, { durationMs: 240, ease: ease.outCubic }) });
      this.anim.after(420, () => speak(t.word));
    }
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.45);
    this.dda.outcome(true, 1);
    this.fx.announce('חָרִיזָה!', { y: this.h * 0.14, w: this.w, durMs: 1400 });
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(1500, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'הָאָזֶן שֶׁלְּךָ קְסֻמָּה!' });
      });
    } else {
      this.round++;
      this.anim.after(1900, () => this.dealRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    if (this.lockMs > 0) this.lockMs = Math.max(0, this.lockMs - dtMs / 1000);
    if (this.done) return;
    /* the target breathes — the ear goes there first */
    if (this.target && !this.target.root.destroyed) {
      this.target.root.rotation = Math.sin(this.t / 600) * 0.03;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'rhyme-pick',
      round: this.round,
      totalRounds: this.totalRounds,
      done: this.done || this.isFinished(),
      target: this.roundData?.target ?? null,
      /* the e2e taps the rhyming card (answer key observable, bridge-only) */
      options: this.cards.map((c) => ({ word: c.word, rhymes: c.rhymes, x: Math.round(c.x), y: Math.round(c.y) })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
