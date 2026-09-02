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
import { catalogForZone, SPEC_CATALOG, NAME_BY_ID } from './SpecGenerator';
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

/* ---------- child-facing names for the seed + legacy specs ----------
   The 144 derived specs name themselves from data/games.ts; the
   hand-written seed specs (and the PlayPath mapping) deserve real
   Hebrew names too — a shelf card that says "breath-lanterns-1" is
   a broken feeling for a 4-year-old and her parent. */

const SEED_DISPLAY: Record<string, string> = {
  'memory-pairs-1': 'זוּגוֹת פְּרָחִים',
  'memory-pairs-2': 'זוּגוֹת נוֹסְפִים',
  'sequence-echo-1': 'מַקְהֵלַת הָאוֹר',
  'find-fish-1': 'הַדָּג הַזָּהוּב',
  'find-fish-2': 'עוֹד דָּגִים בַּנַּחַל',
  'find-fish-3': 'הַנַּחַל הַמָּלֵא',
  'find-fish-4': 'אַלּוּף הַדָּגִים',
  'sort-acorns-1': 'סִדּוּר בְּלוּטִים',
  'sort-acorns-2': 'בְּלוּטִים נוֹסְפִים',
  'match-kites-1': 'עִפְעוֹפִים וּצְלָלִים',
  'match-kites-2': 'עִפְעוֹפִים נוֹסְפִים',
  'find-letter-1': 'הָאוֹת הָרִאשׁוֹנָה',
  'find-letter-2': 'עוֹד אוֹתִיּוֹת',
  'find-letter-3': 'הָאַרְנֶבֶת צָרִיכָה עָזְרָה',
  'find-letter-4': 'אַלּוּף הָאוֹתִיּוֹת',
  'emotion-turtle-1': 'מָה הַצָּב מַרְגִּישׁ?',
  'emotion-turtle-2': 'רְגָשׁוֹת נוֹסְפִים',
  'emotion-turtle-3': 'הַצָּב לָמַד הַרְבֵּה',
  'emotion-turtle-4': 'אַלּוּף הָרְגָשׁוֹת',
  'paint-flower-1': 'הַפֶּרַח שֶׁל הַדְּבוֹרָה',
  'drum-beat-1': 'הַתֹּף הַקָּטָן',
  'drum-beat-2': 'הַקֶּצֶב הֶאָרֹךְ',
  'drum-beat-3': 'קֶצֶב מָהִיר',
  'drum-beat-4': 'אַלּוּף הַתֹּף',
  'drum-beat-5': 'לְהָקָה שְׁלֵמָה',
  'breath-lanterns-1': 'פָּנָסֵי הַלַּיְלָה',
  'breath-lanterns-2': 'עוֹד פָּנָסִים',
  'open-create-1': 'הַצַּיִר הַחָפְשִׁי',
  'light-path-play-1': 'שְׁבִיל הַפָּנָסִים',
};

/** The name a child (or parent) reads on a shelf card — Hebrew for
 *  every game: derived, seed, and legacy alike. */
export function displayNameFor(spec: GameSpec): string {
  return NAME_BY_ID[spec.id] ?? SEED_DISPLAY[spec.id] ?? spec.id;
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
