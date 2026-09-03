/* ============================================================
 * worldCollect — the sparkles of the endless meadow (stage 11).
 *
 * A sparkle is a small golden polyhedron the walking child gathers
 * by touching it. This is the meadow's own honest memory:
 *   - localStorage only, key `lenny-world-sparkles-v1`
 *   - the schema is ONLY an array of deterministic sparkle ids
 *     (`cx:cz:i`), length-capped — no counters to lie, no timestamps
 *   - a collected sparkle never respawns: the meadow remembers
 *
 * Pure + storage-injectable (the worldFound pattern).
 * ============================================================ */

export const WORLD_SPARKLES_KEY = 'lenny-world-sparkles-v1';

/** the id ledger never outgrows this (a lifetime of wandering) */
export const SPARKLE_LEDGER_CAP = 600;

/** true when `id` has the exact `cx:cz:i` shape (three ints; chunk coords may be negative) */
export function isValidSparkleId(id: string): boolean {
  const parts = id.split(':');
  if (parts.length !== 3) return false;
  for (const p of parts) {
    if (!/^-?\d+$/.test(p)) return false;
  }
  return true;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The collected sparkle ids, oldest first. */
export function loadSparkles(storage: StorageLike = localStorage): string[] {
  try {
    const raw = storage.getItem(WORLD_SPARKLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of parsed) {
      if (typeof id === 'string' && isValidSparkleId(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out.slice(-SPARKLE_LEDGER_CAP);
  } catch {
    return []; /* private mode / corrupt — the meadow starts golden */
  }
}

/** Remember one more sparkle (idempotent, best effort). Returns the ledger. */
export function markSparkle(id: string, storage: StorageLike = localStorage): string[] {
  if (!isValidSparkleId(id)) return loadSparkles(storage);
  const found = loadSparkles(storage);
  if (found.includes(id)) return found;
  const next = [...found, id].slice(-SPARKLE_LEDGER_CAP);
  try {
    storage.setItem(WORLD_SPARKLES_KEY, JSON.stringify(next));
  } catch {
    /* private mode — this sparkle still celebrates, nothing persists */
  }
  return next;
}
