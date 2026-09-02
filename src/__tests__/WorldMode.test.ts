import { describe, expect, it } from 'vitest';
import {
  GARDEN_MODE_KEY,
  WORLD_FALLBACK_TOAST_KEY,
  markWorldFallbackToasted,
  readExplicitGardenMode,
  resolveGardenMode,
  shouldToastWorldFallback,
  writeGardenMode,
} from '../world/worldMode';

/** Tiny storage stub — no jsdom needed, every path is pure. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length(): number {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

describe('worldMode', () => {
  it('resolves classic when nothing was ever chosen (stage-6-identical default)', () => {
    expect(resolveGardenMode(fakeStorage())).toBe('classic');
  });

  it('an explicit choice always wins', () => {
    expect(resolveGardenMode(fakeStorage({ [GARDEN_MODE_KEY]: 'world' }))).toBe('world');
    expect(resolveGardenMode(fakeStorage({ [GARDEN_MODE_KEY]: 'classic' }))).toBe('classic');
  });

  it('garbage in the key is ignored, not trusted', () => {
    expect(resolveGardenMode(fakeStorage({ [GARDEN_MODE_KEY]: 'hypercube' }))).toBe('classic');
  });

  it('a throwing storage reads as classic (private mode)', () => {
    const hostile: Storage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(resolveGardenMode(hostile)).toBe('classic');
  });

  it('readExplicitGardenMode separates "chosen classic" from "default classic"', () => {
    expect(readExplicitGardenMode(fakeStorage())).toBeNull();
    expect(readExplicitGardenMode(fakeStorage({ [GARDEN_MODE_KEY]: 'classic' }))).toBe('classic');
  });

  it('writeGardenMode persists and round-trips', () => {
    const s = fakeStorage();
    writeGardenMode('world', s);
    expect(resolveGardenMode(s)).toBe('world');
    writeGardenMode('classic', s);
    expect(resolveGardenMode(s)).toBe('classic');
  });

  it('writeGardenMode survives a throwing storage', () => {
    const hostile: Storage = {
      ...fakeStorage(),
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => writeGardenMode('world', hostile)).not.toThrow();
  });

  it('the fallback toast shows exactly once for the grown-ups', () => {
    const s = fakeStorage();
    expect(shouldToastWorldFallback(s)).toBe(true);
    markWorldFallbackToasted(s);
    expect(shouldToastWorldFallback(s)).toBe(false);
    expect(s.getItem(WORLD_FALLBACK_TOAST_KEY)).toBe('1');
  });
});
