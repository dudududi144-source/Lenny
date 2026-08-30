/* ============================================================
 * FishTypes — the visual DNA of GlowFish (Stage 2).
 *
 * GlowFish is no longer "one glowing fish among random ones":
 * it is a LEVEL GENERATOR for visual-attention training. Every
 * fish in the pond is a (shape, color) kind — 24 kinds exist —
 * and the DISTANCE between distractors and the target is a
 * direct function of the DDA's continuous level:
 *
 *   low level  -> distractors look nothing like the target
 *   high level -> distractors are near-twins of the target
 *
 * That makes similarity() the game's core difficulty knob and
 * the DDA level (0..1) its single source of truth. The same
 * level also drives how much the pond moves (static / drift /
 * active) — three axes, one number, no bespoke per-tier content.
 *
 * This module is pure data + pure functions: no Phaser import,
 * fully unit-testable (src/__tests__/FishTypes.test.ts).
 * ============================================================ */

export type FishShape = 'round' | 'long' | 'flat' | 'angular';
export type FishColor = 'coral' | 'gold' | 'violet' | 'mint' | 'blue' | 'pink';

export interface FishType {
  shape: FishShape;
  color: FishColor;
}

export const FISH_SHAPES: FishShape[] = ['round', 'long', 'flat', 'angular'];
export const FISH_COLORS: FishColor[] = ['coral', 'gold', 'violet', 'mint', 'blue', 'pink'];

/* The full content matrix: 4 shapes x 6 colors = 24 fish kinds. */
export const ALL_FISH_TYPES: FishType[] = FISH_SHAPES.flatMap((shape) =>
  FISH_COLORS.map((color) => ({ shape, color })),
);

/* Rendering palette. NOTE: the 'gold' KIND renders slightly duller
   than the glowing target's light (TARGET_GLOW_HEX) so the target's
   glow stays unambiguous even when a distractor is a gold fish. */
export const FISH_COLOR_HEX: Record<FishColor, number> = {
  coral: 0xff7a6b,
  gold: 0xf0c05a,
  violet: 0xb18cff,
  mint: 0x5fd9a9,
  blue: 0x5aa9ff,
  pink: 0xff9ecf,
};

/** The exact hex the glowing target is drawn with (render + e2e anchor). */
export const TARGET_GLOW_HEX = 0xffd76a;

/**
 * Perceptual similarity between two fish kinds, 0..1:
 *   identical             -> 1
 *   same shape/diff color -> 0.65
 *   diff shape/same color -> 0.5
 *   nothing in common     -> 0.15
 * Color still "counts a little" when it differs: every palette
 * color is a warm/cool cousin of the others, so total strangers
 * still share fish-ness.
 */
export function similarity(a: FishType, b: FishType): number {
  const shapeSim = a.shape === b.shape ? 1 : 0;
  const colorSim = a.color === b.color ? 1 : 0.3;
  return (shapeSim + colorSim) / 2;
}

export type MovementMode = 'static' | 'drift' | 'active';

/** DDA level -> how much the pond moves. */
export function movementModeFor(level: number): MovementMode {
  if (level < 0.3) return 'static';
  if (level < 0.7) return 'drift';
  return 'active';
}

/**
 * Pick `count` distractor KINDS whose similarity to the target
 * clusters around the wanted band 0.2 + level*0.6 (i.e. 0.2..0.8).
 * Never returns the target itself; ties are broken by a shuffle
 * source so repeated rounds at the same level don't show the
 * exact same pond every time.
 */
export function selectDistractors(
  target: FishType,
  count: number,
  level: number,
  rand: () => number = Math.random,
): FishType[] {
  const wanted = 0.2 + level * 0.6;
  const pool = ALL_FISH_TYPES.filter(
    (t) => t.shape !== target.shape || t.color !== target.color,
  );
  const scored = pool.map((t) => ({
    t,
    d: Math.abs(similarity(target, t) - wanted),
    jitter: rand(),
  }));
  scored.sort((a, b) => (a.d - b.d) || (a.jitter - b.jitter));
  return scored.slice(0, Math.max(0, count)).map((s) => s.t);
}

/**
 * Error taxonomy for a wrong tap (Stage 2 spec):
 *   sim >= 0.75            -> near-miss-very-similar
 *   same color, other kind -> near-miss-same-color
 *   same shape, other kind -> near-miss-same-shape
 *   else                   -> far-tap
 * With the current discrete palette only an exact match reaches
 * 0.75, so the very-similar branch is future-proofing for richer
 * color metrics; the order still follows the spec verbatim.
 */
export function errorKindFor(target: FishType, tapped: FishType): string {
  const sim = similarity(target, tapped);
  if (sim >= 0.75) return 'near-miss-very-similar';
  if (tapped.color === target.color) return 'near-miss-same-color';
  if (tapped.shape === target.shape) return 'near-miss-same-shape';
  return 'far-tap';
}
