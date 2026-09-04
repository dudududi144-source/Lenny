import { describe, expect, it } from 'vitest';
import {
  EMPTY_WARDROBE,
  SCARF_ITEMS,
  WORLD_WARDROBE_KEY,
  buyScarf,
  loadWardrobe,
  scarfById,
  wearScarf,
} from '../world/worldWardrobe';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('worldWardrobe — the well keeps its promise', () => {
  it('prices a year of wandering honestly (4 scarves, rising costs)', () => {
    expect(SCARF_ITEMS.length).toBe(4);
    for (let i = 1; i < SCARF_ITEMS.length; i++) {
      expect(SCARF_ITEMS[i].cost).toBeGreaterThan(SCARF_ITEMS[i - 1].cost);
    }
  });

  it('starts empty on a fresh device', () => {
    expect(loadWardrobe(memoryStorage())).toEqual(EMPTY_WARDROBE);
  });

  it('buying with too few acorns never happens', () => {
    const s = memoryStorage();
    const res = buyScarf(EMPTY_WARDROBE, SCARF_ITEMS[0].id, 3, s);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('poor');
    expect(loadWardrobe(s)).toEqual(EMPTY_WARDROBE);
  });

  it('buying an owned scarf never happens twice', () => {
    const s = memoryStorage();
    const first = buyScarf(EMPTY_WARDROBE, SCARF_ITEMS[0].id, 99, s);
    expect(first.ok).toBe(true);
    const state = first.ok ? first.state : EMPTY_WARDROBE;
    const second = buyScarf(state, SCARF_ITEMS[0].id, 99, s);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('owned');
  });

  it('buying an unknown scarf never happens at all', () => {
    const res = buyScarf(EMPTY_WARDROBE, 'scarf-moon', 99, memoryStorage());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('unknown');
  });

  it('a real purchase owns the scarf AND wears it, spending honestly', () => {
    const s = memoryStorage();
    const item = SCARF_ITEMS[1];
    const res = buyScarf(EMPTY_WARDROBE, item.id, item.cost + 5, s);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.spent).toBe(item.cost); /* the ledger counts acorns, not force */
      expect(res.state.owned).toEqual([item.id]);
      expect(res.state.wearing).toBe(item.id);
    }
    const loaded = loadWardrobe(s);
    expect(loaded.owned).toEqual([item.id]);
    expect(loaded.wearing).toBe(item.id);
  });

  it('wearing an un-owned scarf is a no-op (no ghost wardrobes)', () => {
    const s = memoryStorage();
    expect(wearScarf(EMPTY_WARDROBE, SCARF_ITEMS[0].id, s)).toEqual(EMPTY_WARDROBE);
  });

  it('taking the scarf off unwears but still owns', () => {
    const s = memoryStorage();
    const item = SCARF_ITEMS[0];
    const bought = buyScarf(EMPTY_WARDROBE, item.id, item.cost, s);
    const state = bought.ok ? bought.state : EMPTY_WARDROBE;
    const off = wearScarf(state, null, s);
    expect(off.wearing).toBeNull();
    expect(off.owned).toEqual([item.id]);
  });

  it('a corrupt save never ghosts a scarf (wearing implies owned)', () => {
    const s = memoryStorage();
    s.setItem(WORLD_WARDROBE_KEY, JSON.stringify({ owned: [], wearing: SCARF_ITEMS[2].id }));
    const state = loadWardrobe(s);
    expect(state.wearing).toBe(SCARF_ITEMS[2].id);
    expect(state.owned).toContain(SCARF_ITEMS[2].id);
  });

  it('corrupt or foreign saves start clean', () => {
    const s = memoryStorage();
    s.setItem(WORLD_WARDROBE_KEY, 'nonsense');
    expect(loadWardrobe(s)).toEqual(EMPTY_WARDROBE);
    s.setItem(WORLD_WARDROBE_KEY, JSON.stringify({ owned: ['scarf-moon'], wearing: 'scarf-moon' }));
    expect(loadWardrobe(s)).toEqual(EMPTY_WARDROBE);
  });

  it('every scarf id is unique and colors are hex', () => {
    const ids = new Set(SCARF_ITEMS.map((s) => s.id));
    expect(ids.size).toBe(SCARF_ITEMS.length);
    for (const item of SCARF_ITEMS) {
      expect(scarfById(item.id)).not.toBeNull();
      expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
