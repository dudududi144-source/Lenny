/* ============================================================
 * windChime — "פַּעֲמוֹנֵי הָרוּחַ" (wind chimes).
 *
 * Six chimes hang in a row, each tuned a step of the pentatonic
 * ladder. The wind hums a short melody; the child echoes it by
 * tapping the chimes. Purely AUDITORY working memory: every chime
 * looks the same — the ear is the game (the echo-of-light scene
 * adds shape+tone cues; here the pitch alone carries the melody).
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

/** Six chimes = six steps of the shared pentatonic ladder. */
export const CHIME_COUNT = 6;

export const CHIME_PITCHES: readonly number[] = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25,
];

/** Melody length by tier — 3..6 notes. */
export function melodyLengthFor(tier: number): number {
  const t = clampTier(tier);
  return [3, 4, 5, 6][t];
}

/**
 * A deterministic melody for (tier, seed): chime indices with no
 * immediate repeats (a chime never fights itself).
 */
export function melodyFor(tier: number, seed: number): number[] {
  const len = melodyLengthFor(tier);
  const rnd = mulberry32(hash2(seed, 31));
  const out: number[] = [];
  while (out.length < len) {
    const next = Math.floor(rnd() * CHIME_COUNT);
    if (out.length > 0 && next === out[out.length - 1]) continue;
    out.push(next);
  }
  return out;
}

/** True when the echoed taps match the melody note for note so far. */
export function echoMatchesSoFar(input: readonly number[], melody: readonly number[]): boolean {
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== melody[i]) return false;
  }
  return true;
}

/** True when the echo is complete and exact. */
export function echoComplete(input: readonly number[], melody: readonly number[]): boolean {
  return input.length === melody.length && echoMatchesSoFar(input, melody);
}
