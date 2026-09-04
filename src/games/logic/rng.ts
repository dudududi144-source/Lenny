/* ============================================================
 * rng — the shared deterministic randomness for game logic.
 *
 * The scenes may shuffle VISUALS freely (Pixi entrances bob and
 * sparkle), but every round's CONTENT must be a pure function of
 * its seeds so the unit tests can pin it and every device plays
 * the same game (the worldQuests.questHash discipline, in miniature).
 * ============================================================ */

/** Small deterministic 32-bit hash — same inputs, same output, forever. */
export function hash2(a: number, b: number): number {
  let h = (Math.max(0, Math.floor(a)) * 2654435761 + Math.max(0, Math.floor(b)) * 97 + 101) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h = (h ^ (h >>> 15)) >>> 0;
  return h;
}

/** mulberry32 — tiny seeded PRNG (the ground's own, in miniature). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates over a copy. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Clamp a tier into the honest 0..3 band. */
export function clampTier(tier: number): 0 | 1 | 2 | 3 {
  const t = Math.floor(Number.isFinite(tier) ? tier : 0);
  return Math.max(0, Math.min(3, t)) as 0 | 1 | 2 | 3;
}
