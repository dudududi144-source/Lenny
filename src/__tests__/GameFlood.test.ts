/* ============================================================
 * GameFlood — stage 16-b registry + wiring pins.
 *
 * The flood contract:
 *   - 4 NEW kinds (count-tap / trace-path / sound-hunt / rhyme-pick),
 *     each with 3 instances spread one per StationBand (0/1/2)
 *   - the registry grew 43 → 58 by APPENDING: every existing
 *     default-progression index still points at the same spec
 *   - every spec (hand-written, derived, legacy) validates and routes
 *     to a registered scene
 *   - the derived 144 stay byte-identical in shape (16 per zone,
 *     8+8 two-kind splits) — the flood never moved the e2e ground
 *   - the new kinds' skills have Hebrew labels for the parent lens
 * ============================================================ */

import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_REGISTRY, gamesInZone } from '../games/builder/GameRegistry';
import { validateCatalog } from '../content/SpecValidator';
import { SPEC_CATALOG, catalogForZone } from '../content/SpecGenerator';
import { displayNameFor, installCatalog, zoneCatalog } from '../content/catalog';
import { SCENE_REGISTRY, sceneKeyForSpec } from '../games/scenes/registry';
import { tierBandOf } from '../world/WorldStations';
import { SKILL_FALLBACK_LABEL } from '../ui/parentlens/insights';

const NEW_KINDS = ['count-tap', 'trace-path', 'sound-hunt', 'rhyme-pick'] as const;

const NEW_KIND_IDS: Record<(typeof NEW_KINDS)[number], string[]> = {
  'count-tap': ['count-acorns-1', 'count-acorns-2', 'count-acorns-3'],
  'trace-path': ['trace-stars-1', 'trace-stars-2', 'trace-stars-3'],
  'sound-hunt': ['find-frog-1', 'find-frog-2', 'find-frog-3'],
  'rhyme-pick': ['rhyme-pick-1', 'rhyme-pick-2', 'rhyme-pick-3'],
};

const KIND_SKILLS: Record<(typeof NEW_KINDS)[number], string[]> = {
  'count-tap': ['logic.counting', 'logic.cardinality'],
  'trace-path': ['motor.tracing'],
  'sound-hunt': ['attention.auditory'],
  'rhyme-pick': ['language.rhyme', 'language.phonemes'],
};

describe('game flood — the registry grew the honest way', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('58 hand-written instances (43 + 15), 144 derived, all valid at boot', () => {
    expect(GAME_REGISTRY).toHaveLength(58);
    expect(SPEC_CATALOG).toHaveLength(144);
    expect(() => installCatalog()).not.toThrow();
    expect(validateCatalog([...GAME_REGISTRY, ...SPEC_CATALOG])).toEqual({});
  });

  it('the flood only APPENDED: the first 43 ids never moved', () => {
    /* the exact spine order the existing default-progression pins read */
    expect(GAME_REGISTRY.slice(0, 43).map((s) => s.id)).toEqual([
      'memory-pairs-1', 'memory-pairs-2', 'sequence-echo-1',
      'find-fish-1', 'find-fish-2', 'find-fish-3', 'find-fish-4',
      'sort-acorns-1', 'sort-acorns-2',
      'match-kites-1', 'match-kites-2',
      'find-letter-1', 'find-letter-2', 'find-letter-3', 'find-letter-4',
      'emotion-turtle-1', 'emotion-turtle-2', 'emotion-turtle-3', 'emotion-turtle-4',
      'paint-flower-1',
      'drum-beat-1', 'drum-beat-2', 'drum-beat-3', 'drum-beat-4', 'drum-beat-5',
      'breath-lanterns-1', 'breath-lanterns-2',
      'open-create-1',
      'rainbow-bridge-1', 'rainbow-bridge-2', 'rainbow-bridge-3',
      'leaf-nests-1', 'leaf-nests-2', 'leaf-nests-3',
      'true-shadows-1', 'true-shadows-2', 'true-shadows-3',
      'star-threads-1', 'star-threads-2', 'star-threads-3',
      'wind-melody-1', 'wind-melody-2', 'wind-melody-3',
    ]);
  });

  it('every one of the 4 new kinds owns 3 instances, one per StationBand', () => {
    for (const kind of NEW_KINDS) {
      const specs = GAME_REGISTRY.filter((s) => s.kind === kind);
      expect(specs.map((s) => s.id), kind).toEqual(NEW_KIND_IDS[kind]);
      expect(specs.map((s) => tierBandOf(s.baseTier)), kind).toEqual([0, 1, 2]);
      /* exactly one instance per band — the stations always meet the kind */
      for (const band of [0, 1, 2]) {
        expect(specs.filter((s) => tierBandOf(s.baseTier) === band), `${kind}/band${band}`).toHaveLength(1);
      }
    }
  });

  it('every new kind lives in its zone, and the zones already surface it', () => {
    expect(NEW_KIND_IDS['count-tap'].every((id) => gamesInZone('thinking-forest').some((s) => s.id === id))).toBe(true);
    expect(NEW_KIND_IDS['trace-path'].every((id) => gamesInZone('space-sky').some((s) => s.id === id))).toBe(true);
    expect(NEW_KIND_IDS['sound-hunt'].every((id) => gamesInZone('rhythm-square').some((s) => s.id === id))).toBe(true);
    expect(NEW_KIND_IDS['rhyme-pick'].every((id) => gamesInZone('words-valley').some((s) => s.id === id))).toBe(true);
    /* and the world stations' band filter really hands them out */
    for (const kind of NEW_KINDS) {
      for (const spec of GAME_REGISTRY.filter((s) => s.kind === kind)) {
        const band = tierBandOf(spec.baseTier);
        const bandSpecs = zoneCatalog(spec.zone).filter((s) => tierBandOf(s.baseTier) === band);
        expect(bandSpecs.some((s) => s.id === spec.id), `${spec.id} in band ${band}`).toBe(true);
      }
    }
  });

  it('every registry spec routes to a REGISTERED scene (no coming-soon in the flood)', () => {
    for (const spec of GAME_REGISTRY) {
      const key = sceneKeyForSpec(spec);
      expect(SCENE_REGISTRY[key], `${spec.id} → ${key}`).toBeDefined();
    }
    expect(sceneKeyForSpec(GAME_REGISTRY.find((s) => s.id === 'count-acorns-1')!)).toBe('count-tap');
    expect(sceneKeyForSpec(GAME_REGISTRY.find((s) => s.id === 'trace-stars-2')!)).toBe('trace-path');
    expect(sceneKeyForSpec(GAME_REGISTRY.find((s) => s.id === 'find-frog-1')!)).toBe('sound-hunt');
    expect(sceneKeyForSpec(GAME_REGISTRY.find((s) => s.id === 'rhyme-pick-3')!)).toBe('rhyme-pick');
  });

  it('every shelf card reads Hebrew — the 15 new ids included', () => {
    for (const spec of GAME_REGISTRY) {
      const name = displayNameFor(spec);
      expect(name, spec.id).not.toMatch(/^[a-z-]+\d*$/);
      expect(/\p{Script=Hebrew}/u.test(name), spec.id).toBe(true);
    }
  });

  it('the new kinds report skills the parent lens can say in Hebrew', () => {
    for (const kind of NEW_KINDS) {
      for (const skill of KIND_SKILLS[kind]) {
        expect(SKILL_FALLBACK_LABEL[skill], `${kind}: ${skill}`).toMatch(/\p{Script=Hebrew}/u);
      }
    }
  });

  it('the derived 144 keep their exact shape (the flood never moved the ground)', () => {
    for (const zone of ['memory-hill', 'attention-stream', 'thinking-forest', 'rhythm-square', 'words-valley', 'space-sky']) {
      expect(catalogForZone(zone), zone).toHaveLength(16);
      const spine = GAME_REGISTRY.filter((s) => s.zone === zone).length;
      expect(zoneCatalog(zone).slice(spine), zone).toEqual(catalogForZone(zone));
    }
    /* the 8+8 two-kind split for logic/creativity survives untouched */
    expect(SPEC_CATALOG.filter((s) => s.category === 'logic' && s.kind === 'sort-order')).toHaveLength(8);
    expect(SPEC_CATALOG.filter((s) => s.category === 'logic' && s.kind === 'sequence-echo')).toHaveLength(8);
  });
});
