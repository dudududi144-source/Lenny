/* ============================================================
 * LearningSignals — unit tests.
 *
 * Focus: the mastery threshold. MASTERY_AFTER = 3 counts CUMULATIVE
 * correct attempts per skill (persisted across sessions through
 * localStorage), and the onMastery listener must fire exactly once,
 * exactly at the 3rd correct -- the gate SkillBridge waits on
 * before acquiring a SkillGraph node.
 * ============================================================ */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LearningSignals } from '../games/core/LearningSignals';

describe('LearningSignals mastery threshold', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does NOT fire mastery before 3 correct attempts', () => {
    const ls = new LearningSignals();
    const cb = vi.fn();
    ls.onMastery(cb);
    ls.attempt('letter.alef', true);
    ls.attempt('letter.alef', true);
    expect(cb).not.toHaveBeenCalled();
    expect(ls.summarize().masteredSkills).toEqual([]);
  });

  it('fires mastery exactly on the 3rd correct attempt', () => {
    const ls = new LearningSignals();
    const cb = vi.fn();
    ls.onMastery(cb);
    ls.attempt('letter.alef', true);
    ls.attempt('letter.alef', true);
    ls.attempt('letter.alef', true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('letter.alef');
    expect(ls.summarize().masteredSkills).toContain('letter.alef');
  });

  it('does not count wrong attempts toward mastery, nor reset the streak', () => {
    const ls = new LearningSignals();
    const cb = vi.fn();
    ls.onMastery(cb);
    ls.attempt('letter.bet', true);
    ls.attempt('letter.bet', false); /* a miss neither counts nor resets */
    ls.attempt('letter.bet', true);
    expect(cb).not.toHaveBeenCalled();
    ls.attempt('letter.bet', true); /* 3rd correct */
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('letter.bet');
  });

  it('fires once per skill even after further correct attempts', () => {
    const ls = new LearningSignals();
    const cb = vi.fn();
    ls.onMastery(cb);
    for (let i = 0; i < 6; i++) ls.attempt('sound.alef', true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(ls.masteryCount('sound.alef')).toBe(6);
  });

  it('tracks skills independently', () => {
    const ls = new LearningSignals();
    const got: string[] = [];
    ls.onMastery((s) => got.push(s));
    ls.attempt('letter.alef', true);
    ls.attempt('letter.bet', true);
    ls.attempt('letter.alef', true);
    ls.attempt('letter.bet', true);
    expect(got).toEqual([]);
    ls.attempt('letter.alef', true); /* alef hits 3 */
    expect(got).toEqual(['letter.alef']);
    ls.attempt('letter.bet', true); /* bet hits 3 */
    expect(got).toEqual(['letter.alef', 'letter.bet']);
  });

  it('mastery counting survives a page reload (persistence)', () => {
    const a = new LearningSignals();
    a.attempt('letter.alef', true);
    a.attempt('letter.alef', true);

    const b = new LearningSignals(); /* a fresh instance = a fresh page */
    const cb = vi.fn();
    b.onMastery(cb);
    b.attempt('letter.alef', true); /* 3rd correct across sessions */
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('letter.alef');
  });

  it('still records the full event stream for the parent lens', () => {
    const ls = new LearningSignals();
    ls.attempt('letter.alef', true, 1200);
    ls.errorKind('letter.alef', 'confused-bet-kaf');
    const sum = ls.summarize();
    expect(sum.attempts).toBe(1);
    expect(sum.correct).toBe(1);
    expect(sum.avgReactionMs).toBe(1200);
    expect(sum.errorKinds['confused-bet-kaf']).toBe(1);
  });
});
