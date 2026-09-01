/* ============================================================
 * Catalog + tier-lock tests (Stage 6, commit 2).
 *
 * Contract under test:
 *   - zoneCatalog: seed spine first (byte-identical order), then
 *     the 16 derived specs — so every existing save/e2e seed lands
 *     on the SAME game as before Stage 6
 *   - the merged catalog validates as a whole
 *   - tier locking: tier 0 open; tier t opens when a tier-(t-1)
 *     game of the same category was completed ×3; missing counts
 *     are exact
 *   - gameFinishes: counts persist and round-trip
 * ============================================================ */

import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_REGISTRY } from '../games/builder/GameRegistry';
import {
  installCatalog,
  zoneCatalog,
  tierUnlocked,
  tierMissing,
  TIER_UNLOCK_AFTER,
} from '../content/catalog';
import { validateCatalog } from '../content/SpecValidator';
import { SPEC_CATALOG, catalogForZone } from '../content/SpecGenerator';
import { allFinishes, finishCountOf, recordGameFinish } from '../content/gameFinishes';

describe('catalog — the merged zone list', () => {
  it('installCatalog passes: 144/144 + the whole merged catalog validates', () => {
    expect(() => installCatalog()).not.toThrow();
    const merged = new Set([...GAME_REGISTRY, ...SPEC_CATALOG]);
    expect(validateCatalog([...merged])).toEqual({});
  });

  it('seed spine stays first and identical for every zone', () => {
    for (const zone of ['memory-hill', 'attention-stream', 'thinking-forest', 'rhythm-square']) {
      const cat = zoneCatalog(zone);
      const seeds = GAME_REGISTRY.filter((s) => s.zone === zone);
      expect(cat.slice(0, seeds.length), zone).toEqual(seeds);
      expect(cat.length - seeds.length).toBe(16); /* the derived tail */
    }
  });

  it('every zone catalog: derived tail covers tiers 0..3', () => {
    for (const zone of ['memory-hill', 'breath-pool', 'creativity-meadow']) {
      const tail = zoneCatalog(zone).slice(GAME_REGISTRY.filter((s) => s.zone === zone).length);
      const tiers = new Set(tail.map((s) => s.baseTier));
      expect([...tiers].sort(), zone).toEqual([0, 1, 2, 3]);
    }
  });

  it('the 144 derived specs are the only additions (no zone loses a seed spec)', () => {
    const seedCount = GAME_REGISTRY.length; /* 23 hand-written specs stay */
    expect(seedCount).toBeGreaterThanOrEqual(20);
    for (const spec of GAME_REGISTRY) {
      expect(zoneCatalog(spec.zone).includes(spec), spec.id).toBe(true);
    }
    expect(SPEC_CATALOG).toHaveLength(144);
    expect(catalogForZone('light-path')).toHaveLength(0);
  });
});

describe('tier locking — opens one rung at a time', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tier 0 is always open', () => {
    expect(tierUnlocked('attention', 0)).toBe(true);
  });

  it('tier 1 is locked until a tier-0 game of the category completes ×3', () => {
    expect(tierUnlocked('attention', 1)).toBe(false);
    expect(tierMissing('attention', 1)).toBe(TIER_UNLOCK_AFTER);

    recordGameFinish('attention-find-target-00'); /* ×1 */
    expect(tierUnlocked('attention', 1)).toBe(false);
    expect(tierMissing('attention', 1)).toBe(2);

    recordGameFinish('attention-find-target-00');
    recordGameFinish('attention-find-target-00'); /* ×3 */
    expect(tierUnlocked('attention', 1)).toBe(true);
    expect(tierMissing('attention', 1)).toBe(0);
  });

  it('any tier-0 game of the category counts (not just the first)', () => {
    for (let i = 0; i < 3; i++) recordGameFinish('attention-find-target-02');
    expect(tierUnlocked('attention', 1)).toBe(true);
  });

  it('another category finishes never open this category tier', () => {
    for (let i = 0; i < 5; i++) recordGameFinish('memory-memory-pairs-00');
    expect(tierUnlocked('attention', 1)).toBe(false);
  });

  it('tier 2 needs tier 1 (not tier 0) — and stays honest about it', () => {
    for (let i = 0; i < 3; i++) recordGameFinish('attention-find-target-00');
    expect(tierUnlocked('attention', 1)).toBe(true);
    expect(tierUnlocked('attention', 2)).toBe(false);
    expect(tierMissing('attention', 2)).toBe(TIER_UNLOCK_AFTER);

    for (let i = 0; i < 3; i++) recordGameFinish('attention-find-target-04'); /* tier 1 */
    expect(tierUnlocked('attention', 2)).toBe(true);
    expect(tierUnlocked('attention', 3)).toBe(false);
  });

  it('counts persist across reads and round-trip through storage', () => {
    recordGameFinish('breath-breath-guide-00');
    recordGameFinish('breath-breath-guide-00');
    expect(finishCountOf('breath-breath-guide-00')).toBe(2);
    expect(allFinishes()['breath-breath-guide-00']).toBe(2);
    expect(JSON.parse(localStorage.getItem('lenny-game-finishes-v1')!)).toMatchObject({
      'breath-breath-guide-00': 2,
    });
  });
});
