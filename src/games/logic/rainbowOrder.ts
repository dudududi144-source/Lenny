/* ============================================================
 * rainbowOrder — "גֶּשֶׁר הַקֶּשֶׁת" (bridge of the rainbow).
 *
 * The arch stones fell out of order. The child taps them in rainbow
 * order (red → orange → yellow → green → blue → violet) and each
 * stone flies to its place on the bridge. Seriation by a KNOWN
 * cultural sequence — the rainbow is its own legend, no text needed.
 * ============================================================ */

import { clampTier } from './rng';

export interface RainbowColor {
  hex: number;
  /** spoken+shown Hebrew color name (niqqud) */
  name: string;
}

/** The canonical rainbow — the game's own alphabet. */
export const RAINBOW_COLORS: readonly RainbowColor[] = [
  { hex: 0xe85a4f, name: 'אָדוֹם' },
  { hex: 0xf5923e, name: 'כָּתוֹם' },
  { hex: 0xf2d33c, name: 'צָהוֹב' },
  { hex: 0x58b95e, name: 'יָרוֹק' },
  { hex: 0x4a9eff, name: 'כָּחוֹל' },
  { hex: 0x9b6dd6, name: 'סָגוֹל' },
];

/** How many stones the bridge asks for at this DDA tier (4..6). */
export function stoneCountFor(tier: number): number {
  const t = clampTier(tier);
  return [4, 5, 6, 6][t];
}

/** The first N rainbow stones, IN rainbow order — the answer key. */
export function stonesFor(tier: number): RainbowColor[] {
  return RAINBOW_COLORS.slice(0, stoneCountFor(tier));
}
