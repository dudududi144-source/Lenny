/* ============================================================
 * worldWardrobe — the well's promise (stage 14).
 *
 * Acorns become something: at בְּאֵר הַגַּן (the garden well) the
 * child spends her gathered acorns on the fox's scarves, and the
 * scarf is ON the fox in the 3D world — the walk pays for the wear.
 *
 * localStorage only, schema { owned: string[], wearing: id|null }.
 * Pure logic + storage-injectable (the worldCollect pattern).
 * ============================================================ */

export const WORLD_WARDROBE_KEY = 'lenny-world-wardrobe-v1';

export interface ScarfItem {
  id: string;
  name: string; /* everyday Hebrew with niqqud */
  cost: number; /* in acorns */
  color: string; /* hex — the fox wears it */
}

/** The four scarves of the well — a year of wandering, priced honestly. */
export const SCARF_ITEMS: readonly ScarfItem[] = [
  { id: 'scarf-moss', name: 'צָעִיף יָרוֹק', cost: 8, color: '#7da35a' },
  { id: 'scarf-berry', name: 'צָעִיף וָרוֹד', cost: 16, color: '#d05a7e' },
  { id: 'scarf-honey', name: 'צָעִיף דְּבַשׁ', cost: 28, color: '#e8a33d' },
  { id: 'scarf-star', name: 'צָעִיף כּוֹכָבִים', cost: 45, color: '#e6c86e' },
];

export function scarfById(id: string): ScarfItem | null {
  return SCARF_ITEMS.find((s) => s.id === id) ?? null;
}

export interface WardrobeState {
  owned: string[];
  wearing: string | null;
}

export const EMPTY_WARDROBE: WardrobeState = { owned: [], wearing: null };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function loadWardrobe(storage: StorageLike = localStorage): WardrobeState {
  try {
    const raw = storage.getItem(WORLD_WARDROBE_KEY);
    if (!raw) return { ...EMPTY_WARDROBE };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_WARDROBE };
    const p = parsed as { owned?: unknown; wearing?: unknown };
    const owned = Array.isArray(p.owned)
      ? p.owned.filter((id): id is string => typeof id === 'string' && scarfById(id) !== null)
      : [];
    const wearing = typeof p.wearing === 'string' && scarfById(p.wearing) !== null ? p.wearing : null;
    /* wearing implies owned — a corrupt save never ghosts a scarf */
    if (wearing && !owned.includes(wearing)) owned.push(wearing);
    return { owned, wearing };
  } catch {
    return { ...EMPTY_WARDROBE };
  }
}

function save(state: WardrobeState, storage: StorageLike): WardrobeState {
  try {
    storage.setItem(WORLD_WARDROBE_KEY, JSON.stringify(state));
  } catch {
    /* private mode — the scarf still wears this session */
  }
  return state;
}

export type BuyResult = { ok: true; state: WardrobeState; spent: number } | { ok: false; reason: 'unknown' | 'owned' | 'poor' };

/** Buy a scarf with acorns the child has actually gathered. */
export function buyScarf(state: WardrobeState, id: string, acorns: number, storage: StorageLike = localStorage): BuyResult {
  const item = scarfById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (acorns < item.cost) return { ok: false, reason: 'poor' };
  const next: WardrobeState = { owned: [...state.owned, id], wearing: id };
  return { ok: true, state: save(next, storage), spent: item.cost };
}

/** Wear (or take off) an owned scarf. */
export function wearScarf(state: WardrobeState, id: string | null, storage: StorageLike = localStorage): WardrobeState {
  if (id !== null && !state.owned.includes(id)) return state;
  return save({ ...state, wearing: id }, storage);
}
