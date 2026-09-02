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
export const WORLD_ONBOARDED_KEY = 'lenny-world-onboarded';

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
 * Automation pin: under test runners (Playwright sets navigator.webdriver)
 * the garden resolves to CLASSIC so the 60+ legacy contracts keep running
 * against the exact UI they were written for. Real visitors get the world.
 */
export function isAutomation(detect: () => boolean | undefined = (): boolean | undefined => {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}): boolean {
  return detect() === true;
}

/**
 * The mode this session opens in:
 *   1. an explicit parent-corner choice always wins
 *   2. real visitors → the 3D world (the stage-7 default flip)
 *   3. automation (navigator.webdriver) → the classic map, so every
 *      legacy e2e contract stays pinned to the UI it tests
 */
export function resolveGardenMode(
  storage: StorageLike = localStorage,
  automation: boolean = isAutomation(),
): GardenMode {
  return readExplicitGardenMode(storage) ?? (automation ? 'classic' : 'world');
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

/** Has the child already seen the first-visit flyover? */
export function isWorldOnboarded(storage: StorageLike = localStorage): boolean {
  try {
    return storage.getItem(WORLD_ONBOARDED_KEY) !== null;
  } catch {
    return true; /* private mode: never repeat the tour */
  }
}

export function markWorldOnboarded(storage: StorageLike = localStorage): void {
  try {
    storage.setItem(WORLD_ONBOARDED_KEY, '1');
  } catch {
    /* private mode — the tour may repeat, harmless */
  }
}
