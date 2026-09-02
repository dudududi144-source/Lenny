/* ============================================================
 * worldMode — which garden does a session open: the 3D world
 * (Babylon) or the classic 2D map (untouched GardenMap).
 *
 * Stage 7 rules:
 *   - The classic map is ALWAYS a complete fallback ("גַּן קְלָאסִי").
 *   - An explicit mode (parent corner) always wins.
 *   - Without an explicit choice the default is CLASSIC for now;
 *     the stage-7 default flip (world for real visitors, classic
 *     under automation so the legacy contracts stay pinned) is a
 *     single, later, reviewed commit.
 *   - When the world fails (no WebGL2 / init crash / sustained
 *     low fps) the shell falls back silently and shows ONE gentle
 *     grown-up toast — never a child-facing error.
 *
 * Pure + storage-injectable so the unit tests can pin every path.
 * ============================================================ */

export type GardenMode = 'world' | 'classic';

export const GARDEN_MODE_KEY = 'lenny-garden-mode';
export const WORLD_FALLBACK_TOAST_KEY = 'lenny-world-fallback-toast';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Explicitly chosen mode, or null when the child never chose. */
export function readExplicitGardenMode(storage: StorageLike = localStorage): GardenMode | null {
  try {
    const raw = storage.getItem(GARDEN_MODE_KEY);
    if (raw === 'world' || raw === 'classic') return raw;
  } catch {
    /* private mode — no storage, no memory */
  }
  return null;
}

/**
 * The mode this session opens in. Stage 7 (commit 7) turns the
 * fallback default into "world for real visitors, classic under
 * automation"; until that flip, an unset key resolves to classic
 * so the live product behaves byte-identically to stage 6.
 */
export function resolveGardenMode(storage: StorageLike = localStorage): GardenMode {
  return readExplicitGardenMode(storage) ?? 'classic';
}

/** Persist a parent-corner choice (best effort — private mode is fine). */
export function writeGardenMode(mode: GardenMode, storage: StorageLike = localStorage): void {
  try {
    storage.setItem(GARDEN_MODE_KEY, mode);
  } catch {
    /* nothing to remember — the session still works */
  }
}

/** One gentle fallback note for the grown-ups, ever. */
export function shouldToastWorldFallback(storage: StorageLike = localStorage): boolean {
  try {
    return storage.getItem(WORLD_FALLBACK_TOAST_KEY) === null;
  } catch {
    return true;
  }
}

export function markWorldFallbackToasted(storage: StorageLike = localStorage): void {
  try {
    storage.setItem(WORLD_FALLBACK_TOAST_KEY, '1');
  } catch {
    /* private mode — the note may repeat, harmless */
  }
}
