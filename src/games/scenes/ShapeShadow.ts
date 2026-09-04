import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { shadowChallengeFor, type ShapeKind, type ShadowChallenge } from '../logic/shapeShadow';
import { speak } from './speak';

const _WALL = 0x241c3f;
const LIT_HEX = 0xffe9a6;
const SHADOW_HEX = 0x0c0a18;

/**
 * ShapeShadow — "צְלָלִים מְדֻיֶּיקִים".
 *
 * A lantern wall: one shape glows at the top; 3-4 dark silhouettes
 * wait below. Exactly one keeps the whole outline. Tap the true
 * shadow — it lights up and floats to join its shape.
 */
export class ShapeShadowScene extends GameScene {
  private board = new Container();
  private challenge: ShadowChallenge | null = null;
  private optionViews: Array<{ kind: ShapeKind; root: Container }> = [];
  private round = 1;
  private totalRounds = 5;
  private consecutiveMiss = 0;
  private hint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private locked = false;
  private done = false;
  private shapeY = 0;
  private optionsY = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'night';
    this.root.addChild(this.board);
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 5;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('אֵיזֶה צֵל אֲמִתִּי?');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הַפָּנָס מְצַיֵּר צוּרָה עַל הַקִּיר.', 'אֵיזֶה צֵל הוּא הַצֵּל הָאֲמִתִּי שֶׁלָּהּ?'],
    );
    this.layout();
    this.dealRound();
  }

  protected override layout(): void {
    this.shapeY = this.h * 0.36;
    this.optionsY = this.h * 0.76;
  }

  private dealRound(): void {
    this.challenge = shadowChallengeFor(this.dda.tier(), 900 + this.round * 7, this.round);
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.locked = false;
    for (const o of this.optionViews) if (!o.root.destroyed) o.root.destroy({ children: true });
    this.optionViews = [];

    /* the lit shape on the wall */
    const lit = new Container();
    const glowShape = new Graphics();
    this.drawShape(glowShape, this.challenge.shape, LIT_HEX, true);
    lit.addChild(glowShape);
    this.glowOn(glowShape, LIT_HEX, 1.4, true);
    lit.x = this.w / 2;
    lit.y = this.shapeY;
    lit.scale.set(0);
    this.board.addChild(lit);
    this.anim.to(lit, { scale: 1 }, { durationMs: 430, ease: ease.outBack });

    /* the shadow row */
    const n = this.challenge.options.length;
    const span = Math.min(this.w * 0.86, n * 110);
    this.challenge.options.forEach((kind, i) => {
      const root = new Container();
      const g = new Graphics();
      this.drawShape(g, kind, SHADOW_HEX, false);
      root.addChild(g);
      const glow = new Sprite(softGlowTexture());
      glow.anchor.set(0.5);
      glow.tint = COLORS.hint;
      glow.blendMode = 'add';
      glow.width = 150;
      glow.height = 150;
      glow.visible = false;
      root.addChildAt(glow, 0);
      root.x = this.w / 2 - span / 2 + (span / Math.max(1, n - 1)) * i;
      root.y = this.optionsY + 24;
      root.scale.set(0);
      this.board.addChild(root);
      this.anim.to(root, { scale: 1, y: this.optionsY }, { durationMs: 420, delayMs: 200 + i * 70, ease: ease.outBack });
      this.optionViews.push({ kind, root });
    });
  }

  /** One painter for every shape — lit and shadow versions share it. */
  private drawShape(g: Graphics, kind: ShapeKind, hex: number, lit: boolean): void {
    const R = lit ? 62 : 54;
    const edge = lit ? { color: 0xffffff, width: 2.5, alpha: 0.6 } : { color: 0x40385e, width: 1.5, alpha: 0.7 };
    switch (kind) {
      case 'circle':
        g.circle(0, 0, R).fill({ color: hex });
        g.circle(0, 0, R).stroke(edge);
        break;
      case 'square':
        g.roundRect(-R * 0.85, -R * 0.85, R * 1.7, R * 1.7, 8).fill({ color: hex });
        g.roundRect(-R * 0.85, -R * 0.85, R * 1.7, R * 1.7, 8).stroke(edge);
        break;
      case 'triangle':
        g.moveTo(0, -R).lineTo(R * 0.95, R * 0.75).lineTo(-R * 0.95, R * 0.75).closePath().fill({ color: hex });
        g.moveTo(0, -R).lineTo(R * 0.95, R * 0.75).lineTo(-R * 0.95, R * 0.75).closePath().stroke(edge);
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? R : R * 0.45;
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath().fill({ color: hex });
        g.closePath().stroke(edge);
        break;
      case 'heart':
        g.moveTo(0, R * 0.85)
          .bezierCurveTo(-R * 1.3, -R * 0.1, -R * 0.55, -R * 0.95, 0, -R * 0.35)
          .bezierCurveTo(R * 0.55, -R * 0.95, R * 1.3, -R * 0.1, 0, R * 0.85)
          .fill({ color: hex });
        g.moveTo(0, R * 0.85)
          .bezierCurveTo(-R * 1.3, -R * 0.1, -R * 0.55, -R * 0.95, 0, -R * 0.35)
          .bezierCurveTo(R * 0.55, -R * 0.95, R * 1.3, -R * 0.1, 0, R * 0.85)
          .stroke(edge);
        break;
      case 'diamond':
        g.moveTo(0, -R).lineTo(R * 0.7, 0).lineTo(0, R).lineTo(-R * 0.7, 0).closePath().fill({ color: hex });
        g.moveTo(0, -R).lineTo(R * 0.7, 0).lineTo(0, R).lineTo(-R * 0.7, 0).closePath().stroke(edge);
        break;
    }
  }

  override onTap(x: number, y: number): boolean {
    if (this.done || this.locked || !this.challenge) return false;
    for (const o of this.optionViews) {
      if (Math.hypot(x - o.root.x, y - o.root.y) > 62) continue;
      if (o.kind === this.challenge.answer) {
        this.hit(o);
      } else {
        this.miss(o);
      }
      return true;
    }
    return false;
  }

  private hit(o: { kind: ShapeKind; root: Container }): void {
    this.locked = true;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.score.hit(12, { x: o.root.x, y: o.root.y });
    this.sparkle(o.root.x, o.root.y, [COLORS.glow, LIT_HEX]);
    audio.play('chime', 2);
    speak(this.shapeName(o.kind));
    /* the true shadow lights up and joins its shape */
    const g = o.root.children.find((c) => c instanceof Graphics) as Graphics | undefined;
    if (g) {
      g.clear();
      this.drawShape(g, o.kind, LIT_HEX, true);
      this.glowOn(g, LIT_HEX, 1.2, true);
    }
    this.anim.to(o.root, { x: this.w / 2, y: this.shapeY, scale: 0.001, alpha: 0 }, {
      durationMs: 620,
      delayMs: 340,
      ease: ease.outCubic,
    });
    this.signals.attempt('spatial.matching', true);
    this.roundComplete();
  }

  private miss(o: { kind: ShapeKind; root: Container }): void {
    this.dda.outcome(false);
    this.signals.attempt('spatial.matching', false);
    this.score.miss({ x: o.root.x, y: o.root.y });
    audio.play('softError');
    this.consecutiveMiss++;
    this.hint = this.suggestHint(this.consecutiveMiss);
    if (this.hint !== 'none') this.signals.hintUsed('spatial.matching');
    this.say(['הִסְתַּכְּלוּ לְאַט — לַקְצֶווֹת וְלַזִּוִּיִּת שֶׁל הַצּוּרָה.']);
  }

  private shapeName(kind: ShapeKind): string {
    switch (kind) {
      case 'circle': return 'עִגּוּל';
      case 'square': return 'רִבּוּעַ';
      case 'triangle': return 'מְשֻׁלָּשׁ';
      case 'star': return 'כּוֹכָב';
      case 'heart': return 'לֵב';
      case 'diamond': return 'יַהֲלוֹם';
    }
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
    this.dda.outcome(true, 1);
    audio.play('combo', Math.min(4, this.round));
    this.lennyCelebrate();
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(1100, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'כָּל הַצְּלָלִים נִמְצְאוּ!' });
      });
    } else {
      this.round++;
      this.anim.after(1400, () => this.dealRound());
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    /* the hint ladder: the true shadow breathes */
    if ((this.hint === 'clear' || this.hint === 'show') && this.challenge) {
      const right = this.optionViews.find((o) => o.kind === this.challenge!.answer);
      if (right) {
        right.root.children.forEach((c) => {
          if (c instanceof Sprite && c.blendMode === 'add') c.visible = true;
        });
      }
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'shape-shadow',
      round: this.round,
      totalRounds: this.totalRounds,
      shape: this.challenge?.shape ?? null,
      hint: this.hint,
      done: this.done || this.isFinished(),
      options: this.optionViews.map((o) => ({ kind: o.kind, x: Math.round(o.root.x), y: Math.round(o.root.y) })),
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
