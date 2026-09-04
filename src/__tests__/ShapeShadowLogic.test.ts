import { describe, expect, it } from 'vitest';
import { ALL_SHAPES, shadowChallengeFor } from '../games/logic/shapeShadow';

/* shapeShadow — exactly one silhouette keeps the whole outline.
   Distractors come from the honest confusion families (round/pointy). */

describe('shapeShadow logic', () => {
  it('six shapes, all distinct', () => {
    expect(ALL_SHAPES.length).toBe(6);
    expect(new Set(ALL_SHAPES).size).toBe(6);
  });

  it('every challenge carries the answer exactly once among distinct options', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let round = 1; round <= 8; round++) {
        const ch = shadowChallengeFor(tier, 900 + round * 7, round);
        expect(ALL_SHAPES).toContain(ch.answer);
        expect(ch.answer).toBe(ch.shape);
        expect(ch.options).toContain(ch.answer);
        expect(new Set(ch.options).size).toBe(ch.options.length);
        expect(ch.options.filter((o) => o === ch.answer).length).toBe(1);
      }
    }
  });

  it('option count is 3 at tier 0 and 4 from tier 1 (big touch targets)', () => {
    expect(shadowChallengeFor(0, 11, 1).options.length).toBe(3);
    expect(shadowChallengeFor(1, 11, 1).options.length).toBe(4);
    expect(shadowChallengeFor(3, 11, 1).options.length).toBe(4);
  });

  it('higher tiers lean on same-family confusions (the silhouette must be READ)', () => {
    const FAMILY: Record<string, string> = {
      circle: 'round', heart: 'round',
      square: 'pointy', triangle: 'pointy', star: 'pointy', diamond: 'pointy',
    };
    let nearCount = 0;
    for (let round = 1; round <= 20; round++) {
      const ch = shadowChallengeFor(3, 5, round);
      const nears = ch.options.filter((o) => o !== ch.answer && FAMILY[o] === FAMILY[ch.answer]);
      expect(nears.length).toBeGreaterThanOrEqual(1); /* round C floor */
      nearCount += nears.length;
    }
    expect(nearCount).toBeGreaterThan(0);
  });

  it('same (tier, seed, round) — same challenge, every device', () => {
    expect(shadowChallengeFor(2, 907, 3)).toEqual(shadowChallengeFor(2, 907, 3));
  });
});
