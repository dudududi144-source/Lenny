/* ============================================================
 * CardTypes tests — the Stage 2b difficulty generator's math.
 *
 * These pin the spec's expected similarity values (identical=1 /
 * same-suit=0.82 / same-tone=0.3 / strangers=0.12), the
 * pair-selection contract (level drives similarity, kinds are
 * unique, the requested count is honored EVEN at low levels —
 * a regression here once silently dealt 4 kinds when 5 were
 * asked), the exposure-ladder thresholds, the error taxonomy
 * ordering and the deterministic face colors.
 * ============================================================ */

import { describe, it, expect } from 'vitest';
import {
  ALL_CARD_TYPES,
  CardType,
  similarity,
  selectPairTypes,
  exposureFor,
  errorKindFor,
  colorFor,
  TONE_SHADE_HEX,
} from '../games/fx/CardTypes';

const flowerWarm: CardType = { suit: 'flower', tone: 'warm' };
const flowerCool: CardType = { suit: 'flower', tone: 'cool' };
const bugWarm: CardType = { suit: 'bug', tone: 'warm' };
const fishCool: CardType = { suit: 'fish', tone: 'cool' };

/* deterministic shuffle source: always 0.5 (no jitter effect) */
const flatRand = () => 0.5;

const meanPairwise = (kinds: CardType[]): number => {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < kinds.length; i++) {
    for (let j = i + 1; j < kinds.length; j++) {
      sum += similarity(kinds[i], kinds[j]);
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
};

/* how similar each kind is to its closest sibling in the set */
const meanNearestNeighbor = (kinds: CardType[]): number => {
  if (kinds.length < 2) return 0;
  const each = kinds.map((k) => {
    let best = 0;
    for (const o of kinds) {
      if (o === k) continue;
      best = Math.max(best, similarity(k, o));
    }
    return best;
  });
  return each.reduce((s, v) => s + v, 0) / each.length;
};

describe('CardTypes content matrix', () => {
  it('offers exactly 8 kinds (4 suits x 2 tones)', () => {
    expect(ALL_CARD_TYPES).toHaveLength(8);
  });

  it('has no duplicate kinds', () => {
    const keys = ALL_CARD_TYPES.map((t) => `${t.suit}:${t.tone}`);
    expect(new Set(keys).size).toBe(8);
  });
});

describe('similarity — the difficulty knob', () => {
  it('identical kinds score 1', () => {
    expect(similarity(flowerWarm, flowerWarm)).toBe(1);
  });

  it('same suit, different tone scores 0.82', () => {
    expect(similarity(flowerWarm, flowerCool)).toBeCloseTo(0.82, 10);
  });

  it('different suit, same tone scores 0.3', () => {
    expect(similarity(flowerWarm, bugWarm)).toBeCloseTo(0.3, 10);
  });

  it('nothing in common scores 0.12', () => {
    expect(similarity(flowerWarm, fishCool)).toBeCloseTo(0.12, 10);
  });

  it('is symmetric', () => {
    expect(similarity(flowerWarm, fishCool)).toBe(similarity(fishCool, flowerWarm));
    expect(similarity(flowerWarm, flowerCool)).toBe(similarity(flowerCool, flowerWarm));
  });
});

describe('selectPairTypes — similarity follows the level', () => {
  it('returns exactly the requested count (regression: asked 5 at level 0 got 4)', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const lv of [0, 0.25, 0.5, 0.75, 1]) {
        const out = selectPairTypes(count, lv, flatRand);
        expect(out, `count=${count} level=${lv}`).toHaveLength(count);
      }
    }
  });

  it('never asks for more kinds than exist', () => {
    const out = selectPairTypes(50, 0.5, flatRand);
    expect(out).toHaveLength(8);
  });

  it('returns unique kinds', () => {
    const out = selectPairTypes(6, 0.5, flatRand);
    const keys = out.map((t) => `${t.suit}:${t.tone}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('at level 1 the kinds are near-twins (same-suit clusters)', () => {
    const out = selectPairTypes(6, 1, flatRand);
    /* at most one kind may lack a same-family sibling */
    const withTwin = out.filter(
      (k) => out.some((o) => o !== k && o.suit === k.suit),
    ).length;
    expect(withTwin).toBeGreaterThanOrEqual(5);
    expect(meanNearestNeighbor(out)).toBeGreaterThan(0.6);
  });

  it('at level 0 the kinds are spread out (no same-suit cluster pile-up)', () => {
    const out = selectPairTypes(6, 0, flatRand);
    const withTwin = out.filter(
      (k) => out.some((o) => o !== k && o.suit === k.suit),
    ).length;
    expect(withTwin).toBeLessThanOrEqual(4);
  });

  it('high level yields strictly higher mutual similarity than low level', () => {
    const low = selectPairTypes(6, 0, flatRand);
    const high = selectPairTypes(6, 1, flatRand);
    expect(meanPairwise(high)).toBeGreaterThan(meanPairwise(low));
    expect(meanNearestNeighbor(high)).toBeGreaterThan(meanNearestNeighbor(low));
  });
});

describe('exposureFor — the reveal ladder', () => {
  it('below 0.35 the child studies static cards (no reveal)', () => {
    expect(exposureFor(0)).toEqual({ mode: 'none', peekMs: 0, dimAfterMisses: Infinity });
    expect(exposureFor(0.34).mode).toBe('none');
  });

  it('from 0.35 to 0.7 the deck peeks for 1.2s', () => {
    expect(exposureFor(0.35)).toEqual({ mode: 'peek', peekMs: 1200, dimAfterMisses: Infinity });
    expect(exposureFor(0.7)).toEqual({ mode: 'peek', peekMs: 1200, dimAfterMisses: Infinity });
  });

  it('above 0.7 the peek shortens to 0.8s', () => {
    expect(exposureFor(0.71)).toEqual({ mode: 'peek-plus', peekMs: 800, dimAfterMisses: 4 });
    expect(exposureFor(1)).toEqual({ mode: 'peek-plus', peekMs: 800, dimAfterMisses: 4 });
  });

  it('only peek-plus engages the dim aid', () => {
    expect(exposureFor(0.2).dimAfterMisses).toBe(Infinity);
    expect(exposureFor(0.5).dimAfterMisses).toBe(Infinity);
    expect(exposureFor(0.9).dimAfterMisses).toBe(4);
  });
});

describe('errorKindFor — taxonomy ordering per spec', () => {
  it('an identical pair hits the first branch (sim 1 >= 0.7)', () => {
    /* the scene only classifies MISMATCHED pairs, so this is the
       spec-verbatim ordering, not a reachable game event */
    expect(errorKindFor(flowerWarm, flowerWarm)).toBe('near-miss-same-suit-diff-tone');
  });

  it('same suit, different tone is a tone near-miss', () => {
    expect(errorKindFor(flowerWarm, flowerCool)).toBe('near-miss-same-suit-diff-tone');
  });

  it('same tone, different suit is a tone-family near-miss', () => {
    expect(errorKindFor(flowerWarm, bugWarm)).toBe('near-miss-same-tone');
  });

  it('a stranger pair is a far-pair', () => {
    expect(errorKindFor(flowerWarm, fishCool)).toBe('far-pair');
  });

  it('spec-verbatim invariant: every same-suit pair (except far tone splits) is caught by branch 1', () => {
    /* exhaustive: for ALL 64 ordered pairs, same suit implies
       sim >= 0.7 — i.e. the second branch is unreachable for
       non-identical kinds under the current palette */
    for (const a of ALL_CARD_TYPES) {
      for (const b of ALL_CARD_TYPES) {
        if (a.suit === b.suit) {
          expect(similarity(a, b)).toBeGreaterThanOrEqual(0.7);
        }
      }
    }
  });
});

describe('colorFor — deterministic face colors', () => {
  it('uses the pinned palette entries', () => {
    expect(colorFor(flowerWarm)).toBe(TONE_SHADE_HEX.warm[0]);
    expect(colorFor(bugWarm)).toBe(TONE_SHADE_HEX.warm[1]);
    expect(colorFor(fishCool)).toBe(TONE_SHADE_HEX.cool[0]);
    expect(colorFor({ suit: 'tree', tone: 'cool' })).toBe(TONE_SHADE_HEX.cool[1]);
  });

  it('flower and fish share a shade; bug and tree share the other', () => {
    for (const tone of ['warm', 'cool'] as const) {
      expect(colorFor({ suit: 'flower', tone })).toBe(colorFor({ suit: 'fish', tone }));
      expect(colorFor({ suit: 'bug', tone })).toBe(colorFor({ suit: 'tree', tone }));
      expect(colorFor({ suit: 'flower', tone })).not.toBe(colorFor({ suit: 'bug', tone }));
    }
  });

  it('warm and cool differ for the same suit', () => {
    for (const suit of ['flower', 'bug', 'fish', 'tree'] as const) {
      expect(colorFor({ suit, tone: 'warm' })).not.toBe(colorFor({ suit, tone: 'cool' }));
    }
  });
});
