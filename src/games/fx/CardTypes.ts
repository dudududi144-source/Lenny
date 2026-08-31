/* ============================================================
 * CardTypes — the visual DNA of MemoryPairs (Stage 2b).
 *
 * MemoryPairs is no longer "six emoji pairs, always the same":
 * it is a LEVEL GENERATOR for working-memory training. Every
 * card face is a (suit, tone) kind — 8 kinds exist — and the
 * SIMILARITY BETWEEN THE PAIR KINDS in the deck is a direct
 * function of the DDA's continuous level:
 *
 *   low level  -> pair kinds are strangers (hot flower vs cool fish)
 *   high level -> pair kinds are near-twins (hot flower vs cool flower)
 *
 * That makes similarity() the game's core difficulty knob and
 * the DDA level (0..1) its single source of truth. The same
 * level also drives HOW MUCH the child is shown up-front
 * (exposure ladder: static study time -> timed peek -> short
 * peek + dim aid) — two axes, one number, no bespoke per-tier
 * content.
 *
 * Expected similarity values (spec-pinned):
 *   identical             -> 1
 *   same suit / diff tone -> 0.82   (0.7 + 0.3*0.4)
 *   diff suit / same tone -> 0.3
 *   nothing in common     -> 0.12
 *
 * This module is pure data + pure functions: no Phaser import,
 * fully unit-testable (src/__tests__/CardTypes.test.ts).
 * ============================================================ */

export type CardSuit = 'flower' | 'bug' | 'fish' | 'tree'; /* 4 משפחות ויזואליות */
export type CardTone = 'warm' | 'cool';                     /* 2 גוונים */

export interface CardType {
  suit: CardSuit;
  tone: CardTone;
}

export const SUITS: CardSuit[] = ['flower', 'bug', 'fish', 'tree'];
export const TONES: CardTone[] = ['warm', 'cool'];

/* The full content matrix: 4 suits x 2 tones = 8 card kinds. */
export const ALL_CARD_TYPES: CardType[] = SUITS.flatMap((suit) =>
  TONES.map((tone) => ({ suit, tone })),
);

/* Rendering palette. warm = sunset (coral / gold), cool = shade
   (violet / mint). The SHADE inside a tone alternates by suit
   index — even suits (flower 0, fish 2) take shade 0, odd suits
   (bug 1, tree 3) take shade 1 — so flower/fish share a shade
   and bug/tree share the other. Deterministic and unit-pinned:
   the e2e suite classifies tones from these exact hexes. */
export const TONE_SHADE_HEX: Record<CardTone, [number, number]> = {
  warm: [0xff7a6b, 0xf0c05a], /* coral, gold  */
  cool: [0xb18cff, 0x5fd9a9], /* violet, mint */
};

/** Deterministic face color for a card kind. */
export function colorFor(t: CardType): number {
  const shade = SUITS.indexOf(t.suit) % 2;
  return TONE_SHADE_HEX[t.tone][shade];
}

/**
 * Perceptual similarity between two card kinds, 0..1.
 * The suit (family) dominates: 0.7 weight vs the tone's 0.3.
 * A differing tone still "counts a little" (0.4): warm and cool
 * cousins of one family stay recognizably related.
 */
export function similarity(a: CardType, b: CardType): number {
  const suitSim = a.suit === b.suit ? 1 : 0;
  const toneSim = a.tone === b.tone ? 1 : 0.4;
  return suitSim * 0.7 + toneSim * 0.3;
}

/* ---------- exposure ladder (how much the child sees up front) ---------- */

export type ExposureMode = 'none' | 'peek' | 'peek-plus';

export interface Exposure {
  mode: ExposureMode;
  /* how long the full-deck reveal lasts (mode 'none' -> 0) */
  peekMs: number;
  /* in peek-plus, failed cards dim after this many misses
     (Infinity = the dim aid never engages) */
  dimAfterMisses: number;
}

/**
 * DDA level -> exposure plan:
 *   below 0.35  -> none: cards stay down, unlimited study time
 *   0.35..0.7   -> peek: one full-deck reveal for 1.2s per round
 *   above 0.7   -> peek-plus: shorter 0.8s reveal, and after 4
 *                  misses the failed cards dim slightly (a memory
 *                  aid that trims the working-memory load at the
 *                  hardest similarity levels)
 */
export function exposureFor(level: number): Exposure {
  if (level < 0.35) return { mode: 'none', peekMs: 0, dimAfterMisses: Infinity };
  if (level <= 0.7) return { mode: 'peek', peekMs: 1200, dimAfterMisses: Infinity };
  return { mode: 'peek-plus', peekMs: 800, dimAfterMisses: 4 };
}

/* ---------- deck generation (the "level generator" heart) ---------- */

/**
 * Pick `count` DISTINCT card kinds whose mutual similarity
 * clusters around the wanted band 0.15 + level * 0.55
 * (i.e. 0.15..0.7):
 *
 *   low level  -> kinds spread across families AND tones
 *   high level -> kinds bunch up as same-family tone-twins
 *
 * Greedy on the MEAN similarity to the already-picked set, with
 * a jitter source so repeated rounds at the same level don't
 * deal the exact same deck every time. Never returns more kinds
 * than exist; always returns exactly min(count, 8) kinds.
 */
export function selectPairTypes(
  count: number,
  level: number,
  rand: () => number = Math.random,
): CardType[] {
  const want = Math.max(0, Math.min(count, ALL_CARD_TYPES.length));
  const targetSim = 0.15 + level * 0.55;

  const remaining = ALL_CARD_TYPES.slice();
  const picked: CardType[] = [];

  /* random seed kind */
  const seedIdx = Math.min(remaining.length - 1, Math.floor(rand() * remaining.length));
  picked.push(remaining.splice(seedIdx, 1)[0]);

  while (picked.length < want && remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    let bestJitter = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const mean =
        picked.reduce((s, p) => s + similarity(p, remaining[i]), 0) / picked.length;
      const dist = Math.abs(mean - targetSim);
      const jitter = rand();
      if (dist < bestDist || (dist === bestDist && jitter < bestJitter)) {
        bestIdx = i;
        bestDist = dist;
        bestJitter = jitter;
      }
    }
    picked.push(remaining.splice(bestIdx, 1)[0]);
  }

  return picked;
}

/* ---------- error taxonomy (Stage 2b spec, verbatim order) ---------- */

/**
 * Classify a MISMATCHED pair of opened cards:
 *   sim >= 0.7            -> near-miss-same-suit-diff-tone
 *   same suit, other kind -> near-miss-same-suit
 *   same tone, other suit -> near-miss-same-tone
 *   else                  -> far-pair
 *
 * NOTE: with the current discrete palette every same-suit pair
 * scores >= 0.82, so the second branch is unreachable for
 * non-identical kinds. The order is kept exactly as specified
 * (future-proofing for richer tone metrics); the exhaustive
 * unit test documents this invariant.
 */
export function errorKindFor(first: CardType, second: CardType): string {
  const sim = similarity(first, second);
  if (sim >= 0.7) return 'near-miss-same-suit-diff-tone';
  if (first.suit === second.suit) return 'near-miss-same-suit';
  if (first.tone === second.tone) return 'near-miss-same-tone';
  return 'far-pair';
}
