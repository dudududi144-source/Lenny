import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { advanceAlong, trailComplete, trailFor, type StarTrail } from '../logic/tracePath';

const STAR_HEX = 0xbfe8ff;
const TRAIL_LIT = 0x9fdcff;
const TRAIL_DIM = 0x3d5a78;

interface Dot {
  x: number;
  y: number;
  g: Graphics;
}

/**
 * TracePath — "שְׁבִיל הַכּוֹכָבִים".
 *
 * A dotted trail hangs between the night's stars. Press the glowing
 * first star and DRAG: dots light as the finger passes them, and
 * reaching the last star closes the constellation with a shooting
 * star. Falling off the trail is free — the light waits where the
 * finger left it. Pre-writing tracing, fail-free.
 */
export class TracePathScene extends GameScene {
  private board = new Container();
  private trail: StarTrail | null = null;
  private dots: Dot[] = [];
  private stars: Array<{ root: Container; glow: Sprite }> = [];
  private trailG: Graphics = new Graphics();
  private progress = 0;
  private dragging = false;
  private round = 1;
  private totalRounds = 2;
  private done = false;
  /* layout-space (0..1) → world mapping, recomputed per round */
  private bx = 0;
  private by = 0;
  private bw = 0;
  private bh = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'night';
    this.root.addChild(this.board);
    this.board.addChild(this.trailG);
    this.build();
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 2;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('גְּרֹרוּ לְאֹרְךְ הַנְּקוּדוֹת');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['הַכּוֹכָבִים רוֹצִים מַסְלּוּל.', 'הִתְחִילוּ בַּכּוֹכָב הָאוֹרֵר וּגְרֹרוּ בְּעִקְבוֹת הַנְּקוּדוֹת!'],
    );
    this.dealRound();
  }

  private toBoardWorld(p: { x: number; y: number }): { x: number; y: number } {
    return { x: this.bx + p.x * this.bw, y: this.by + p.y * this.bh };
  }

  private dealRound(): void {
    this.progress = 0;
    this.dragging = false;
    for (const s of this.stars) if (!s.root.destroyed) s.root.destroy({ children: true });
    this.stars = [];
    for (const d of this.dots) if (!d.g.destroyed) d.g.destroy();
    this.dots = [];
    this.trailG.clear();

    /* deterministic in (tier, round): the same sky on every device */
    this.trail = trailFor(this.dda.tier(), 800 + this.round * 41);
    this.bx = this.w * 0.1;
    this.by = this.h * 0.3;
    this.bw = this.w * 0.8;
    this.bh = this.h * 0.55;

    /* the dots — dim until the finger lights them */
    for (const p of this.trail.points) {
      const g = new Graphics();
      const w = this.toBoardWorld(p);
      g.circle(w.x, w.y, 5).fill({ color: TRAIL_DIM });
      this.trailG.addChild(g);
      this.dots.push({ x: w.x, y: w.y, g });
    }

    /* the waypoints — stars at both ends of every leg */
    this.trail.nodes.forEach((p, i) => {
      const w = this.toBoardWorld(p);
      const root = new Container();
      const g = new Graphics();
      const R = 26;
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? R : R * 0.46;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath().fill({ color: STAR_HEX });
      root.addChild(g);
      this.glowOn(g, STAR_HEX, 0.9, false);

      const glow = new Sprite(softGlowTexture());
      glow.anchor.set(0.5);
      glow.tint = STAR_HEX;
      glow.blendMode = 'add';
      glow.width = 130;
      glow.height = 130;
      glow.alpha = 0.4;
      root.addChildAt(glow, 0);

      root.x = w.x;
      root.y = w.y;
      root.scale.set(0);
      this.board.addChild(root);
      this.anim.to(root, { scale: 1 }, { durationMs: 420, delayMs: i * 90, ease: ease.outBack });
      this.stars.push({ root, glow });
    });
  }

  /* ---------- the drag: the whole game lives in onDragMove ---------- */

  override onDragStart(x: number, y: number): void {
    if (this.done) return;
    this.dragging = true;
    this.advance(x, y);
  }

  override onDragMove(x: number, y: number): void {
    if (this.done || !this.dragging) return;
    this.advance(x, y);
  }

  override onDragEnd(_x: number, _y: number): void {
    this.dragging = false; /* the trail simply waits — no fail, ever */
  }

  /** Convert a world point to layout space and push the trail forward. */
  private advance(wx: number, wy: number): void {
    if (!this.trail) return;
    const lp = { x: (wx - this.bx) / this.bw, y: (wy - this.by) / this.bh };
    /* generous tolerance (~0.09 of the board ≈ 30+ world units) */
    const next = advanceAlong(this.trail.points, this.progress, lp, 0.09);
    if (next > this.progress) {
      const firstNew = Math.floor(this.progress);
      const lastNew = Math.floor(next);
      for (let i = firstNew; i <= lastNew && i < this.dots.length; i++) {
        if (i > this.progress - 1) {
          this.dots[i].g.clear();
          this.dots[i].g.circle(this.dots[i].x, this.dots[i].y, 7).fill({ color: TRAIL_LIT });
        }
      }
      this.progress = next;
      if (Math.floor(next) % 3 === 0) audio.play('tick');
      this.sparkle(wx, wy, [TRAIL_LIT, COLORS.glowSoft]);
      if (trailComplete(this.trail.points, this.progress)) {
        this.signals.attempt('motor.tracing', true);
        this.roundComplete();
      }
    }
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
    this.dda.outcome(true, 1);
    audio.play('star', 4);
    this.fx.announce('הַקְּבוּצָה נִסְגְּרָה!', { y: this.h * 0.18, w: this.w, durMs: 1500 });
    this.lennyCelebrate();
    /* a shooting star crosses the finished constellation */
    const streak = this.glowSprite(0xffffff, 220, 0.9);
    streak.x = this.w * 0.1;
    streak.y = this.h * 0.16;
    streak.rotation = 0.5;
    this.board.addChild(streak);
    this.anim.to(streak, { x: this.w * 0.92, y: this.h * 0.4, alpha: 0 }, {
      durationMs: 900,
      ease: ease.outCubic,
      onDone: () => !streak.destroyed && streak.destroy(),
    });
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(1500, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'שְׁבִיל הַכּוֹכָבִים שֶׁלְּךָ!' });
      });
    } else {
      this.round++;
      this.anim.after(1800, () => this.dealRound());
    }
  }

  override onTap(): boolean {
    /* the game is a drag, not a tap — but a tap on the first star
       starts the trail too (children who press-and-hold get credit) */
    return false;
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    /* the next dot ahead breathes — "the finger goes HERE" */
    if (this.trail && !this.done) {
      const k = Math.min(this.dots.length - 1, Math.floor(this.progress));
      for (let i = 0; i < this.dots.length; i++) {
        if (i <= Math.floor(this.progress) - 1) continue; /* lit dots stay lit */
        if (i === k || i === k + 1) {
          const pulse = 0.5 + 0.5 * Math.sin(this.t / 240);
          this.dots[i].g.clear();
          this.dots[i].g.circle(this.dots[i].x, this.dots[i].y, 6 + pulse * 2).fill({ color: TRAIL_LIT, alpha: 0.5 + pulse * 0.4 });
        }
      }
    }
    for (const s of this.stars) {
      if (s.root.destroyed) continue;
      s.root.rotation = Math.sin(this.t / 800) * 0.06;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'trace-path',
      round: this.round,
      totalRounds: this.totalRounds,
      progress: Math.round(this.progress),
      dotsTotal: this.dots.length,
      done: this.done || this.isFinished(),
      /* the waypoints in WORLD units — the e2e drags through them */
      nodes: this.trail?.nodes.map((p) => {
        const w = this.toBoardWorld(p);
        return { x: Math.round(w.x), y: Math.round(w.y) };
      }) ?? [],
      board: { x: Math.round(this.bx), y: Math.round(this.by), w: Math.round(this.bw), h: Math.round(this.bh) },
    };
  }

  override destroy(): void {
    super.destroy();
  }
}
