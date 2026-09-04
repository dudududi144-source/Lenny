import { Container, Graphics } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { leafPlanFor, leafRadius, NEST_NAMES, type NestIndex } from '../logic/leafSize';
import { speak } from './speak';

const LEAF_HEX = [0x8fbf5a, 0xc9a44a, 0xa0642e] as const; /* fresh → dry by size */
const NEST_HEX = [0x5b8c46, 0xb98a3e, 0x9a5f33] as const;

interface Nest {
  size: NestIndex;
  root: Container;
}

/**
 * LeafSize — "קִנֵּי הֶעָלִים".
 *
 * Leaves drift down one at a time; three nests wait below, visibly
 * small / medium / big. The child taps the nest that fits the leaf.
 * Classification against three visible anchors — no reading, all
 * looking (and the nest names are spoken, never printed).
 */
export class LeafSizeScene extends GameScene {
  private board = new Container();
  private nests: Nest[] = [];
  private leaves: Array<{ size: number; contrast: number }> = [];
  private leafIndex = 0;
  private active: Container | null = null;
  private round = 1;
  private totalRounds = 2;
  private consecutiveMiss = 0;
  private hint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private done = false;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'forest';
    this.root.addChild(this.board);
    this.buildNests();
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 2;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('לְאָיזֶה קֶן הֶעָלֶה שָׁיֵךְ?');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הֶעָלִים נוֹפְלִים — וּלְכָל אֶחָד יֵשׁ קֶן.', 'קָטָן, בֵּינוֹנִי אוֹ גָּדוֹל?'],
    );
    /* the three nest names are spoken once each, spaced so the voice
       never cancels itself (the FindLetter speech discipline) */
    NEST_NAMES.forEach((name, i) => {
      this.anim.after(700 + i * 1100, () => {
        if (!this.tornDown) speak(name);
      });
    });
    this.dealRound();
  }

  private buildNests(): void {
    const y = this.h * 0.82;
    const xs = [this.w * 0.22, this.w * 0.5, this.w * 0.78];
    for (let i = 0; i < 3; i++) {
      const root = new Container();
      const size = i as NestIndex;
      const r = 46 + size * 16;
      const g = new Graphics();
      /* a woven nest: two arcs + a basket lip */
      g.ellipse(0, 0, r, r * 0.52).fill({ color: NEST_HEX[size] });
      g.ellipse(0, -4, r * 0.86, r * 0.4).fill({ color: 0x2a2018, alpha: 0.55 });
      g.ellipse(0, 0, r, r * 0.52).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
      for (let w = 0; w < 5; w++) {
        const a = Math.PI * (0.15 + w * 0.175);
        g.moveTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.5)
          .quadraticCurveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.22 - 8, Math.cos(a) * r * 0.1, 2)
          .stroke({ color: 0x2a2018, width: 1.6, alpha: 0.5 });
      }
      root.addChild(g);
      this.glowOn(g, NEST_HEX[size], 0.8, false);
      root.x = xs[i];
      root.y = y;
      root.scale.set(0);
      this.board.addChild(root);
      this.anim.to(root, { scale: 1 }, { durationMs: 430, delayMs: i * 90, ease: ease.outBack });
      this.nests.push({ size, root });
    }
  }

  private dealRound(): void {
    const plan = leafPlanFor(this.dda.tier(), 500 + this.round * 13, this.round);
    this.leaves = plan.leaves.map((size) => ({ size, contrast: plan.contrast }));
    this.leafIndex = 0;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.dropNextLeaf();
  }

  private dropNextLeaf(): void {
    if (this.done || this.leafIndex >= this.leaves.length) return;
    const leaf = this.leaves[this.leafIndex];
    const root = new Container();
    const r = leafRadius(leaf.size, leaf.contrast);
    const g = new Graphics();
    /* a simple leaf: two arcs meeting at tip + a stem */
    g.moveTo(-r, 0)
      .quadraticCurveTo(0, -r * 0.72, r, 0)
      .quadraticCurveTo(0, r * 0.72, -r, 0)
      .fill({ color: LEAF_HEX[Math.min(2, leaf.size)] });
    g.moveTo(-r, 0).lineTo(r, 0).stroke({ color: 0x2a2018, width: 1.6, alpha: 0.4 });
    g.moveTo(0, -r * 0.02).lineTo(0, -r * 0.9).stroke({ color: 0x2a2018, width: 2, alpha: 0.5 });
    root.addChild(g);
    this.glowOn(g, LEAF_HEX[Math.min(2, leaf.size)], 0.7, false);
    root.x = this.w * (0.3 + 0.4 * ((this.leafIndex % 3) / 2));
    root.y = this.h * 0.34;
    root.scale.set(0);
    this.board.addChild(root);
    this.anim.to(root, { scale: 1 }, { durationMs: 380, ease: ease.outBack });
    this.active = root;
  }

  override onTap(x: number, y: number): boolean {
    if (this.done || !this.active) return false;
    const leaf = this.leaves[this.leafIndex];
    if (!leaf) return false;
    for (const nest of this.nests) {
      if (Math.hypot(x - nest.root.x, y - nest.root.y) > 64 + nest.size * 8) continue;
      if (nest.size === leaf.size) {
        this.hitNest(nest);
      } else {
        this.missNest(nest);
      }
      return true;
    }
    return false;
  }

  private hitNest(nest: Nest): void {
    const leaf = this.active!;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.score.hit(12, { x: leaf.x, y: leaf.y });
    this.sparkle(nest.root.x, nest.root.y - 20, [COLORS.glow, COLORS.mint]);
    audio.play('pop', nest.size);
    this.anim.to(leaf, { x: nest.root.x, y: nest.root.y - 8, scale: 0.5, alpha: 0.9 }, {
      durationMs: 380,
      ease: ease.outBack,
      onDone: () => {
        if (!leaf.destroyed) leaf.destroy({ children: true });
      },
    });
    this.leafIndex++;
    if (this.leafIndex >= this.leaves.length) {
      this.signals.attempt('logic.size', true);
      this.roundComplete();
    } else {
      this.anim.after(420, () => {
        if (!this.tornDown) this.dropNextLeaf();
      });
    }
  }

  private missNest(nest: Nest): void {
    this.dda.outcome(false);
    this.signals.attempt('logic.size', false);
    this.score.miss({ x: nest.root.x, y: nest.root.y });
    audio.play('softError');
    this.consecutiveMiss++;
    this.hint = this.suggestHint(this.consecutiveMiss);
    if (this.hint !== 'none') this.signals.hintUsed('logic.size');
    this.say(['הַסְתַּכְּלוּ בַּגֹּדֶל — לְאָיזֶה קֶן הוּא יִכָּנֵס בְּקַלּוּת?']);
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
    this.dda.outcome(true, 1);
    audio.play('combo', Math.min(4, this.round));
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.active = null;
      this.anim.after(900, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'כָּל הֶעָלִים בַּקֶּנִים!' });
      });
    } else {
      this.round++;
      this.anim.after(1300, () => this.dealRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    /* the active leaf sways on its way down */
    if (this.active && !this.active.destroyed) {
      this.active.y += Math.sin(this.t / 420) * 0.25;
      this.active.rotation = Math.sin(this.t / 600) * 0.08;
    }
    /* the hint ladder: the fitting nest breathes */
    if ((this.hint === 'clear' || this.hint === 'show') && this.active) {
      const leaf = this.leaves[this.leafIndex];
      const nest = this.nests.find((n) => leaf && n.size === leaf.size);
      if (nest) {
        nest.root.scale.set(1 + Math.sin(this.t / 140) * 0.05);
      }
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'leaf-size',
      round: this.round,
      totalRounds: this.totalRounds,
      leafIndex: this.leafIndex,
      leavesTotal: this.leaves.length,
      currentSize: this.leaves[this.leafIndex]?.size ?? null,
      hint: this.hint,
      done: this.done || this.isFinished(),
      nests: this.nests.map((n) => ({ size: n.size, x: Math.round(n.root.x), y: Math.round(n.root.y) })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
