/* ============================================================
 * FishTypes tests — the Stage 2 difficulty generator's math.
 *
 * These pin the spec's expected similarity values (identical=1 /
 * same-shape=0.65 / same-color=0.5 / strangers=0.15), the
 * distractor-selection contract (level drives similarity, the
 * target itself never comes back), the movement-mode thresholds
 * and the error taxonomy ordering.
 * ============================================================ */

import { describe, it, expect } from 'vitest';
import {
  ALL_FISH_TYPES,
  FishType,
  similarity,
  selectDistractors,
  movementModeFor,
  errorKindFor,
} from '../games/fx/FishTypes';

const round: FishType = { shape: 'round', color: 'coral' };
const sameShapeDiffColor: FishType = { shape: 'round', color: 'mint' };
const diffShapeSameColor: FishType = { shape: 'long', color: 'coral' };
const stranger: FishType = { shape: 'flat', color: 'blue' };

/* deterministic shuffle source: always 0.5 (no jitter effect) */
const flatRand = () => 0.5;

describe('FishTypes content matrix', () => {
  it('offers exactly 24 kinds (4 shapes x 6 colors)', () => {
    expect(ALL_FISH_TYPES).toHaveLength(24);
  });

  it('has no duplicate kinds', () => {
    const keys = ALL_FISH_TYPES.map((t) => `${t.shape}:${t.color}`);
    expect(new Set(keys).size).toBe(24);
  });
});

describe('similarity — the difficulty knob', () => {
  it('identical kinds score 1', () => {
    expect(similarity(round, round)).toBe(1);
  });

  it('same shape, different color scores 0.65', () => {
    expect(similarity(round, sameShapeDiffColor)).toBe(0.65);
  });

  it('different shape, same color scores 0.5', () => {
    expect(similarity(round, diffShapeSameColor)).toBe(0.5);
  });

  it('nothing in common scores 0.15', () => {
    expect(similarity(round, stranger)).toBe(0.15);
  });

  it('is symmetric', () => {
    expect(similarity(round, stranger)).toBe(similarity(stranger, round));
    expect(similarity(round, sameShapeDiffColor)).toBe(
      similarity(sameShapeDiffColor, round),
    );
  });
});

describe('selectDistractors — similarity follows the level', () => {
  it('returns exactly the requested count', () => {
    const out = selectDistractors(round, 5, 0.5, flatRand);
    expect(out).toHaveLength(5);
  });

  it('never returns the target kind', () => {
    for (const lv of [0, 0.25, 0.5, 0.75, 1]) {
      const out = selectDistractors(round, 23, lv, flatRand);
      expect(out).not.toContainEqual(round);
      expect(out).toHaveLength(23); /* even when asked for every other kind */
    }
  });

  it('returns unique kinds', () => {
    const out = selectDistractors(round, 10, 0.7, flatRand);
    const keys = out.map((t) => `${t.shape}:${t.color}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('at level 0 the distractors are strangers (low similarity)', () => {
    const out = selectDistractors(round, 6, 0, flatRand);
    const mean = out.reduce((s, t) => s + similarity(round, t), 0) / out.length;
    expect(mean).toBeLessThan(0.35);
  });

  it('at level 1 the distractors are near-twins (high similarity)', () => {
    const out = selectDistractors(round, 6, 1, flatRand);
    const mean = out.reduce((s, t) => s + similarity(round, t), 0) / out.length;
    expect(mean).toBeGreaterThan(0.55);
  });

  it('high level yields strictly higher similarity than low level', () => {
    const low = selectDistractors(round, 8, 0, flatRand);
    const high = selectDistractors(round, 8, 1, flatRand);
    const meanLow = low.reduce((s, t) => s + similarity(round, t), 0) / low.length;
    const meanHigh = high.reduce((s, t) => s + similarity(round, t), 0) / high.length;
    expect(meanHigh).toBeGreaterThan(meanLow);
  });
});

describe('movementModeFor — movement thresholds', () => {
  it('below 0.3 the pond is static', () => {
    expect(movementModeFor(0)).toBe('static');
    expect(movementModeFor(0.29)).toBe('static');
  });

  it('between 0.3 and 0.7 the pond drifts', () => {
    expect(movementModeFor(0.3)).toBe('drift');
    expect(movementModeFor(0.5)).toBe('drift');
    expect(movementModeFor(0.69)).toBe('drift');
  });

  it('at 0.7 and above the pond is active', () => {
    expect(movementModeFor(0.7)).toBe('active');
    expect(movementModeFor(1)).toBe('active');
  });
});

describe('errorKindFor — taxonomy ordering per spec', () => {
  it('a perfect match is very-similar', () => {
    expect(errorKindFor(round, round)).toBe('near-miss-very-similar');
  });

  it('same color is a same-color near-miss', () => {
    expect(errorKindFor(round, diffShapeSameColor)).toBe('near-miss-same-color');
  });

  it('same shape is a same-shape near-miss', () => {
    expect(errorKindFor(round, sameShapeDiffColor)).toBe('near-miss-same-shape');
  });

  it('a stranger is a far-tap', () => {
    expect(errorKindFor(round, stranger)).toBe('far-tap');
  });
});
