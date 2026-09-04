import { describe, expect, it } from 'vitest';
import { isRhymeHit, optionCountFor, RHYME_FAMILIES, roundFor, WORDS_ALL } from '../games/logic/rhymePick';

/* rhymePick — phonological awareness: rhyme families, deterministic
   rounds, every word real Hebrew with niqqud, distractors always from
   OTHER families (a distractor that rhymes would be a lie). */

describe('rhymePick logic', () => {
  it('four families of three real words — no empty words, no duplicates', () => {
    expect(RHYME_FAMILIES.length).toBe(4);
    expect(WORDS_ALL.length).toBe(12);
    for (const fam of RHYME_FAMILIES) {
      expect(fam.words.length).toBe(3);
      for (const w of fam.words) {
        expect(w.length).toBeGreaterThan(0);
        expect(/\p{Script=Hebrew}/u.test(w)).toBe(true); /* Hebrew, with niqqud to be seen */
      }
    }
    expect(new Set(WORDS_ALL).size).toBe(12);
  });

  it('tier 0 offers two cards, later tiers three', () => {
    expect([optionCountFor(0), optionCountFor(1), optionCountFor(2), optionCountFor(3)]).toEqual([2, 3, 3, 3]);
  });

  it('every round: answer rhymes with target (same family), distractors never do', () => {
    for (let tier = 0; tier < 4; tier++) {
      for (let seed = 900; seed < 1000; seed += 13) {
        const r = roundFor(tier, seed);
        expect(r.target).not.toBe(r.answer);
        const famOf = (word: string) => RHYME_FAMILIES.find((f) => f.words.includes(word))?.id;
        expect(famOf(r.target)).toBe(famOf(r.answer)); /* a true rhyme */
        expect(r.options.some((o) => o.rhymes)).toBe(true);
        for (const o of r.options) {
          if (!o.rhymes) expect(famOf(o.word)).not.toBe(famOf(r.target));
        }
        /* the answer card is always on screen, exactly once */
        expect(r.options.filter((o) => o.word === r.answer)).toHaveLength(1);
        /* option count matches the tier */
        expect(r.options.length).toBe(optionCountFor(tier));
        /* no duplicate cards */
        expect(new Set(r.options.map((o) => o.word)).size).toBe(r.options.length);
      }
    }
  });

  it('same (tier, seed) — same words, every device', () => {
    expect(roundFor(1, 929)).toEqual(roundFor(1, 929));
    expect(roundFor(1, 929)).not.toEqual(roundFor(1, 930));
  });

  it('isRhymeHit reads the card, not the family list', () => {
    const r = roundFor(2, 955);
    const answerCard = r.options.find((o) => o.rhymes)!;
    expect(isRhymeHit(r.options, answerCard.word)).toBe(true);
    const wrong = r.options.find((o) => !o.rhymes);
    if (wrong) expect(isRhymeHit(r.options, wrong.word)).toBe(false);
    expect(isRhymeHit(r.options, 'מִלָּה-זָרָה')).toBe(false);
  });
});
