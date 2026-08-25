/* ============================================================
 * ColorMixSystem — a reusable color-mixing helper.
 *
 * Why this exists: creativity games often ask children to mix
 * primary colors to reach a target. Instead of each scene doing
 * its own RGB math, we build ONE small, correct helper.
 *
 * Design notes (the exemplar part):
 *  - Works in simple subtractive-ish mixing suitable for kids:
 *    red + yellow = orange, blue + yellow = green, red + blue = purple.
 *  - Pure functions: no state, easy to test.
 *  - Includes a target-matching helper for game logic.
 * ============================================================ */

export type Primary = 'red' | 'yellow' | 'blue';
export type MixedColor =
  | 'red' | 'yellow' | 'blue'
  | 'orange' | 'green' | 'purple';

const HEX: Record<MixedColor, number> = {
  red: 0xe5484d,
  yellow: 0xffd166,
  blue: 0x4d9de0,
  orange: 0xff8c42,
  green: 0x57cc99,
  purple: 0x9b5de5,
};

/** Hex value for any named color. */
export function colorHex(c: MixedColor): number {
  return HEX[c];
}

/** Mix two primaries. Returns the resulting color name. */
export function mixPrimaries(a: Primary, b: Primary): MixedColor {
  if (a === b) return a;
  const pair = [a, b].sort().join('+');
  if (pair === 'red+yellow') return 'orange';
  if (pair === 'blue+yellow') return 'green';
  if (pair === 'blue+red') return 'purple';
  return a;
}

/** All possible results of mixing two of the three primaries. */
export function allMixResults(): MixedColor[] {
  return ['orange', 'green', 'purple'];
}

/**
 * Check whether two primaries produce a target color.
 * Useful for 'make green!' style prompts.
 */
export function makesTarget(a: Primary, b: Primary, target: MixedColor): boolean {
  return mixPrimaries(a, b) === target;
}

/**
 * Blend two hex colors numerically (0..1 toward the second).
 * Handy for smooth visual transitions, not for kid-logic mixing.
 */
export function blendHex(c1: number, c2: number, f: number): number {
  const t = Math.max(0, Math.min(1, f));
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
