/* ============================================================
 * AdaptiveDifficulty — unit tests.
 *
 * NOTE on the frustration cooldown (verified against the source):
 * a loss sets streak=-1; frustration increments only once the
 * streak reaches -2 or lower, and the cooldown engages at
 * frustration >= FRUSTRATION_LIMIT (3). Therefore:
 *   3 consecutive losses  -> frustration = 2 -> NOT yet in cooldown
 *   4 consecutive losses  -> frustration = 3 -> cooldown active
 * The tests assert the actual behavior.
 * ============================================================ */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveDifficulty } from '../games/core/AdaptiveDifficulty';

describe('AdaptiveDifficulty', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('approaches mastery after repeated clean wins', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    for (let i = 0; i < 5; i++) dda.outcome(true, 1);
    expect(dda.level()).toBeGreaterThan(0.8);
    expect(dda.tier()).toBe(3);
  });

  it('does NOT enter cooldown after only 3 consecutive losses', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    dda.outcome(false);
    dda.outcome(false);
    dda.outcome(false);
    expect(dda.inCooldown()).toBe(false);
  });

  it('enters cooldown on the 4th consecutive loss (frustration >= 3)', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    for (let i = 0; i < 4; i++) dda.outcome(false);
    expect(dda.inCooldown()).toBe(true);
  });

  it('reduces level() while in cooldown, restores after releaseCooldown()', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    for (let i = 0; i < 4; i++) dda.outcome(false);
    const cooled = dda.level();
    expect(dda.level()).toBeLessThan(0.35); /* starts at 0.35, losses lowered it further */
    dda.releaseCooldown();
    expect(dda.inCooldown()).toBe(false);
    expect(dda.level()).toBeGreaterThan(cooled);
  });

  it('a win after struggle resets the cooldown path', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    dda.outcome(false);
    dda.outcome(false);
    dda.outcome(true); /* frustration resets to 0 on a win */
    dda.outcome(false);
    dda.outcome(false);
    expect(dda.inCooldown()).toBe(false);
  });

  it('suggestHint escalates none -> gentle -> clear -> show', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    expect(dda.suggestHint(0)).toBe('none');
    expect(dda.suggestHint(1)).toBe('gentle');
    expect(dda.suggestHint(2)).toBe('clear');
    expect(dda.suggestHint(3)).toBe('show');
  });

  it('tier() boundaries: <0.25 -> 0, <0.5 -> 1, <0.75 -> 2, >=0.75 -> 3', () => {
    const dda = new AdaptiveDifficulty('test-zone');
    const set = (v: number) => {
      (dda as unknown as { rec: { skill: number } }).rec.skill = v;
    };
    set(0.24); expect(dda.tier()).toBe(0);
    set(0.25); expect(dda.tier()).toBe(1);
    set(0.49); expect(dda.tier()).toBe(1);
    set(0.5);  expect(dda.tier()).toBe(2);
    set(0.74); expect(dda.tier()).toBe(2);
    set(0.75); expect(dda.tier()).toBe(3);
  });

  it('persists zone records across instances (localStorage)', () => {
    const a = new AdaptiveDifficulty('persist-zone');
    a.outcome(true, 1);
    const b = new AdaptiveDifficulty('persist-zone');
    expect(b.roundsPlayed()).toBe(1);
  });
});
