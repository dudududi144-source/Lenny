/* ============================================================
 * soundHunt — "אֵיפֹה הַצָּפְרְדֵּעַ?" (where is the frog?).
 *
 * A frog hides under one of the lily pads of the drum-square
 * pond. Every few seconds it CROAKS — the pad it hides under
 * bubbles for a moment (the eye confirms what the ear heard).
 * The child taps the bubbling pad; the frog pops up, delighted.
 * A miss just empties the pad — no frog, no fail, try again.
 * Sustained audio-visual attention with a peek-a-boo soul.
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

/** Lily pads per tier — 4..6, always an even, calm number of hiding spots. */
export function padCountFor(tier: number): number {
  const t = clampTier(tier);
  return [4, 5, 6, 6][t];
}

/** How long the frog's bubble stays visible, by tier (ms) — the difficulty. */
export function bubbleMsFor(tier: number): number {
  const t = clampTier(tier);
  return [1050, 880, 720, 600][t];
}

/** How often the frog croaks, by tier (ms) — patience, not speed. */
export function croakEveryFor(tier: number): number {
  const t = clampTier(tier);
  return [3000, 3400, 3800, 4200][t];
}

export interface PadLayout {
  n: number;
  /** pad positions in the 0..1 layout square, min separation enforced */
  pads: Array<{ x: number; y: number }>;
}

const MIN_SEPARATION = 0.24;

/**
 * A deterministic pond: rejection-sampled pads with a minimum
 * separation, so every device hides the frog in the same pond.
 */
export function padLayoutFor(tier: number, seed: number): PadLayout {
  const n = padCountFor(tier);
  const rnd = mulberry32(hash2(seed, 47));
  const pads: Array<{ x: number; y: number }> = [];
  let guard = 0;
  while (pads.length < n && guard < 4000) {
    guard++;
    const x = 0.12 + rnd() * 0.76;
    const y = 0.12 + rnd() * 0.76;
    let ok = true;
    for (const p of pads) {
      if (Math.hypot(x - p.x, y - p.y) < MIN_SEPARATION) {
        ok = false;
        break;
      }
    }
    if (ok) pads.push({ x, y });
  }
  /* fallback (never expected): a wide ring so n pads ALWAYS land */
  while (pads.length < n) {
    const a = (pads.length / n) * Math.PI * 2;
    pads.push({ x: 0.5 + Math.cos(a) * 0.34, y: 0.5 + Math.sin(a) * 0.34 });
  }
  return { n, pads };
}

/** Which pad hides the frog this round — deterministic in (tier, seed). */
export function frogPadFor(padCount: number, seed: number): number {
  const rnd = mulberry32(hash2(seed, 63));
  return Math.floor(rnd() * padCount) % Math.max(1, padCount);
}
