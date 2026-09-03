/* ============================================================
 * worldFound — which landmarks the child has discovered, ever.
 * (critic round B, W1/W2)
 *
 * Discovery is the world's own memory of ENVIRONMENT KNOWLEDGE:
 * eight named places, learned by walking to them. This is not
 * progress toward anything — no lights, no unlocks, no percent —
 * just "הילד מכיר את הגן" the way a parent would tell it.
 *
 * Storage contract (mirrors ETHICS.md / worldDiary):
 *   - localStorage only, key `lenny-world-found-v1`
 *   - the schema holds ONLY an array of landmark ids, validated
 *     against WorldLayout.LANDMARKS — no free text, no timestamps
 *
 * Pure + storage-injectable (the worldMode pattern).
 * ============================================================ */

import { LANDMARKS } from './WorldLayout';
import { REGIONS } from './WorldRegions';

export const WORLD_FOUND_KEY = 'lenny-world-found-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/* stage 12: regions live in the same ledger with a `region:` prefix —
   environment knowledge is one honest memory, places AND regions */
const VALID = new Set<string>([
  ...LANDMARKS.map((l) => l.id),
  ...REGIONS.map((r) => `region:${r.id}` as string),
]);

/** The discovered landmark ids, in canonical layout order. */
export function loadFound(storage: StorageLike = localStorage): string[] {
  try {
    const raw = storage.getItem(WORLD_FOUND_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<string>();
    for (const id of parsed) {
      if (typeof id === 'string' && VALID.has(id)) ids.add(id);
    }
    const landmarkIds = LANDMARKS.filter((l) => ids.has(l.id)).map((l) => l.id);
    const regionIds = REGIONS.filter((r) => ids.has(`region:${r.id}`)).map((r) => `region:${r.id}`);
    return [...landmarkIds, ...regionIds];
  } catch {
    return []; /* private mode / corrupt — the world starts undiscovered */
  }
}

/** Remember one more landmark (idempotent, best effort). */
export function markFound(id: string, storage: StorageLike = localStorage): string[] {
  const found = loadFound(storage);
  if (!VALID.has(id) || found.includes(id)) return found;
  try {
    storage.setItem(WORLD_FOUND_KEY, JSON.stringify([...found, id]));
  } catch {
    /* private mode — this visit still celebrates, nothing persists */
  }
  return loadFound(storage);
}

/** How many REGIONS the child has walked into (the parent's lens row). */
export function countRegionsFound(found: ReadonlyArray<string>): number {
  return found.filter((id) => id.startsWith('region:')).length;
}
