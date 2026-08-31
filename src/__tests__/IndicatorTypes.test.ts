/* ============================================================
 * IndicatorTypes tests — the Stage 2c difficulty generator's math.
 *
 * These pin the spec's expected similarity values (identical=1 /
 * same-shape=0.82 / same-tone=0.3 / strangers=0.12), the
 * sequence-selection contract (level drives similarity, kinds are
 * unique, the requested count is honored), the playback-plan
 * formulas (length 2+floor(level*3), gap 800-level*400, static
 * below 0.35), the error taxonomy ordering (including the
 * documented unreachable branch) and the deterministic ink colors.
 * ============================================================ */

import { describe, it, expect } from 'vitest';
import {
  ALL_INDICATOR_TYPES,
  IndicatorType,
  similarity,
  selectIndicatorTypes,
  buildSequenceTypes,
  sequencePlanFor,
  getErrorKind,
  colorFor,
  TONE_SHADE_HEX,
} from '../games/fx/IndicatorTypes';

const orbBright: IndicatorType = { shape: 'orb', tone: 'bright' };
const orbMuted: IndicatorType = { shape: 'orb', tone: 'muted' };
const chimeBright: IndicatorType = { shape: 'chime', tone: 'bright' };
const leafMuted: IndicatorType = { shape: 'leaf', tone: 'muted' };

/* deterministic shuffle source: always 0.5 (no jitter effect) */
const flatRand = () => 0.5;

/* a tiny seeded PRNG so "random" sweeps are reproducible */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const meanPairwise = (kinds: IndicatorType[]): number => {
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
const meanNearestNeighbor = (kinds: IndicatorType[]): number => {
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

describe('IndicatorTypes content matrix', () => {
  it('offers exactly 6 kinds (3 shapes x 2 tones)', () => {
    expect(ALL_INDICATOR_TYPES).toHaveLength(6);
  });

  it('has no duplicate kinds', () => {
    const keys = ALL_INDICATOR_TYPES.map((t) => `${t.shape}:${t.tone}`);
    expect(new Set(keys).size).toBe(6);
  });
});

describe('similarity — the difficulty knob', () => {
  it('identical kinds score 1', () => {
    expect(similarity(orbBright, orbBright)).toBe(1);
  });

  it('same shape, different tone scores 0.82', () => {
    expect(similarity(orbBright, orbMuted)).toBeCloseTo(0.82, 10);
  });

  it('different shape, same tone scores 0.3', () => {
    expect(similarity(orbBright, chimeBright)).toBeCloseTo(0.3, 10);
  });

  it('nothing in common scores 0.12', () => {
    expect(similarity(orbBright, leafMuted)).toBeCloseTo(0.12, 10);
  });

  it('is symmetric', () => {
    expect(similarity(orbBright, leafMuted)).toBe(similarity(leafMuted, orbBright));
    expect(similarity(orbBright, orbMuted)).toBe(similarity(orbMuted, orbBright));
  });
});

describe('selectIndicatorTypes — similarity follows the level', () => {
  it('returns exactly the requested count', () => {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      for (const lv of [0, 0.25, 0.5, 0.75, 1]) {
        const out = selectIndicatorTypes(count, lv, flatRand);
        expect(out, `count=${count} level=${lv}`).toHaveLength(count);
      }
    }
  });

  it('never asks for more kinds than exist', () => {
    const out = selectIndicatorTypes(50, 0.5, flatRand);
    expect(out).toHaveLength(6);
  });

  it('returns unique kinds', () => {
    for (const lv of [0, 0.5, 1]) {
      const out = selectIndicatorTypes(5, lv, flatRand);
      const keys = out.map((t) => `${t.shape}:${t.tone}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('at level 0 (count 3) the kinds are strangers: all shapes distinct', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const out = selectIndicatorTypes(3, 0, mulberry32(seed));
      const shapes = new Set(out.map((t) => t.shape));
      expect(shapes.size, `seed=${seed}`).toBe(3);
      expect(meanNearestNeighbor(out), `seed=${seed}`).toBeLessThanOrEqual(0.31);
    }
  });

  it('at level 1 (count 3) the kinds are near-twins: a same-shape tone-twin pair exists', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const out = selectIndicatorTypes(3, 1, mulberry32(seed));
      const hasTwinPair = out.some(
        (k) => out.some((o) => o !== k && o.shape === k.shape),
      );
      expect(hasTwinPair, `seed=${seed}`).toBe(true);
      expect(meanNearestNeighbor(out), `seed=${seed}`).toBeGreaterThanOrEqual(0.64);
    }
  });

  it('count 4: every seeded high-level deck is strictly more similar than the low-level deck', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rand = mulberry32(seed);
      const low = selectIndicatorTypes(4, 0, rand);
      const high = selectIndicatorTypes(4, 1, rand);
      expect(
        meanPairwise(high), `seed=${seed} high=${meanPairwise(high)} low=${meanPairwise(low)}`,
      ).toBeGreaterThan(meanPairwise(low));
    }
  });

  it('count 4 with flat jitter: high-level mean similarity exceeds low by a wide margin', () => {
    const low = selectIndicatorTypes(4, 0, flatRand);
    const high = selectIndicatorTypes(4, 1, flatRand);
    expect(meanPairwise(high) - meanPairwise(low)).toBeGreaterThan(0.1);
  });

  it('high level yields strictly higher nearest-neighbor similarity (count 3)', () => {
    const low = selectIndicatorTypes(3, 0, flatRand);
    const high = selectIndicatorTypes(3, 1, flatRand);
    expect(meanNearestNeighbor(high)).toBeGreaterThan(meanNearestNeighbor(low));
  });
});

describe('buildSequenceTypes — the echo never repeats a kind', () => {
  it('no sequence contains a duplicate kind, at any level', () => {
    for (let lv = 0; lv <= 1.001; lv += 0.1) {
      for (const seed of [1, 5, 9, 21]) {
        const seq = buildSequenceTypes(sequencePlanFor(lv).length, lv, mulberry32(seed));
        const keys = seq.map((t) => `${t.shape}:${t.tone}`);
        expect(new Set(keys).size, `level=${lv} seed=${seed}`).toBe(keys.length);
      }
    }
  });

  it('returns exactly the planned length', () => {
    for (const lv of [0, 0.4, 0.8, 1]) {
      const len = sequencePlanFor(lv).length;
      expect(buildSequenceTypes(len, lv, flatRand)).toHaveLength(len);
    }
  });

  it('is a shuffle of the selection (same set as selectIndicatorTypes)', () => {
    const seq = buildSequenceTypes(4, 0.5, flatRand);
    const sel = selectIndicatorTypes(4, 0.5, flatRand);
    const key = (t: IndicatorType) => `${t.shape}:${t.tone}`;
    expect([...seq].map(key).sort()).toEqual([...sel].map(key).sort());
  });
});

describe('sequencePlanFor — the playback ladder', () => {
  it('sequence length: 2 + floor(level * 3)', () => {
    expect(sequencePlanFor(0).length).toBe(2);
    expect(sequencePlanFor(0.34).length).toBe(3);
    expect(sequencePlanFor(0.35).length).toBe(3);
    expect(sequencePlanFor(0.67).length).toBe(4);
    expect(sequencePlanFor(0.99).length).toBe(4);
    expect(sequencePlanFor(1).length).toBe(5);
  });

  it('gap: 800 - level * 400 ms (800..400)', () => {
    expect(sequencePlanFor(0).gapMs).toBe(800);
    expect(sequencePlanFor(0.5).gapMs).toBe(600);
    expect(sequencePlanFor(1).gapMs).toBe(400);
  });

  it('each indicator flashes for a fraction of the gap', () => {
    expect(sequencePlanFor(0).flashMs).toBe(Math.round(800 * 0.55));
    expect(sequencePlanFor(1).flashMs).toBe(Math.round(400 * 0.55));
    expect(sequencePlanFor(0.5).flashMs).toBeLessThan(sequencePlanFor(0.5).gapMs);
  });

  it('below 0.35 the indicators are perfectly static (no distraction)', () => {
    expect(sequencePlanFor(0).bobAmp).toBe(0);
    expect(sequencePlanFor(0.34).bobAmp).toBe(0);
  });

  it('from 0.35 up the bobbing engages and grows with the level', () => {
    expect(sequencePlanFor(0.35).bobAmp).toBeGreaterThan(0);
    expect(sequencePlanFor(0.7).bobAmp).toBeGreaterThan(sequencePlanFor(0.35).bobAmp);
    expect(sequencePlanFor(1).bobAmp).toBeGreaterThan(sequencePlanFor(0.7).bobAmp);
  });

  it('clamps out-of-range levels', () => {
    expect(sequencePlanFor(-0.5).length).toBe(2);
    expect(sequencePlanFor(-0.5).gapMs).toBe(800);
    expect(sequencePlanFor(2).length).toBe(5);
    expect(sequencePlanFor(2).gapMs).toBe(400);
  });
});

describe('getErrorKind — taxonomy ordering per spec', () => {
  const A = orbBright;
  const Atwin = orbMuted;   /* same shape, diff tone -> 0.82 */
  const B = chimeBright;    /* same tone, diff shape -> 0.3  */
  const C = leafMuted;      /* nothing in common     -> 0.12 */

  it('identical sequences are no error at all', () => {
    expect(getErrorKind([A, B], [A, B])).toBe('none');
  });

  it('same shape, different tone is a near-miss-similar', () => {
    expect(getErrorKind([A], [Atwin])).toBe('near-miss-similar');
  });

  it('same tone, different shape is a near-miss-same-tone', () => {
    expect(getErrorKind([A], [B])).toBe('near-miss-same-tone');
  });

  it('a stranger kind is a wrong-item', () => {
    expect(getErrorKind([A], [C])).toBe('wrong-item');
  });

  it('classifies at the FIRST divergent position (position-by-position)', () => {
    /* position 0 matches; the divergence at position 1 decides */
    expect(getErrorKind([A, B], [A, C])).toBe('wrong-item');
    /* B' = chime muted: same shape as B, different tone -> 0.82 */
    expect(getErrorKind([A, B], [A, { shape: 'chime', tone: 'muted' }])).toBe('near-miss-similar');
    /* an earlier divergence wins even when later ones exist */
    expect(getErrorKind([A, B], [C, Atwin])).toBe('wrong-item');
  });

  it('equal prefixes with different lengths are a wrong-length', () => {
    expect(getErrorKind([A, B, C], [A, B])).toBe('wrong-length');
    expect(getErrorKind([A], [A, B])).toBe('wrong-length');
  });

  it('spec-verbatim invariant: every same-shape pair is caught by branch 1', () => {
    /* exhaustive: for ALL 36 ordered kind pairs, same shape implies
       sim >= 0.7 — i.e. the second branch is unreachable for
       non-identical kinds under the current palette */
    for (const a of ALL_INDICATOR_TYPES) {
      for (const b of ALL_INDICATOR_TYPES) {
        if (a.shape === b.shape) {
          expect(similarity(a, b), `${a.shape}/${a.tone} vs ${b.shape}/${b.tone}`).toBeGreaterThanOrEqual(0.7);
        }
      }
    }
  });

  it('a wrong tap before the echo ends classifies by TYPE, not length', () => {
    /* the scene passes (correct prefix, taps so far + the wrong tap);
       lengths differ here, but the divergence at position 1 wins:
       leaf bright vs chime bright = same tone, different shape */
    const correct: IndicatorType[] = [A, B, C];
    const attempt: IndicatorType[] = [A, { shape: 'leaf', tone: 'bright' }];
    expect(getErrorKind(correct, attempt)).toBe('near-miss-same-tone');
  });
});

describe('colorFor — deterministic ink colors', () => {
  it('uses the pinned palette entries', () => {
    expect(colorFor(orbBright)).toBe(TONE_SHADE_HEX.bright[0]);
    expect(colorFor(chimeBright)).toBe(TONE_SHADE_HEX.bright[1]);
    expect(colorFor(leafBrightHelper())).toBe(TONE_SHADE_HEX.bright[0]);
    expect(colorFor(orbMuted)).toBe(TONE_SHADE_HEX.muted[0]);
    expect(colorFor({ shape: 'chime', tone: 'muted' })).toBe(TONE_SHADE_HEX.muted[1]);
    expect(colorFor(leafMuted)).toBe(TONE_SHADE_HEX.muted[0]);
  });

  it('orb and leaf share a shade; chime has its own', () => {
    for (const tone of ['bright', 'muted'] as const) {
      expect(colorFor({ shape: 'orb', tone })).toBe(colorFor({ shape: 'leaf', tone }));
      expect(colorFor({ shape: 'orb', tone })).not.toBe(colorFor({ shape: 'chime', tone }));
    }
  });

  it('bright and muted differ for the same shape', () => {
    for (const shape of ['orb', 'chime', 'leaf'] as const) {
      expect(colorFor({ shape, tone: 'bright' })).not.toBe(colorFor({ shape, tone: 'muted' }));
    }
  });
});

function leafBrightHelper(): IndicatorType {
  return { shape: 'leaf', tone: 'bright' };
}
