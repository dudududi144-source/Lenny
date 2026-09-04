/* ============================================================
 * countTap — "סְפִירַת בְּלוּטִים" (counting the squirrel's stash).
 *
 * The squirrel dropped acorns all over the clearing. The child
 * taps each acorn ONCE to count it: every new acorn sings the
 * next number word and hops, and the LAST number sung is how
 * many there are (order-irrelevant cardinality — the deepest
 * counting idea a 4-year-old can own). No wrong answer exists:
 * tapping an already-counted acorn wiggles it, tapping the dirt
 * does nothing. The set size is the difficulty.
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

/** Acorns per tier — 4..9 (SpecValidator caps itemCount at 12). */
export function acornCountFor(tier: number): number {
  const t = clampTier(tier);
  return [4, 6, 8, 9][t];
}

export interface AcornField {
  n: number;
  /** positions in the 0..1 layout square, min separation enforced */
  acorns: Array<{ x: number; y: number }>;
}

const MIN_SEPARATION = 0.17;

/**
 * A deterministic, well-spread acorn field: rejection-sampled with a
 * fixed seed, so every device drops the same stash (and the unit
 * tests can pin it).
 */
export function acornFieldFor(tier: number, seed: number): AcornField {
  const n = acornCountFor(tier);
  const rnd = mulberry32(hash2(seed, 71));
  const acorns: Array<{ x: number; y: number }> = [];
  let guard = 0;
  while (acorns.length < n && guard < 4000) {
    guard++;
    const x = 0.08 + rnd() * 0.84;
    const y = 0.1 + rnd() * 0.8;
    let ok = true;
    for (const s of acorns) {
      if (Math.hypot(x - s.x, y - s.y) < MIN_SEPARATION) {
        ok = false;
        break;
      }
    }
    if (ok) acorns.push({ x, y });
  }
  /* fallback (never expected): a relaxed ring so n acorns ALWAYS land */
  while (acorns.length < n) {
    const a = (acorns.length / n) * Math.PI * 2;
    acorns.push({ x: 0.5 + Math.cos(a) * 0.36, y: 0.5 + Math.sin(a) * 0.36 });
  }
  return { n, acorns };
}

/** True when every acorn has been counted exactly once. */
export function isCountComplete(countedCount: number, total: number): boolean {
  return total > 0 && countedCount >= total;
}

/** The spoken ordinal word for the running count (1-based), niqqud-safe. */
export const COUNT_WORDS: readonly string[] = [
  'אַחַת', 'שְׁתַּיִם', 'שָׁלוֹשׁ', 'אַרְבַּע', 'חָמֵשׁ',
  'שֵׁשׁ', 'שֶׁבַע', 'שְׁמֹנֶה', 'תֵּשַׁע', 'עֶשֶׂר',
];

export function countWord(index1Based: number): string {
  return COUNT_WORDS[index1Based - 1] ?? String(index1Based);
}
