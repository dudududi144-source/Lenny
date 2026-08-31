/* ============================================================
 * IndicatorTypes — the visual DNA of SequenceEcho (Stage 2c).
 *
 * SequenceEcho is no longer "four fixed orbs, always the same":
 * it is a LEVEL GENERATOR for working memory. Every indicator is
 * a (shape, tone) kind — 6 kinds exist — and the SIMILARITY
 * BETWEEN THE KINDS in the round's echo sequence is a direct
 * function of the DDA's continuous level:
 *
 *   low level  -> echoed kinds are strangers (bright orb vs muted leaf)
 *   high level -> echoed kinds are near-twins (bright orb vs muted orb)
 *
 * That makes similarity() the game's core difficulty knob and
 * the DDA level (0..1) its single source of truth. The same
 * level also drives HOW the sequence plays (playback ladder:
 * length 2..5, gap 800..400ms, static -> gentle bobbing) —
 * two axes, one number, no bespoke per-tier content.
 *
 * Expected similarity values (spec-pinned):
 *   identical               -> 1
 *   same shape / diff tone  -> 0.82   (0.7 + 0.3*0.4)
 *   diff shape / same tone  -> 0.3
 *   nothing in common       -> 0.12
 *
 * This module is pure data + pure functions: no Phaser import,
 * fully unit-testable (src/__tests__/IndicatorTypes.test.ts).
 * ============================================================ */

export type IndicatorShape = 'orb' | 'chime' | 'leaf'; /* 3 צורות בסיס */
export type IndicatorTone = 'bright' | 'muted';        /* 2 גוונים */

export interface IndicatorType {
  shape: IndicatorShape;
  tone: IndicatorTone;
}

export const SHAPES: IndicatorShape[] = ['orb', 'chime', 'leaf'];
export const TONES: IndicatorTone[] = ['bright', 'muted'];

/* The full content matrix: 3 shapes x 2 tones = 6 kinds. */
export const ALL_INDICATOR_TYPES: IndicatorType[] = SHAPES.flatMap((shape) =>
  TONES.map((tone) => ({ shape, tone })),
);

/* Rendering palette. bright = luminous on the dark field (sun-gold /
   spring-mint), muted = dimmed cousins (dusk-lilac / sea-sage). The
   SHADE inside a tone alternates by shape index — even shapes
   (orb 0, leaf 2) take shade 0, odd shapes (chime 1) take shade 1 —
   so orb/leaf share a shade and chime has its own. Deterministic
   and unit-pinned: the e2e suite classifies tones from these exact
   hexes. Deliberately avoids every ParticleBurst / ProgressRing hue
   collision that a hue-band classifier could trip on (the ring's
   0xffd76a gold is the closest neighbor — the e2e reads the ring in
   its own corner region and indicator inks by LUMINANCE, not hue). */
export const TONE_SHADE_HEX: Record<IndicatorTone, [number, number]> = {
  bright: [0xffcf5c, 0x8df2b8], /* sun-gold, spring-mint  */
  muted:  [0x9379e0, 0x4f9e86], /* dusk-lilac, sea-sage   */
};

/** Deterministic ink color for an indicator kind. */
export function colorFor(t: IndicatorType): number {
  const shade = SHAPES.indexOf(t.shape) % 2;
  return TONE_SHADE_HEX[t.tone][shade];
}

/**
 * Perceptual similarity between two indicator kinds, 0..1.
 * The shape (family) dominates: 0.7 weight vs the tone's 0.3.
 * A differing tone still "counts a little" (0.4): bright and muted
 * cousins of one shape stay recognizably related.
 */
export function similarity(a: IndicatorType, b: IndicatorType): number {
  const shapeSim = a.shape === b.shape ? 1 : 0;
  const toneSim = a.tone === b.tone ? 1 : 0.4;
  return shapeSim * 0.7 + toneSim * 0.3;
}

/** Exact kind equality (both axes). */
export function isSameIndicator(a: IndicatorType, b: IndicatorType): boolean {
  return a.shape === b.shape && a.tone === b.tone;
}

/* ---------- playback plan (how the sequence is shown) ---------- */

export interface SequencePlan {
  /* how many kinds the echo contains: 2 + floor(level * 3) -> 2..5 */
  length: number;
  /* time between one indicator lighting and the next:
     800 - level * 400 ms -> 800..400 */
  gapMs: number;
  /* how long each indicator stays lit (a fraction of the gap) */
  flashMs: number;
  /* idle bobbing amplitude in px: a mild motion distraction.
     below level 0.35 the indicators are perfectly STATIC (spec:
     "אין הסחה" — no distraction at the gentlest band) */
  bobAmp: number;
  /* idle bobbing period in ms (fixed; phase varies per cell) */
  bobPeriodMs: number;
}

/**
 * DDA level -> playback plan:
 *   below 0.35  -> static indicators, sequences of 2-3, slow gaps
 *   0.35..0.7   -> sequences of 3-4, shorter gaps, gentle bobbing
 *   above 0.7   -> sequences of 4-5, shortest gaps, strongest bob
 */
export function sequencePlanFor(level: number): SequencePlan {
  const clamped = Math.max(0, Math.min(1, level));
  const length = 2 + Math.floor(clamped * 3);
  const gapMs = Math.round(800 - clamped * 400);
  return {
    length,
    gapMs,
    flashMs: Math.round(gapMs * 0.55),
    bobAmp: clamped < 0.35 ? 0 : 3 + clamped * 4,
    bobPeriodMs: 1634,
  };
}

/* ---------- sequence generation (the "level generator" heart) ---------- */

/**
 * Pick `count` DISTINCT indicator kinds whose mutual similarity
 * clusters around the wanted band 0.15 + level * 0.55
 * (i.e. 0.15..0.7):
 *
 *   low level  -> kinds spread across shapes AND tones
 *   high level -> kinds bunch up as same-shape tone-twins
 *
 * Greedy on the MEAN similarity to the already-picked set, with
 * a jitter source so repeated rounds at the same level don't deal
 * the exact same kinds every time. Never returns more kinds than
 * exist; always returns exactly min(count, 6) kinds.
 */
export function selectIndicatorTypes(
  count: number,
  level: number,
  rand: () => number = Math.random,
): IndicatorType[] {
  const want = Math.max(0, Math.min(count, ALL_INDICATOR_TYPES.length));
  const targetSim = 0.15 + level * 0.55;

  const remaining = ALL_INDICATOR_TYPES.slice();
  const picked: IndicatorType[] = [];

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

/**
 * The round's echo: `length` distinct kinds chosen by
 * selectIndicatorTypes, then shuffled into PLAY ORDER. Because the
 * selection is over distinct kinds, the echo never repeats a kind —
 * the child echoes an ORDER of distinguishable things, never a
 * multiset (spec: "אף סדרה לא מכילה סוג כפול").
 */
export function buildSequenceTypes(
  length: number,
  level: number,
  rand: () => number = Math.random,
): IndicatorType[] {
  const picked = selectIndicatorTypes(length, level, rand);
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

/* ---------- error taxonomy (Stage 2c spec, verbatim order) ---------- */

/**
 * Compare an echo attempt against the correct sequence,
 * POSITION BY POSITION. At the first divergent position:
 *   sim >= 0.7            -> near-miss-similar
 *   same shape, other kind-> near-miss-same-shape
 *   same tone, other shape-> near-miss-same-tone
 *   else                  -> wrong-item
 * If the prefixes all match but the lengths differ -> wrong-length.
 * Identical sequences -> 'none' (defensive; the scene only calls
 * this on a failed tap).
 *
 * NOTE: with the current discrete palette every same-shape pair
 * scores >= 0.82, so the second branch is unreachable for
 * non-identical kinds. The order is kept exactly as specified
 * (future-proofing for richer tone metrics); the exhaustive
 * unit test documents this invariant.
 *
 * NOTE 2: 'wrong-length' needs a full-prefix match with a length
 * mismatch — in live play a failed tap always diverges BEFORE the
 * sequence ends, so the scene's reachable kinds are the four
 * type-branches. The length branch stays for the pure contract
 * (and future call sites), exactly like MemoryPairs' unreachable
 * 'near-miss-same-suit' branch in Stage 2b.
 */
export function getErrorKind(sequence: IndicatorType[], userSequence: IndicatorType[]): string {
  const n = Math.min(sequence.length, userSequence.length);
  for (let i = 0; i < n; i++) {
    if (isSameIndicator(sequence[i], userSequence[i])) continue;
    const u = userSequence[i];
    const c = sequence[i];
    if (similarity(u, c) >= 0.7) return 'near-miss-similar';
    if (u.shape === c.shape) return 'near-miss-same-shape';
    if (u.tone === c.tone) return 'near-miss-same-tone';
    return 'wrong-item';
  }
  if (sequence.length !== userSequence.length) return 'wrong-length';
  return 'none';
}
