import { Container, Sprite, Text } from 'pixi.js';
import type { GameSpec } from '../builder/GameSpec';
import { AdaptiveDifficulty, type HintStrength } from '../core/AdaptiveDifficulty';
import { LearningSignals } from '../core/LearningSignals';
import { recordZoneFinish } from '../core/ProgressStore';
import type { HudBridge } from '../../ui/components/GameHUD';
import { AnimationSystem, ease } from './AnimationSystem';
import { audio } from './AudioEngine';
import { GardenBackdrop } from './GardenBackdrop';
import { FX } from './FX';
import { ResultsCeremony } from './ResultsCeremony';
import { bursts, ParticleSystem } from './ParticleSystem';
import { ringTexture, softGlowTexture } from './textures';
import { COLORS } from './theme';
import type { SessionStats } from './ScoreDirector';
import { ScoreDirector } from './ScoreDirector';

export interface SceneCtx {
  /** the live pixi Application (for renderer checks only) */
  app: unknown;
  zone: string;
  spec: GameSpec | null;
  hud: HudBridge;
  onExit(): void;
  /** replay the same scene fresh (Arena results ceremony) */
  onReplay?(): void;
}

/** Reference design space — the Arena scales this to any screen. */
export const REFERENCE = { w: 420, h: 720 } as const;

/**
 * GameScene v2 (Arena) — full-bleed responsive base for every game.
 *
 * World model: the scene lays out in WORLD units. World size = canvas
 * pixels / unit, where unit = min(pxW/420, pxH/720). The world always
 * covers the whole canvas (never smaller than the reference space in
 * either dimension), so scenes position with this.w/this.h fractions
 * and stay correct from a 320px phone to a 1400px desktop.
 *
 * Owns: backdrop, particles, tweens, score/combo (ScoreDirector),
 * game-feel FX (shake/flash/slowmo/announce), procedural audio,
 * the cognitive core wiring (DDA + LearningSignals, untouched), the
 * HUD bridge and the results-ceremony finish flow.
 */
export abstract class GameScene {
  readonly root = new Container(); /* world space — scaled by unit */
  /** top-most world-space layer for announcements/big FX */
  readonly fxLayer = new Container();
  readonly dda: AdaptiveDifficulty;
  readonly signals = new LearningSignals();
  readonly particles = new ParticleSystem();
  readonly anim = new AnimationSystem();
  readonly score: ScoreDirector;
  readonly fx: FX;

  protected ctx: SceneCtx;
  protected backdrop: GardenBackdrop;
  protected t = 0;
  /** true once destroy() began — derived updates must bail out. */
  protected tornDown = false;

  private worldW: number = REFERENCE.w;
  private worldH: number = REFERENCE.h;
  private worldUnit = 1;
  private startedAt = performance.now();
  private finished = false;
  private ceremony: ResultsCeremony | null = null;
  private comboNotified = 0;

  protected constructor(ctx: SceneCtx) {
    this.ctx = ctx;
    this.dda = new AdaptiveDifficulty(ctx.zone);
    this.backdrop = new GardenBackdrop(this.worldW, this.worldH);
    this.root.addChild(this.backdrop.container);
    this.root.addChild(this.particles.container);

    this.score = new ScoreDirector();
    this.score.bind(this.anim, (combo, mult) => {
      if (combo !== this.comboNotified) {
        this.comboNotified = combo;
        this.ctx.hud.combo?.(combo, mult);
      }
      this.ctx.hud.score?.(this.score.points);
    });
    this.root.addChild(this.score.layer);
    this.root.addChild(this.fxLayer);

    this.fx = new FX(this.anim, this.fxLayer);
    ctx.hud.ringReset();
    ctx.hud.pauseEnabled?.(true);

    /* Adopt the canvas's current size BEFORE the scene's build() runs,
       so every spawn position is computed in the final world space. */
    const renderer = (ctx.app as { renderer?: { width: number; height: number } } | null | undefined)?.renderer;
    if (renderer && renderer.width > 0 && renderer.height > 0) {
      this.resizeView(renderer.width, renderer.height);
    }
  }

  /* ---------- world geometry ---------- */

  /** World width in world units (covers the whole canvas). */
  get w(): number {
    return this.worldW;
  }

  /** World height in world units. */
  get h(): number {
    return this.worldH;
  }

  /** Scale factor: world units → canvas pixels. */
  get unit(): number {
    return this.worldUnit;
  }

  /** Reference-space helper for sizing (scales content on big screens). */
  protected scaled(base: number): number {
    return base * Math.min(1.35, Math.max(1, this.worldUnit * (this.worldW / REFERENCE.w)));
  }

  /** GameApp notifies pixel size; we derive world + notify the scene. */
  resizeView(pxW: number, pxH: number): void {
    const unit = Math.min(pxW / REFERENCE.w, pxH / REFERENCE.h);
    const w = pxW / unit;
    const h = pxH / unit;
    if (Math.abs(w - this.worldW) < 0.5 && Math.abs(h - this.worldH) < 0.5) return;
    this.worldUnit = unit;
    this.worldW = w;
    this.worldH = h;
    this.root.scale.set(this.worldUnit);
    this.backdrop.resize(this.worldW, this.worldH);
    this.layout();
  }

  /** Scenes reposition their content here on resize. */
  protected layout(): void {}

  /* ---------- input routing (pixels → world; ceremony first) ---------- */

  pointerDown(px: number, py: number): boolean {
    const p = this.toWorld(px, py);
    if (this.ceremony?.isOpen()) return this.ceremony.onTap(p.x, p.y);
    this.onDragStart(p.x, p.y);
    return this.onTap(p.x, p.y);
  }

  pointerMove(px: number, py: number): void {
    const p = this.toWorld(px, py);
    this.onDragMove(p.x, p.y);
  }

  pointerUp(px: number, py: number): void {
    const p = this.toWorld(px, py);
    this.onDragEnd(p.x, p.y);
  }

  protected toWorld(px: number, py: number): { x: number; y: number } {
    return { x: px / this.worldUnit, y: py / this.worldUnit };
  }

  /** Design-space tap (world units). Returns true when hit something live. */
  onTap(_x: number, _y: number): boolean {
    return false;
  }

  onDragStart(_x: number, _y: number): void {}
  onDragMove(_x: number, _y: number): void {}
  onDragEnd(_x: number, _y: number): void {}

  debugState(): Record<string, unknown> {
    return {};
  }

  /** Arena session info merged into the e2e bridge by GameHost.
      Keys are arena-prefixed so they never collide with scene keys. */
  sessionDebug(): Record<string, unknown> {
    const c = this.ceremony?.debugState();
    return {
      arenaScore: this.score.points,
      arenaCombo: this.comboNotified,
      arenaMult: this.score.multiplier(),
      ceremonyOpen: (c?.ceremony as boolean) ?? false,
      ceremonyStars: (c?.stars as number) ?? 0,
      newRecord: (c?.newRecord as boolean) ?? false,
    };
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

  /** Expanding ring at (x, y) — the scene-wide "touch landed" language. */
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

  /* ---------- finish flows ---------- */

  /** Win flow with the full Arena ceremony: stats, stars, record,
      replay/exit. Scenes opt in; progress is recorded immediately. */
  protected finishWithCeremony(opts: { title?: string; quiet?: boolean } = {}): void {
    if (this.finished) return;
    this.finished = true;
    const stats: SessionStats = this.score.stats();
    recordZoneFinish(this.ctx.zone, stats.secs);

    const ceremony = new ResultsCeremony(this.anim, this.w, this.h, {
      onReplay: () => {
        if (this.ctx.onReplay) this.ctx.onReplay();
        else this.ctx.onExit();
      },
      onExit: () => this.ctx.onExit(),
    });
    this.ceremony = ceremony;
    this.root.addChild(ceremony.root);

    if (!opts.quiet) {
      bursts.confetti(this.particles, this.w / 2, this.h * 0.3);
      bursts.sparkle(this.particles, this.w / 2, this.h * 0.24);
      this.fx.shake(this.root, 0, 0, 4, 240);
      audio.play('fanfare');
    }
    this.anim.after(700, () => {
      if (this.tornDown) return;
      ceremony.show(this.ctx.zone, stats, opts.title);
      /* auto-advance: watch the stars, then the garden takes over */
      this.anim.after(5200, () => {
        if (this.tornDown || !ceremony.isOpen()) return;
        ceremony.dismiss();
        this.ctx.onExit();
      });
    });
  }

  /** Legacy instant finish (non-migrated scenes): record + celebrate + leave. */
  protected finish(gapMs = 2400): void {
    if (this.finished) return;
    this.finished = true;
    const secs = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
    recordZoneFinish(this.ctx.zone, secs);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.32);
    bursts.sparkle(this.particles, this.w / 2, this.h * 0.26);
    audio.play('fanfare');
    this.anim.after(gapMs, () => window.setTimeout(() => this.ctx.onExit(), 0));
  }

  /** Non-recording exit (free-play scenes), same tick-safety. */
  protected exitSoon(delayMs: number): void {
    this.anim.after(delayMs, () => window.setTimeout(() => this.ctx.onExit(), 0));
  }

  /** True once finish() ran — scenes guard their input with this. */
  protected isFinished(): boolean {
    return this.finished;
  }

  /* ---------- tick ---------- */

  update(dtMs: number): void {
    const dt = dtMs * this.fx.timeScale;
    this.t += dt;
    this.backdrop.update(dt, this.t);
    this.particles.update(dt);
    this.anim.update(dt);
    this.score.update();
  }

  destroy(): void {
    this.tornDown = true;
    audio.stopMusic();
    this.fx.destroy();
    this.anim.destroy();
    this.particles.dispose();
    this.ceremony?.destroy();
    this.score.destroy();
    this.root.destroy({ children: true });
  }
}
