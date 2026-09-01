import type { Container } from 'pixi.js';
import { ease, easeStandard, type AnimationSystem, type TweenHandle } from './AnimationSystem';

/* ============================================================
   SceneTransition — the Stage-5 entrance/exit choreography.

   Entrance: fade + scale (0.9→1.0) + settle, 300ms, the standard
   material curve cubic-bezier(0.4, 0, 0.2, 1), items staggered
   50ms in scene order (background → pieces → indicators → FX).
   Exit: fade + slide out, same duration.
   Lenny gets his own bounce-from-the-roof entrance (500ms,
   easeOutBounce) used by LennyActor.

   Entrance is purely visual: geometry, hit logic and sceneState
   are final from frame zero, so e2e taps are valid mid-entrance.
   ============================================================ */

export const TRANSITION = {
  durMs: 300,
  staggerMs: 50,
  fromScale: 0.9,
  slidePx: 16,
} as const;

export interface EnterOptions {
  staggerMs?: number;
  durMs?: number;
  /** skip the scale part (full-screen backdrops fade better) */
  fadeOnly?: boolean;
}

export class SceneTransition {
  private anim: AnimationSystem;
  private handles: TweenHandle[] = [];

  constructor(anim: AnimationSystem) {
    this.anim = anim;
  }

  /** Staggered fade+scale entrance, in the given (z) order. */
  enter(items: Container[], opts: EnterOptions = {}): void {
    const stagger = opts.staggerMs ?? TRANSITION.staggerMs;
    const dur = opts.durMs ?? TRANSITION.durMs;
    let slot = 0;
    for (const item of items) {
      if (!item || item.destroyed) continue;
      const delay = slot * stagger;
      slot++;
      item.alpha = 0;
      const targetY = item.y;
      if (!opts.fadeOnly) item.scale.set(TRANSITION.fromScale);
      const delayHandle = this.anim.after(delay, () => {
        if (item.destroyed) return;
        if (!opts.fadeOnly) {
          this.handles.push(this.anim.to(item, { alpha: 1, scale: 1, y: targetY }, {
            durationMs: dur,
            ease: easeStandard,
          }));
        } else {
          this.handles.push(this.anim.to(item, { alpha: 1 }, { durationMs: dur, ease: easeStandard }));
        }
      });
      this.handles.push(delayHandle);
    }
  }

  /** Fade + slide up-out (exit wipe for canvas layers). */
  exit(item: Container, durMs = TRANSITION.durMs, onDone?: () => void): void {
    if (!item || item.destroyed) {
      onDone?.();
      return;
    }
    this.handles.push(this.anim.to(item, { alpha: 0, y: item.y - TRANSITION.slidePx }, {
      durationMs: durMs,
      ease: easeStandard,
      onDone: () => onDone?.(),
    }));
  }

  /** Lenny's signature: bounce drop from the roof, 500ms easeOutBounce. */
  bounceFromTop(item: Container, fromY: number, toY: number, durMs = 500): void {
    if (!item || item.destroyed) return;
    item.y = fromY;
    item.alpha = 1;
    this.handles.push(this.anim.to(item, { y: toY }, { durationMs: durMs, ease: ease.outBounce }));
  }

  /** Snap everything to its final state (used on teardown). */
  finishAll(): void {
    for (const h of this.handles) h.kill();
    this.handles = [];
  }

  destroy(): void {
    this.finishAll();
  }
}
