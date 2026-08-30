/* ============================================================
 * ProgressStore — unit tests for the persistence + unlock engine.
 * All state goes through the localStorage stub (see setup.ts).
 * ============================================================ */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocalProgressStore,
  freshGarden,
  isUnlocked,
  unlockRequirement,
  finishedCount,
  bloomLevel,
  recordFinish,
  recordZoneFinish,
  DEFAULT_UNLOCKED,
  GardenData,
} from '../games/core/ProgressStore';

describe('ProgressStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('freshGarden() returns an empty, well-formed structure', () => {
    const g = freshGarden();
    expect(g.lights).toBe(0);
    expect(g.zones).toEqual({});
    expect(g.finished).toEqual({});
    expect(typeof g.firstSeen).toBe('number');
  });

  it('LocalProgressStore round-trips through localStorage', () => {
    const store = new LocalProgressStore();
    const data = freshGarden();
    recordFinish(data, 'light-path');
    store.save(data);
    const loaded = store.load();
    expect(loaded.lights).toBe(1);
    expect(finishedCount(loaded, 'light-path')).toBe(1);
  });

  it('DEFAULT_UNLOCKED zones are always open on a fresh garden', () => {
    const g = freshGarden();
    expect(DEFAULT_UNLOCKED).toContain('light-path');
    expect(DEFAULT_UNLOCKED).toContain('breath-pool');
    expect(isUnlocked(g, 'light-path')).toBe(true);
    expect(isUnlocked(g, 'breath-pool')).toBe(true);
  });

  it('a gated zone is locked until its prerequisite count is met', () => {
    const g = freshGarden();
    expect(isUnlocked(g, 'memory-hill')).toBe(false);
    expect(unlockRequirement('memory-hill')).toEqual({ from: 'light-path', needed: 1 });
    recordFinish(g, 'light-path');
    expect(isUnlocked(g, 'memory-hill')).toBe(true);
  });

  it('recordZoneFinish unlocks the next zone and reports it', () => {
    const newly = recordZoneFinish('light-path');
    expect(newly).toContain('memory-hill');
    const g = new LocalProgressStore().load();
    expect(isUnlocked(g, 'memory-hill')).toBe(true);
  });

  it('recordFinish increments finished in BOTH saved shapes + lights', () => {
    const g = freshGarden();
    recordFinish(g, 'light-path');
    recordFinish(g, 'light-path');
    expect(g.finished && g.finished['light-path']).toBe(2);
    expect(g.zones['light-path'].finished).toBe(2);
    expect(g.lights).toBe(2);
  });

  it('finishedCount reads both the old (zones) and new (finished map) shapes', () => {
    const g: GardenData = freshGarden();
    /* zones-only shape (legacy save) */
    g.zones['memory-hill'] = { finished: 5, unlocked: true };
    expect(finishedCount(g, 'memory-hill')).toBe(5);
    /* finished-map shape */
    g.finished = { 'memory-hill': 3 };
    expect(finishedCount(g, 'memory-hill')).toBe(5); /* max of both */
    /* fresh zone -> 0 */
    expect(finishedCount(g, 'words-valley')).toBe(0);
  });

  it('bloomLevel derives from finishes + lights', () => {
    const g = freshGarden();
    expect(bloomLevel(g)).toBe(0);
    for (let i = 0; i < 4; i++) recordFinish(g, 'light-path');
    /* total finishes 4 -> floor(4/2)=2; lights 4 -> floor(4/4)=1 */
    expect(bloomLevel(g)).toBe(3);
  });

  it('isUnlocked is safe for unknown zone ids', () => {
    const g = freshGarden();
    expect(isUnlocked(g, 'not-a-zone')).toBe(false);
    expect(unlockRequirement('not-a-zone')).toBeNull();
  });
});
