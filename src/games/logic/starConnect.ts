/* ============================================================
 * starConnect — "קִשּׁוּר הַכּוֹכָבִים" (connect the stars).
 *
 * Stars wear the numerals 1..N; the child taps them in counting
 * order and each correct tap draws a golden thread to the next
 * star until a constellation closes. Numeral order = the number
 * line as a spatial journey (logic / early math).
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

/** Spoken Hebrew numerals 1..10 (the scene sings them on each hit). */
export const NUMERAL_NAMES: readonly string[] = [
  'אַחַד', 'שְׁתַּיִם', 'שָׁלוֹשׁ', 'אַרְבַּע', 'חָמֵשׁ',
  'שֵׁשׁ', 'שֶׁבַע', 'שְׁמֹנֶה', 'תֵּשַׁע', 'עֶשֶׂר',
];

export function starCountFor(tier: number): number {
  const t = clampTier(tier);
  return [4, 6, 8, 10][t];
}

export interface StarField {
  n: number;
  /** positions in the 0..1 layout square, min separation enforced */
  stars: Array<{ x: number; y: number }>;
}

const MIN_SEPARATION = 0.21;

/**
 * A deterministic, well-spread star field: rejection-sampled with a
 * fixed seed, so every device draws the same constellation frame.
 */
export function starFieldFor(tier: number, seed: number): StarField {
  const n = starCountFor(tier);
  const rnd = mulberry32(hash2(seed, 57));
  const stars: Array<{ x: number; y: number }> = [];
  let guard = 0;
  while (stars.length < n && guard < 4000) {
    guard++;
    const x = 0.12 + rnd() * 0.76;
    const y = 0.12 + rnd() * 0.76;
    let ok = true;
    for (const s of stars) {
      if (Math.hypot(x - s.x, y - s.y) < MIN_SEPARATION) {
        ok = false;
        break;
      }
    }
    if (ok) stars.push({ x, y });
  }
  /* fallback (never expected): a relaxed ring so n stars ALWAYS land */
  while (stars.length < n) {
    const a = (stars.length / n) * Math.PI * 2;
    stars.push({ x: 0.5 + Math.cos(a) * 0.34, y: 0.5 + Math.sin(a) * 0.34 });
  }
  return { n, stars };
}
