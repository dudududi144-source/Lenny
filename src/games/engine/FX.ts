import { Container, Graphics, Text } from 'pixi.js';
import type { AnimationSystem } from './AnimationSystem';
import { ease } from './AnimationSystem';
import { audio } from './AudioEngine';
import { COLORS } from './theme';

/**
 * FX — commercial game-feel layer: screen shake, hit flash,
 * slow-motion, big center announcements. All time-based systems
 * read `timeScale` so slowmo affects gameplay AND tweens uniformly.
 */
export class FX {
  private anim: AnimationSystem;
  private stage: Container; /* full-screen FX layer (screen space) */
  timeScale = 1;
  private shakeAmp = 0;
  private shakeUntil = 0;
  private shakeTarget: Container | null = null;
  private baseX = 0;
  private baseY = 0;
  private flashSprite: Graphics | null = null;
  private disposables: Array<() => void> = [];

  constructor(anim: AnimationSystem, stage: Container) {
    this.anim = anim;
    this.stage = stage;
  }

  /** Camera shake on the given container (usually the scene world). */
  shake(target: Container, baseX: number, baseY: number, intensity = 7, durMs = 320): void {
    this.shakeTarget = target;
    this.baseX = baseX;
    this.baseY = baseY;
    this.shakeAmp = intensity;
    this.shakeUntil = performance.now() + durMs;
    const start = performance.now();
    const cancel = this.anim.loop((dt) => {
      const now = performance.now();
      if (now >= this.shakeUntil || this.shakeAmp <= 0.2) {
        if (this.shakeTarget && !this.shakeTarget.destroyed) {
          this.shakeTarget.x = this.baseX;
          this.shakeTarget.y = baseY;
        }
        this.shakeAmp = 0;
        cancel();
        return;
      }
      const decay = 1 - (now - start) / Math.max(1, durMs);
      const amp = this.shakeAmp * Math.max(0.2, decay);
      if (this.shakeTarget && !this.shakeTarget.destroyed) {
        this.shakeTarget.x = this.baseX + (Math.random() * 2 - 1) * amp;
        this.shakeTarget.y = baseY + (Math.random() * 2 - 1) * amp;
      }
      void dt;
    });
    this.disposables.push(cancel);
  }

  /** Full-screen color flash (hit, level-up, danger). */
  flash(color: number, durMs = 220, alpha = 0.35): void {
    if (this.flashSprite && !this.flashSprite.destroyed) {
      this.flashSprite.destroy();
      this.flashSprite = null;
    }
    const g = new Graphics().rect(0, 0, 8000, 8000).fill({ color, alpha });
    g.x = -4000;
    g.y = -4000;
    g.alpha = alpha;
    this.stage.addChild(g);
    this.flashSprite = g;
    this.anim.to(g, { alpha: 0 }, { durationMs: durMs, ease: ease.outCubic, onDone: () => {
      if (!g.destroyed) g.destroy();
      if (this.flashSprite === g) this.flashSprite = null;
    } });
  }

  /** Time dilation for key moments (catches, finales). */
  slowmo(scale = 0.35, durMs = 650): void {
    this.timeScale = scale;
    this.anim.after(durMs, () => {
      this.timeScale = 1;
    });
  }

  /** Big center announcement that scales in, holds and fades. */
  announce(text: string, opts: { color?: number; y?: number; w?: number; durMs?: number; sub?: string } = {}): void {
    const dur = opts.durMs ?? 1500;
    const w = opts.w ?? 420;
    const y = opts.y ?? w * 0.75; /* caller passes real y */

    const box = new Container();
    const label = new Text({
      text,
      style: {
        fontFamily: 'Heebo, sans-serif',
        fontSize: 52,
        fontWeight: '900',
        fill: opts.color ?? COLORS.glow,
        align: 'center',
        stroke: { color: 0x050810, width: 8 },
      },
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    box.addChild(label);

    if (opts.sub) {
      const sub = new Text({
        text: opts.sub,
        style: {
          fontFamily: 'Heebo, sans-serif',
          fontSize: 24,
          fontWeight: '700',
          fill: COLORS.cream,
          align: 'center',
          stroke: { color: 0x050810, width: 5 },
        },
      });
      sub.anchor.set(0.5);
      sub.y = 46;
      sub.resolution = 2;
      box.addChild(sub);
    }

    box.x = w / 2;
    box.y = y;
    box.alpha = 0;
    box.scale.set(0.6);
    this.stage.addChild(box);
    audio.play('whoosh');
    this.anim.to(box, { alpha: 1, scale: 1.06 }, { durationMs: 260, ease: ease.outBack, onDone: () => {
      this.anim.to(box, { scale: 1 }, { durationMs: 140, ease: ease.outCubic, onDone: () => {
        this.anim.after(Math.max(300, dur - 700), () => {
          this.anim.to(box, { alpha: 0, y: y - 40 }, { durationMs: 380, ease: ease.inOutCubic, onDone: () => {
            if (!box.destroyed) box.destroy();
          } });
        });
      } });
    } });
  }

  /** Full-width sparkle rain (celebrations). */
  sparkleRain(particles: { emit: (opts: Record<string, unknown>) => void }, w: number): void {
    for (let i = 0; i < 5; i++) {
      this.anim.after(i * 140, () => {
        particles.emit({
          x: Math.random() * w,
          y: -10,
          count: 14,
          preset: 'sparkle',
          spread: 120,
          vy: 90,
        });
      });
    }
  }

  /** Soft edge vignette container (commercial depth cue). */
  static vignette(w: number, h: number): Container {
    const edge = Math.max(60, Math.min(w, h) * 0.16);
    const c = new Container();
    c.addChild(
      new Graphics().rect(0, 0, w, edge).fill({ color: COLORS.void, alpha: 0.42 }),
      new Graphics().rect(0, h - edge, w, edge).fill({ color: COLORS.void, alpha: 0.5 }),
      new Graphics().rect(0, 0, edge, h).fill({ color: COLORS.void, alpha: 0.3 }),
      new Graphics().rect(w - edge, 0, edge, h).fill({ color: COLORS.void, alpha: 0.3 }),
    );
    c.eventMode = 'none';
    return c;
  }

  destroy(): void {
    for (const d of this.disposables) d();
    this.disposables = [];
    this.timeScale = 1;
    this.shakeAmp = 0;
  }
}
