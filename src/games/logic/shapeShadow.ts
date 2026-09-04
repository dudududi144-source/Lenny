/* ============================================================
 * shapeShadow — "צְלָלִים מְדֻיֶּיקִים" (true shadows).
 *
 * One shape glows on the lantern wall; 3-4 dark silhouettes wait
 * below. Exactly one shadow keeps the WHOLE outline — the others
 * lost a corner, grew an extra point, rounded an edge. Tap the
 * true shadow. Perceptual matching under silhouette reduction.
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'diamond';

export const ALL_SHAPES: readonly ShapeKind[] = [
  'circle', 'square', 'triangle', 'star', 'heart', 'diamond',
];

export interface ShadowChallenge {
  shape: ShapeKind;
  options: ShapeKind[];
  answer: ShapeKind;
}

/** Distractor families: same-family silhouettes are the honest confusions. */
const FAMILY_OF: Record<ShapeKind, 'round' | 'pointy'> = {
  circle: 'round',
  heart: 'round',
  square: 'pointy',
  triangle: 'pointy',
  star: 'pointy',
  diamond: 'pointy',
};

function pickSome(pool: readonly ShapeKind[], want: number, rnd: () => number): ShapeKind[] {
  const bag = [...pool];
  const out: ShapeKind[] = [];
  for (let i = 0; i < want && bag.length > 0; i++) {
    const idx = Math.floor(rnd() * bag.length);
    out.push(bag.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * A deterministic challenge: `answer` == `shape`; options carry the
 * answer plus distinct distractors (same family at tier >= 2 — the
 * silhouette must be READ, not recognized from across the room).
 */
export function shadowChallengeFor(tier: number, seed: number, round: number): ShadowChallenge {
  const t = clampTier(tier);
  const rnd = mulberry32(hash2(hash2(seed, 91), round));
  const shape = ALL_SHAPES[Math.floor(rnd() * ALL_SHAPES.length)];

  const optionCount = t >= 1 ? 4 : 3;
  const family = FAMILY_OF[shape];
  const nearPool = ALL_SHAPES.filter((s) => s !== shape && FAMILY_OF[s] === family);
  const farPool = ALL_SHAPES.filter((s) => s !== shape && FAMILY_OF[s] !== family);

  /* higher tiers lean on near-family confusions first */
  const nearWanted = t >= 2 ? Math.min(2, nearPool.length) : t === 1 ? 1 : 0;
  const distractors = pickSome(nearPool, nearWanted, rnd);
  const rest = Math.max(0, optionCount - 1 - distractors.length);
  const mixed = [...nearPool, ...farPool].filter((s) => !distractors.includes(s));
  distractors.push(...pickSome(mixed, rest, rnd));

  /* deterministic shuffle of the full option row */
  const options = [...distractors, shape];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { shape, options, answer: shape };
}
