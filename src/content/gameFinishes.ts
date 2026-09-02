/* ============================================================
 * gameFinishes — per-game completion counts (Stage 6).
 *
 * The garden counts zone finishes (ProgressStore); the catalog
 * needs per-GAME finishes so tiers can unlock one step at a time.
 * One new localStorage key (lenny-game-finishes-v1), written from
 * the single choke point every scene shares (GameScene finish flows).
 *
 * Shape: { [specId]: count } — additive, seedable for e2e.
 * ============================================================ */

const KEY = 'lenny-game-finishes-v1';

type FinishMap = Record<string, number>;

function load(): FinishMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FinishMap;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* fresh */
  }
  return {};
}

function save(map: FinishMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode: finishes stay in-memory for the session */
  }
}

/** Record one completion of a specific game (spec id). */
export function recordGameFinish(specId: string): void {
  if (!specId) return;
  const map = load();
  map[specId] = (map[specId] || 0) + 1;
  save(map);
}

/** How many times this game was completed (0 = never). */
export function finishCountOf(specId: string): number {
  return load()[specId] || 0;
}

/** All recorded finishes (read-only copy — ParentLens/debug friendly). */
export function allFinishes(): Readonly<FinishMap> {
  return { ...load() };
}
