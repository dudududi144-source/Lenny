import { describe, expect, it } from 'vitest';
import { WORLD_FOUND_KEY, loadFound, markFound } from '../world/worldFound';

function stubStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  dump: () => Record<string, string>;
} {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

describe('worldFound — the places the child knows (critic round B)', () => {
  it('starts empty and marks landmarks idempotently, in canonical order', () => {
    const storage = stubStorage();
    expect(loadFound(storage as unknown as Storage)).toEqual([]);

    expect(markFound('pond', storage as unknown as Storage)).toEqual(['pond']);
    expect(markFound('pond', storage as unknown as Storage)).toEqual(['pond']);
    expect(markFound('big-tree', storage as unknown as Storage)).toEqual(['big-tree', 'pond']);
    expect(loadFound(storage as unknown as Storage)).toEqual(['big-tree', 'pond']);
  });

  it('rejects unknown ids — only the real eight places can be remembered', () => {
    const storage = stubStorage();
    expect(markFound('not-a-place', storage as unknown as Storage)).toEqual([]);
    expect(markFound('../../../etc', storage as unknown as Storage)).toEqual([]);
    expect(storage.dump()[WORLD_FOUND_KEY]).toBeUndefined();
  });

  it('corrupt storage starts clean and never throws', () => {
    const storage = stubStorage();
    storage.setItem(WORLD_FOUND_KEY, 'not json at all');
    expect(loadFound(storage as unknown as Storage)).toEqual([]);
    storage.setItem(WORLD_FOUND_KEY, '{"hacked": true}');
    expect(loadFound(storage as unknown as Storage)).toEqual([]);
    storage.setItem(WORLD_FOUND_KEY, '["pond","bogus",42]');
    expect(loadFound(storage as unknown as Storage)).toEqual(['pond']);
  });
});
