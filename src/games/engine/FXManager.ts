import { Application, BlurFilter, ColorMatrixFilter, Container, WebGPURenderer, type Filter } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { COLORS } from './theme';
import { FX } from './FX';

/* ============================================================
   FXManager — the centralized filter layer (Stage 5 polish).

   One owner for every real GPU filter in a scene:
     glow        — pixi-filters GlowFilter (pooled, tinted)
     blur        — PixiJS BlurFilter (depth-of-field, freeze)
     colorMatrix — brightness/saturation pulses (hit, celebrate)

   Renderer-aware: filters are attached and reported per capability;
   when a filter cannot run in the active renderer (WebGL1-era
   devices) the manager degrades to no-op and REPORTS it via
   `capabilities` (surfaced through the e2e bridge) instead of
   throwing. The existing renderer/gameplay paths are untouched —
   filters are additive visual layers only.
   ============================================================ */

export type FxRendererKind = 'webgpu' | 'webgl' | 'none';

export type FxCapability = 'glow' | 'blur' | 'color-matrix';

export interface GlowOptions {
  color?: number;
  /** outer glow strength (1..4 typical) */
  strength?: number;
  /** glow reach in world px */
  distance?: number;
  /** slow breathing pulse of the glow strength */
  pulse?: { amount: number; periodMs: number };
}

export interface FxGlowHandle {
  update(strength: number): void;
  dispose(): void;
}

interface AppliedRecord {
  target: Container;
  filter: GlowFilter | BlurFilter | ColorMatrixFilter;
  was: readonly Filter[] | null;
  pulsing?: { filter: GlowFilter; base: number; amount: number; periodMs: number; age: number };
}

export class FXManager {
  private applied: AppliedRecord[] = [];
  private glowPool: GlowFilter[] = [];
  private blurPool: BlurFilter[] = [];
  private matrixPool: ColorMatrixFilter[] = [];
  private warned = false;

  /** Capability report — mirrored into the e2e bridge by GameScene. */
  readonly capabilities: Record<FxCapability, boolean> = {
    glow: true,
    blur: true,
    'color-matrix': true,
  };

  rendererKind: FxRendererKind = 'none';
  /** Number of live filter attachments (observability + tests). */
  activeCount = 0;

  /** Probe the app's renderer once, before any filter is created. */
  attach(app: Application | null | undefined): void {
    if (!app) {
      this.rendererKind = 'none';
      return;
    }
    try {
      this.rendererKind = app.renderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
    } catch {
      this.rendererKind = 'none';
    }
  }

  private reportDisabled(cap: FxCapability, err: unknown): void {
    this.capabilities[cap] = false;
    if (!this.warned) {
      this.warned = true;
      console.warn(`[FXManager] ${cap} filter unavailable on ${this.rendererKind} — degrading gracefully`, err);
    }
  }

  /* ---------------- glow ---------------- */

  /** Real GlowFilter on the target. Falls back to no-op (reported). */
  glow(target: Container, opts: GlowOptions = {}): FxGlowHandle {
    if (target.destroyed) return { update: () => undefined, dispose: () => undefined };
    let filter: GlowFilter;
    try {
      filter = this.glowPool.pop() ?? new GlowFilter();
    } catch (err) {
      this.reportDisabled('glow', err);
      return { update: () => undefined, dispose: () => undefined };
    }
    const strength = Math.max(0, opts.strength ?? 1.6);
    filter.distance = Math.max(2, opts.distance ?? 14);
    filter.color = opts.color ?? COLORS.glow;
    filter.outerStrength = strength;
    filter.innerStrength = 0;
    filter.alpha = 0.9;
    filter.quality = 0.35; /* cheap — the pool reuses it anyway */

    const was = target.filters ?? null;
    try {
      target.filters = [...(was ?? []), filter];
    } catch (err) {
      this.reportDisabled('glow', err);
      this.glowPool.push(filter);
      return { update: () => undefined, dispose: () => undefined };
    }

    const rec: AppliedRecord = { target, filter, was };
    if (opts.pulse) {
      rec.pulsing = { filter, base: strength, amount: opts.pulse.amount, periodMs: opts.pulse.periodMs, age: 0 };
    }
    this.applied.push(rec);
    this.activeCount++;

    return {
      update: (next: number) => {
        filter.outerStrength = Math.max(0, next);
        if (rec.pulsing) rec.pulsing.base = Math.max(0, next);
      },
      dispose: () => {
        if (target.destroyed) return;
        this.detach(rec);
      },
    };
  }

  /* ---------------- blur ---------------- */

  /** Soft blur (backdrop depth, freeze moments). */
  blur(target: Container, strength = 4): FxGlowHandle {
    if (target.destroyed) return { update: () => undefined, dispose: () => undefined };
    let filter: BlurFilter;
    try {
      filter = this.blurPool.pop() ?? new BlurFilter({ strength: 1 });
    } catch (err) {
      this.reportDisabled('blur', err);
      return { update: () => undefined, dispose: () => undefined };
    }
    filter.strength = Math.max(0, strength);
    filter.quality = 2;

    const was = target.filters ?? null;
    try {
      target.filters = [...(was ?? []), filter];
    } catch (err) {
      this.reportDisabled('blur', err);
      this.blurPool.push(filter);
      return { update: () => undefined, dispose: () => undefined };
    }

    const rec: AppliedRecord = { target, filter, was };
    this.applied.push(rec);
    this.activeCount++;
    return {
      update: (next: number) => {
        filter.strength = Math.max(0, next);
      },
      dispose: () => {
        if (target.destroyed) return;
        this.detach(rec);
      },
    };
  }

  /* ---------------- color matrix ---------------- */

  /** Warm brightness lift — celebration/hit pulses, no hue drift. */
  lift(target: Container, brightness = 1.25, saturation = 1.12): FxGlowHandle {
    if (target.destroyed) return { update: () => undefined, dispose: () => undefined };
    let filter: ColorMatrixFilter;
    try {
      filter = this.matrixPool.pop() ?? new ColorMatrixFilter();
    } catch (err) {
      this.reportDisabled('color-matrix', err);
      return { update: () => undefined, dispose: () => undefined };
    }
    try {
      filter.brightness(brightness, false);
      filter.saturate(saturation, false);
    } catch (err) {
      this.reportDisabled('color-matrix', err);
      this.matrixPool.push(filter);
      return { update: () => undefined, dispose: () => undefined };
    }

    const was = target.filters ?? null;
    try {
      target.filters = [...(was ?? []), filter];
    } catch (err) {
      this.reportDisabled('color-matrix', err);
      this.matrixPool.push(filter);
      return { update: () => undefined, dispose: () => undefined };
    }

    const rec: AppliedRecord = { target, filter, was };
    this.applied.push(rec);
    this.activeCount++;
    return {
      update: (next: number) => {
        try {
          filter.brightness(Math.max(0, next), false);
        } catch { /* degrade silently mid-life */ }
      },
      dispose: () => {
        if (target.destroyed) return;
        this.detach(rec);
      },
    };
  }

  /* ---------------- atmosphere ---------------- */

  /** Scene-wide finish: subjective vignette above the world. */
  atmosphere(world: Container, w: number, h: number, alpha = 1): void {
    const vignette = FX.vignette(w, h);
    vignette.alpha = alpha;
    world.addChildAt(vignette, 0); /* fxLayer bottom — never covers announcements */
  }

  /* ---------------- tick ---------------- */

  update(dtMs: number): void {
    for (const rec of this.applied) {
      const p = rec.pulsing;
      if (!p || rec.target.destroyed) continue;
      p.age = (p.age + dtMs) % p.periodMs;
      const wave = Math.sin((p.age / p.periodMs) * Math.PI * 2);
      p.filter.outerStrength = p.base + wave * p.amount;
    }
  }

  private detach(rec: AppliedRecord): void {
    const idx = this.applied.indexOf(rec);
    if (idx >= 0) {
      this.applied.splice(idx, 1);
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
    try {
      if (!rec.target.destroyed) {
        const current = rec.target.filters ?? [];
        rec.target.filters = current.filter((f) => f !== rec.filter);
        if (rec.target.filters.length === 0) rec.target.filters = null;
      }
    } catch { /* target died mid-detach — nothing to restore */ }
    if (rec.filter instanceof GlowFilter) this.glowPool.push(rec.filter);
    else if (rec.filter instanceof BlurFilter) this.blurPool.push(rec.filter);
    else if (rec.filter instanceof ColorMatrixFilter) {
      try {
        rec.filter.reset();
      } catch { /* pool reuse resets via next call's brightness() */ }
      this.matrixPool.push(rec.filter);
    }
    rec.pulsing = undefined;
  }

  /** Release everything (scene teardown). Pool survives for the next scene. */
  dispose(): void {
    for (const rec of [...this.applied]) this.detach(rec);
    this.applied = [];
    this.activeCount = 0;
  }
}
