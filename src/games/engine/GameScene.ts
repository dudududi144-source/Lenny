import { Container, Sprite, Text } from 'pixi.js';
import type { GameSpec } from '../builder/GameSpec';
import { AdaptiveDifficulty, type HintStrength } from '../core/AdaptiveDifficulty';
import { LearningSignals } from '../core/LearningSignals';
import { recordZoneFinish } from '../core/ProgressStore';
import type { HudBridge } from '../../ui/components/GameHUD';
import { AnimationSystem, ease } from './AnimationSystem';
import { GardenBackdrop } from './GardenBackdrop';
import { bursts, ParticleSystem } from './ParticleSystem';
import { ringTexture, softGlowTexture } from './textures';
import { COLORS } from './theme';

export interface SceneCtx {
  /** the live pixi Application (for renderer checks only) */
  app: unknown;
  zone: string;
  spec: GameSpec | null;
  hud: HudBridge;
  onExit(): void;
}

/**
 * Base class for every Pixi game scene. Owns the shared systems
 * (backdrop, particles, tweens), the cognitive-core wiring (DDA +
 * LearningSignals, untouched), the HUD bridge and the finish flow.
 * Scenes implement build() and extend update()/onTap().
 */
export abstract class GameScene {
  readonly root = new Container();
  readonly w = 420;
  readonly h = 720;
  readonly dda: AdaptiveDifficulty;
  readonly signals = new LearningSignals();
  readonly particles = new ParticleSystem();
  readonly anim = new AnimationSystem();

  protected ctx: SceneCtx;
  protected backdrop: GardenBackdrop;
  protected t = 0;

  private startedAt = performance.now();
  private finished = false;

  protected constructor(ctx: SceneCtx) {
    this.ctx = ctx;
    this.dda = new AdaptiveDifficulty(ctx.zone);
    this.backdrop = new GardenBackdrop(this.w, this.h);
    this.root.addChild(this.backdrop.container);
    this.root.addChild(this.particles.container);
    ctx.hud.ringReset();
  }

  protected abstract build(): void;

  /** Base tick: drives backdrop, particles and tweens. Scenes override
      and call super.update(dtMs) first. */
  update(dtMs: number): void {
    this.t += dtMs;
    this.backdrop.update(dtMs, this.t);
    this.particles.update(dtMs);
    this.anim.update(dtMs);
  }

  /** Design-space tap. Returns true when the tap hit something live. */
  onTap(_x: number, _y: number): boolean {
    return false;
  }

  onDragStart(_x: number, _y: number): void {}
  onDragMove(_x: number, _y: number): void {}
  onDragEnd(_x: number, _y: number): void {}

  debugState(): Record<string, unknown> {
    return {};
  }

  /* ---------- shared helpers ---------- */

  protected say(lines: string | string[], onDone?: () => void): void {
    this.ctx.hud.say(lines, onDone);
  }

  protected suggestHint(recentFails: number): HintStrength {
    return this.dda.suggestHint(recentFails);
  }

  protected sparkle(x: number, y: number, colors?: number[]): void {
    bursts.sparkle(this.particles, x, y, colors);
  }

  protected bloom(x: number, y: number, color?: number): void {
    bursts.bloom(this.particles, x, y, color);
  }

  /** Expanding ring at (x, y) — the scene-wide "touch landed" language.
      The tween drives the sprite's own props and destroys it at the end,
      so nothing can outlive the ring. */
  protected ripple(x: number, y: number, color: number = COLORS.glow): void {
    const ring = new Sprite(ringTexture());
    ring.anchor.set(0.5);
    ring.x = x;
    ring.y = y;
    ring.tint = color;
    ring.alpha = 0.85;
    ring.blendMode = 'add';
    ring.width = 24;
    ring.height = 24;
    this.root.addChild(ring);
    this.anim.to(ring, { width: 190, height: 190, alpha: 0 }, {
      durationMs: 620,
      ease: ease.outCubic,
      onDone: () => ring.destroy(),
    });
  }

  /** Glow sprite helper (additive, tinted) for auras/halos. */
  protected glowSprite(color: number, size: number, alpha = 0.8): Sprite {
    const s = new Sprite(softGlowTexture());
    s.anchor.set(0.5);
    s.tint = color;
    s.blendMode = 'add';
    s.width = size;
    s.height = size;
    s.alpha = alpha;
    return s;
  }

  protected label(text: string, size: number, color: number = COLORS.cream, weight = '600'): Text {
    const txt = new Text({
      text,
      style: {
        fontFamily: 'Heebo, sans-serif',
        fontSize: size,
        fontWeight: weight as '400' | '500' | '600' | '700' | '800',
        fill: color,
        align: 'center',
      },
    });
    txt.anchor.set(0.5);
    txt.resolution = 2;
    return txt;
  }

  /** Win flow: record progress immediately, celebrate, then leave to the garden. */
  protected finish(gapMs = 2400): void {
    if (this.finished) return;
    this.finished = true;
    const secs = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
    recordZoneFinish(this.ctx.zone, secs);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.32);
    bursts.sparkle(this.particles, this.w / 2, this.h * 0.26);
    this.anim.after(gapMs, () => this.ctx.onExit());
  }

  /** True once finish() ran — scenes guard their input with this. */
  protected isFinished(): boolean {
    return this.finished;
  }

  destroy(): void {
    this.anim.destroy();
    this.particles.dispose();
    this.root.destroy({ children: true });
  }
}
