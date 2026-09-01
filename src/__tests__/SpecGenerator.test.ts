/* ============================================================
 * SpecGenerator tests — the 144-name seed becomes a real catalog.
 * Contract under test (Stage 6, commit 1):
 *   - exactly 144 derived specs, deterministic
 *   - every spec passes validateSpec (the GameFactory.validate
 *     equivalent of the new shell)
 *   - ids unique; every category has >= 4 specs and covers tiers 0..3
 *   - tier-0 params byte-match the seed specs the e2e suite grew on
 *   - narrative actually carries the child-facing Hebrew name
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { GAMES } from '../data/games';
import {
  SPEC_CATALOG,
  deriveSpecs,
  catalogForZone,
  catalogSpec,
  catalogMeta,
  KINDS_FOR_CATEGORY,
  ZONE_FOR_CATEGORY,
} from '../content/SpecGenerator';
import { validateSpec, validateCatalog } from '../content/SpecValidator';
import { ZONES } from '../data/garden';

describe('SpecGenerator — the 144 catalog', () => {
  it('derives exactly 144 specs, deterministically', () => {
    expect(SPEC_CATALOG).toHaveLength(144);
    expect(deriveSpecs().specs).toEqual(deriveSpecs().specs); /* pure, no clock/random */
    expect(deriveSpecs().specs).toEqual([...SPEC_CATALOG]);
  });

  it('every one of the 144 passes validation (144/144, zero problems)', () => {
    expect(validateCatalog(SPEC_CATALOG)).toEqual({});
    for (const spec of SPEC_CATALOG) {
      expect(validateSpec(spec), spec.id).toBeNull();
    }
  });

  it('ids are unique across the whole catalog', () => {
    const ids = SPEC_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(144);
  });

  it('every seed name titles exactly one spec (intro[0] opens with the name)', () => {
    for (const def of GAMES) {
      const hits = SPEC_CATALOG.filter((s) => s.narrative.intro[0].startsWith(def.name));
      expect(hits, def.name).toHaveLength(1);
    }
  });

  it('each category has 16 specs (>= 4 required) and covers tiers 0..3', () => {
    const meta = catalogMeta();
    expect(meta.total).toBe(144);
    for (const [cat, count] of Object.entries(meta.perCategory)) {
      expect(count, cat).toBe(16);
      expect(count).toBeGreaterThanOrEqual(4);
    }
    for (const cat of Object.keys(KINDS_FOR_CATEGORY) as Array<keyof typeof KINDS_FOR_CATEGORY>) {
      const tiers = new Set(SPEC_CATALOG.filter((s) => s.category === cat).map((s) => s.baseTier));
      expect([...tiers].sort(), cat).toEqual([0, 1, 2, 3]);
    }
  });

  it('uses exactly the 11 builder templates and the category->kind map', () => {
    const kinds = new Set(SPEC_CATALOG.map((s) => s.kind));
    expect(kinds.size).toBe(11);
    /* split categories: logic = sort-order(8) + sequence-echo(8),
       creativity = paint-fill(8) + open-create(8) — and BOTH kinds of
       a split category exist at every tier (2+2 within each tier's 4). */
    for (const cat of ['logic', 'creativity'] as const) {
      const [kindA, kindB] = KINDS_FOR_CATEGORY[cat];
      const specs = SPEC_CATALOG.filter((s) => s.category === cat);
      expect(specs.filter((s) => s.kind === kindA)).toHaveLength(8);
      expect(specs.filter((s) => s.kind === kindB)).toHaveLength(8);
      for (const tier of [0, 1, 2, 3]) {
        expect(specs.filter((s) => s.kind === kindA && s.baseTier === tier), `${cat}/${kindA}/t${tier}`).toHaveLength(2);
        expect(specs.filter((s) => s.kind === kindB && s.baseTier === tier), `${cat}/${kindB}/t${tier}`).toHaveLength(2);
      }
    }
  });

  it('each spec lives in the zone that hosts its category', () => {
    const zoneIds = new Set(ZONES.map((z) => z.id as string));
    for (const spec of SPEC_CATALOG) {
      expect(zoneIds.has(spec.zone), spec.id).toBe(true);
      expect(spec.zone, spec.id).toBe(ZONE_FOR_CATEGORY[spec.category]);
    }
    /* all 9 category zones host exactly 16; light-path hosts none of the 144 */
    expect(catalogForZone('light-path')).toHaveLength(0);
    for (const zone of Object.values(ZONE_FOR_CATEGORY)) {
      expect(catalogForZone(zone), zone).toHaveLength(16);
    }
  });

  it('tier-0 params byte-match the seed specs (e2e ground stays still)', () => {
    const tier0 = (cat: string, kind: string) =>
      SPEC_CATALOG.find((s) => s.category === cat && s.kind === kind && s.baseTier === 0)!;
    expect(tier0('memory', 'memory-pairs').params).toEqual({ itemCount: 4, rounds: 1 });
    expect(tier0('logic', 'sequence-echo').params).toEqual({ rounds: 3 });
    expect(tier0('attention', 'find-target').params).toEqual({ itemCount: 5, speed: 1 });
    expect(tier0('logic', 'sort-order').params).toEqual({ itemCount: 4 });
    expect(tier0('spatial', 'match-shadow').params).toEqual({ itemCount: 4 });
    expect(tier0('language', 'letter-find').params).toEqual({ itemCount: 6, rounds: 5 });
    expect(tier0('emotion', 'emotion-name').params).toEqual({ rounds: 5 });
    expect(tier0('creativity', 'paint-fill').params).toEqual({ itemCount: 5 });
    expect(tier0('creativity', 'open-create').params).toEqual({ itemCount: 7 });
    expect(tier0('rhythm', 'rhythm-tap').params).toEqual({ rounds: 8, speed: 78 });
    expect(tier0('breath', 'breath-guide').params).toEqual({ itemCount: 3 });
  });

  it('open-endedness follows the template', () => {
    for (const spec of SPEC_CATALOG) {
      if (spec.kind === 'open-create' || spec.kind === 'paint-fill') expect(spec.openEnded, spec.id).toBe(true);
      else expect(spec.openEnded, spec.id).toBe(false);
    }
  });

  it('catalogSpec finds by id and miss returns undefined', () => {
    const first = SPEC_CATALOG[0];
    expect(catalogSpec(first.id)).toBe(first);
    expect(catalogSpec('nope-nope-nope')).toBeUndefined();
  });

  it('the validator rejects a corrupted spec', () => {
    const spec = JSON.parse(JSON.stringify(SPEC_CATALOG[0]));
    spec.baseTier = 9;
    spec.skills = [];
    spec.zone = 'nowhere';
    expect(validateSpec(spec)).toMatchObject(expect.any(String));
    expect(validateSpec(spec)).toContain('baseTier');
    expect(validateSpec(spec)).toContain('skills');
  });
});
