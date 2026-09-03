/* ============================================================
 * SpecValidator — the GameFactory.validate() of the new shell.
 *
 * The builder's GameFactory lived in the old Phaser shell; the
 * 2026 PixiJS shell validates specs with this module instead
 * (same contract: return every problem, pass = null).
 *
 * The catalog install (src/content/catalog.ts) runs it on all
 * 144 derived specs + the legacy mapping at boot — one bad spec
 * never reaches a child.
 * ============================================================ */

import { CATEGORIES } from '../data/games';
import { ZONES } from '../data/garden';
import type { GameSpec } from '../games/builder/GameSpec';
import { ZONE_FOR_CATEGORY } from './SpecGenerator';

const KINDS = new Set([
  'memory-pairs',
  'find-target',
  'sort-order',
  'match-shadow',
  'rhythm-tap',
  'paint-fill',
  'emotion-name',
  'letter-find',
  'breath-guide',
  'open-create',
  'sequence-echo',
] as const);

const ZONE_IDS = new Set(ZONES.map((z) => z.id as string));

/* Mechanic variants (round C): the only extras a derived spec may
   carry. Each kind accepts exactly its own variant, and tier-0 must
   stay variant-free — the seed specs + e2e ground never move. */
const VARIANTS_BY_KIND: Partial<Record<string, ReadonlySet<string>>> = {
  'memory-pairs': new Set(['wind']),
  'letter-find': new Set(['first-sound']),
  'match-shadow': new Set(['rotated-shapes']),
  'sort-order': new Set(['descending']),
  'emotion-name': new Set(['situation']),
};

/**
 * Validate one GameSpec. Returns null when the spec is playable,
 * otherwise a short human-readable problem list.
 */
export function validateSpec(spec: GameSpec): string | null {
  const problems: string[] = [];

  if (!spec || typeof spec !== 'object') return 'spec is not an object';

  /* identity */
  if (typeof spec.id !== 'string' || spec.id.length === 0) problems.push('id missing');
  else if (/\s/.test(spec.id)) problems.push(`id has whitespace: "${spec.id}"`);

  /* template + placement */
  if (!KINDS.has(spec.kind as never)) problems.push(`unknown kind: ${String(spec.kind)}`);
  if (!ZONE_IDS.has(spec.zone)) problems.push(`unknown zone: ${String(spec.zone)}`);
  if (!(spec.category in CATEGORIES)) problems.push(`unknown category: ${String(spec.category)}`);
  /* category->zone coherence applies to derived specs only; a legacy
     scene spec pins its own scene via params.extra.scene and may live
     in the zone that scene belongs to (e.g. breath-category PlayPath
     in light-path). */
  const sceneOverride = spec.params?.extra?.scene;
  if (
    !sceneOverride &&
    spec.category in ZONE_FOR_CATEGORY &&
    spec.zone !== ZONE_FOR_CATEGORY[spec.category]
  ) {
    problems.push(`zone "${spec.zone}" does not host category "${spec.category}"`);
  }

  /* skills */
  if (!Array.isArray(spec.skills) || spec.skills.length === 0) {
    problems.push('skills empty');
  } else if (spec.skills.some((s) => typeof s !== 'string' || s.length === 0)) {
    problems.push('skills contain empty entries');
  } else if (new Set(spec.skills).size !== spec.skills.length) {
    problems.push('skills contain duplicates');
  }

  /* narrative */
  if (!spec.narrative) {
    problems.push('narrative missing');
  } else {
    if (!Array.isArray(spec.narrative.intro) || spec.narrative.intro.length === 0 ||
        spec.narrative.intro.some((l) => typeof l !== 'string' || l.trim().length === 0)) {
      problems.push('narrative.intro empty');
    }
    if (typeof spec.narrative.win !== 'string' || spec.narrative.win.trim().length === 0) {
      problems.push('narrative.win empty');
    }
    if (typeof spec.narrative.encourage !== 'string' || spec.narrative.encourage.trim().length === 0) {
      problems.push('narrative.encourage empty');
    }
  }

  /* params */
  if (!spec.params || typeof spec.params !== 'object') {
    problems.push('params missing');
  } else {
    const numeric = [spec.params.itemCount, spec.params.speed, spec.params.rounds];
    if (numeric.some((v) => v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0))) {
      problems.push('params contain non-positive numbers');
    }
    if (spec.params.itemCount !== undefined && spec.params.itemCount > 12) {
      problems.push(`itemCount too large for a 4-7 attention span: ${spec.params.itemCount}`);
    }
    /* variant coherence (round C) */
    const variant = spec.params.extra?.variant;
    if (variant !== undefined) {
      const allowed = VARIANTS_BY_KIND[spec.kind];
      if (!allowed || typeof variant !== 'string' || !allowed.has(variant)) {
        problems.push(`unknown variant "${String(variant)}" for kind ${spec.kind}`);
      } else if (spec.baseTier === 0) {
        problems.push('tier-0 spec must stay variant-free (e2e ground never moves)');
      }
    }
  }

  /* tier */
  if (!Number.isInteger(spec.baseTier) || spec.baseTier < 0 || spec.baseTier > 3) {
    problems.push(`baseTier out of 0..3: ${String(spec.baseTier)}`);
  }

  /* open-ended coherence: pure-creation templates must be open,
     cognitive ones must not lie */
  if ((spec.kind === 'open-create' || spec.kind === 'paint-fill') && !spec.openEnded) {
    problems.push(`kind ${spec.kind} must be openEnded`);
  }
  if (spec.openEnded && spec.kind !== 'open-create' && spec.kind !== 'paint-fill') {
    problems.push(`openEnded spec has cognitive kind: ${String(spec.kind)}`);
  }

  return problems.length > 0 ? problems.join('; ') : null;
}

/** Validate a whole catalog; returns a map of id -> problems (empty = all good). */
export function validateCatalog(specs: readonly GameSpec[]): Record<string, string> {
  const bad: Record<string, string> = {};
  for (const s of specs) {
    const problem = validateSpec(s);
    if (problem) bad[s.id] = problem;
  }
  return bad;
}
