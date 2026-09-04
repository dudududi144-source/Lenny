/* ============================================================
 * leafSize — "קִנֵּי הֶעָלִים" (leaf nests).
 *
 * Autumn leaves drift down one at a time; three nests wait —
 * small, medium, big. The child sorts each leaf into the nest
 * that fits. Classification into ordered bins (a gentler cousin
 * of full seriation: judge ONE leaf against three anchors).
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

/** 0 = small nest, 1 = medium, 2 = big. */
export type NestIndex = 0 | 1 | 2;

export const NEST_NAMES: readonly string[] = ['קָטָן', 'בֵּינוֹנִי', 'גָּדוֹל'];

/** Leaves per round — grows gently with the tier. */
export function leafCountFor(tier: number): number {
  const t = clampTier(tier);
  return [5, 6, 7, 8][t];
}

/** How different the three sizes LOOK (world-unit radius factors). */
export function contrastFor(tier: number): number {
  const t = clampTier(tier);
  /* high tier → sizes sit closer together: finer judgments */
  return [1.0, 0.85, 0.72, 0.62][t];
}

export interface LeafRound {
  /** one size per leaf, 0..2 — every size appears at least once */
  leaves: number[];
  contrast: number;
}

/** A deterministic leaf fall for (tier, seed, round). */
export function leafPlanFor(tier: number, seed: number, round: number): LeafRound {
  const count = leafCountFor(tier);
  const contrast = contrastFor(tier);
  const rnd = mulberry32(hash2(hash2(seed, 71), round));
  const leaves: number[] = [];
  /* guarantee the three sizes are represented, then fill freely */
  leaves.push(0, 1, 2);
  while (leaves.length < count) leaves.push(Math.floor(rnd() * 3));
  /* a deterministic shuffle keeps the fall honest */
  for (let i = leaves.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [leaves[i], leaves[j]] = [leaves[j], leaves[i]];
  }
  return { leaves, contrast };
}

/** Visual radius of a leaf in world units (big touch targets). */
export function leafRadius(size: number, contrast: number): number {
  return 26 + size * 16 * contrast;
}

/** The nest a leaf belongs to — trivially its own size. */
export function nestForLeaf(size: number): NestIndex {
  return Math.max(0, Math.min(2, Math.floor(size))) as NestIndex;
}
