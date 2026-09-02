/* ============================================================
 * catalog — the living bridge between the seed registry and the
 * 144 derived specs.
 *
 * WHY a bridge (and not pushing into GAME_REGISTRY): the builder
 * module is frozen (Stage-6 rules: builder/* is untouchable) and
 * the garden's zone rings + e2e contract count the SEED specs
 * (light-path 0/1, memory-hill 0/3). So the seed registry stays
 * the "milestone spine" of each zone, and this module exposes the
 * merged per-zone catalog the game host and the game shelf play
 * through: seed specs first (identical behavior for every existing
 * save/e2e seed), then the 16 derived specs of the zone.
 * ============================================================ */

import { GAME_REGISTRY, gamesInZone } from '../games/builder/GameRegistry';
import type { GameSpec } from '../games/builder/GameSpec';
import type { GameCategory } from '../data/games';
import { catalogForZone, SPEC_CATALOG } from './SpecGenerator';
import { validateCatalog } from './SpecValidator';
import { finishCountOf } from './gameFinishes';

/* ============================================================
 * Legacy scene mapping (Stage 6, commit 3).
 *
 * Three existing games predate the 11 templates but must stay
 * reachable inside the catalog world:
 *   - PlayPathScene  (light-path) — unique scene, mapped to a spec
 *     with kind 'open-create' (genuinely no-wrong-answer) and a
 *     scene override so the spec system keeps routing to it.
 *   - BreathPoolScene as LennyStory — already spec-driven: kind
 *     'breath-guide' routes to the 'lenny-story' scene key.
 *   - OpenCanvasScene — already spec-driven: kind 'open-create'
 *     routes to the 'open-create' scene key; the 8 derived
 *     open-create specs play ON it with their own names.
 * ============================================================ */

/** Specs for unique legacy scenes (scene override via params.extra.scene). */
export const LEGACY_SPECS: readonly GameSpec[] = [
  {
    id: 'light-path-play-1',
    kind: 'open-create',
    zone: 'light-path',
    category: 'breath',
    skills: ['breath.regulation', 'motor.planning'],
    narrative: {
      intro: ['שְׁבִיל הָאוֹר מְנֻקָּד בִּפְנָסִים יְשֵׁנִים.', 'בּוֹא נְהַלֵּךְ וְנַדְלִיק — אֵין דֶּרֶךְ שֶׁגּוֹיָה יוֹתֵר.'],
      win: 'הַשְּׁבִיל כּוּלּוֹ זוֹהֵר. זֶה שֶׁלְּךָ!',
      encourage: 'פָּנָס אֶחָד בְּכָל פַּעַם. הָאוֹר לֹא בּוֹרֵחַ.',
    },
    params: { itemCount: 7, extra: { scene: 'play' } },
    baseTier: 0,
    openEnded: true,
  },
];

function legacyForZone(zone: string): GameSpec[] {
  return LEGACY_SPECS.filter((s) => s.zone === zone);
}

/** Boot-time gate: all 144 derived specs + legacy mappings must validate.
 *  Throws loudly in dev/CI when one does not — a bad spec never reaches
 *  a child. */
export function installCatalog(): void {
  const bad = validateCatalog([...SPEC_CATALOG, ...LEGACY_SPECS]);
  const ids = Object.keys(bad);
  if (ids.length > 0) {
    console.error(`[catalog] ${ids.length} invalid specs`, bad);
    throw new Error(`catalog: ${ids.length} specs failed validation`);
  }
}

/** The full playable list for a zone: seed spine first, then the
 *  derived catalog games (tiers 0..3), then any legacy scene specs. */
export function zoneCatalog(zone: string): GameSpec[] {
  return [...gamesInZone(zone), ...catalogForZone(zone), ...legacyForZone(zone)];
}

/** Legacy + derived lookup. */
export function anySpec(id: string): GameSpec | undefined {
  return (
    GAME_REGISTRY.find((s) => s.id === id) ??
    SPEC_CATALOG.find((s) => s.id === id) ??
    LEGACY_SPECS.find((s) => s.id === id)
  );
}

/* ---------- tier locking (Stage 6, commit 2) ---------- */

/** Finishes needed on a previous-tier game to open the next tier. */
export const TIER_UNLOCK_AFTER = 3;

/**
 * A tier-t game opens when some tier-(t-1) game of the SAME category
 * was completed ×3 (t=0 always open). Reads real recorded finishes
 * (lenny-game-finishes-v1) — nothing invented.
 */
export function tierUnlocked(category: GameCategory, tier: number, exceptSpecId?: string): boolean {
  if (tier <= 0) return true;
  const prev = SPEC_CATALOG.filter(
    (s) => s.category === category && s.baseTier === tier - 1 && s.id !== exceptSpecId,
  );
  return prev.some((s) => finishCountOf(s.id) >= TIER_UNLOCK_AFTER);
}

/** How many more finishes are missing to open this tier (0 = open). */
export function tierMissing(category: GameCategory, tier: number, exceptSpecId?: string): number {
  if (tierUnlocked(category, tier, exceptSpecId)) return 0;
  const best = Math.max(
    ...SPEC_CATALOG.filter((s) => s.category === category && s.baseTier === tier - 1).map((s) =>
      finishCountOf(s.id),
    ),
    0,
  );
  return Math.max(0, TIER_UNLOCK_AFTER - best);
}
