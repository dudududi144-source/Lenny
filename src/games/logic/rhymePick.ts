/* ============================================================
 * rhymePick — "מִי חָרִיזָה?" (which word rhymes?).
 *
 * The owl hoots a word; three cards answer. One card rhymes with
 * the target (same ending sound), the others are from different
 * families. Every card SPEAKS itself when tapped — the game is
 * fully playable before reading: the ear decides, the niqqud is
 * there to be seen, not decoded. Phonological awareness, the
 * strongest pre-reading predictor there is.
 * ============================================================ */

import { clampTier, hash2, mulberry32, shuffled } from './rng';

/** A rhyme family: words that share their ending sound (with niqqud). */
export interface RhymeFamily {
  /** family id (also the ending sound, for debugging only) */
  id: string;
  words: string[];
}

export const RHYME_FAMILIES: readonly RhymeFamily[] = [
  { id: 'yad', words: ['יָד', 'כַּד', 'גַּד'] },
  { id: 'yam', words: ['יָם', 'חָם', 'נָעָם'] },
  { id: 'gan', words: ['גַּן', 'עָנָן', 'כָּבִישָׁן'] },
  { id: 'or', words: ['אוֹר', 'דְּבוֹר', 'תְּנוּר'] },
];

export const WORDS_ALL: readonly string[] = RHYME_FAMILIES.flatMap((f) => f.words);

export interface RhymeRound {
  /** the word the owl sings */
  target: string;
  /** the tapped card that wins: it rhymes with the target */
  answer: string;
  /** every card on screen, deterministically shuffled */
  options: Array<{ word: string; rhymes: boolean }>;
}

/** Options shown per tier — two at tier 0, three afterwards. */
export function optionCountFor(tier: number): number {
  return clampTier(tier) === 0 ? 2 : 3;
}

/**
 * A deterministic round for (tier, seed): a target from one family,
 * its rhyme partner, and distractors from OTHER families, shuffled.
 */
export function roundFor(tier: number, seed: number): RhymeRound {
  const rnd = mulberry32(hash2(seed, 29));
  const t = clampTier(tier);
  const families = RHYME_FAMILIES;

  /* the target family + its two words (target, answer) */
  const famIdx = Math.floor(rnd() * families.length) % families.length;
  const family = families[famIdx];
  const pair = shuffled(family.words, hash2(seed, 5));
  const target = pair[0];
  const answer = pair[1];

  /* distractors: one word per OTHER family, deterministic, distinct */
  const others = families.filter((_, i) => i !== famIdx);
  const distractorPool = shuffled(others, hash2(seed, 7)).map(
    (f) => f.words[Math.floor(rnd() * f.words.length) % f.words.length],
  );
  const want = Math.max(1, optionCountFor(t) - 1); /* cards besides the answer */
  const distractors = distractorPool.slice(0, want);

  const options = shuffled(
    [{ word: answer, rhymes: true }, ...distractors.map((word) => ({ word, rhymes: false }))],
    hash2(seed, 11),
  );
  return { target, answer, options };
}

/** The word a card wins on: it rhymes with the target (family match). */
export function isRhymeHit(options: RhymeRound['options'], word: string): boolean {
  const card = options.find((o) => o.word === word);
  return card?.rhymes === true;
}
