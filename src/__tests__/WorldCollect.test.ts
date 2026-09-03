import { describe, expect, it } from 'vitest';
import {
  SPARKLE_LEDGER_CAP,
  isValidSparkleId,
  loadSparkles,
  markSparkle,
} from '../world/worldCollect';

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

describe('worldCollect — the meadow remembers what was gathered', () => {
  it('starts empty on a fresh device (and in private mode)', () => {
    const s = memoryStorage();
    expect(loadSparkles(s)).toEqual([]);
  });

  it('a collected sparkle stays collected (idempotent, honest)', () => {
    const s = memoryStorage();
    expect(markSparkle('2:-3:1', s)).toEqual(['2:-3:1']);
    expect(markSparkle('2:-3:1', s)).toEqual(['2:-3:1']);
    expect(markSparkle('4:0:0', s)).toEqual(['2:-3:1', '4:0:0']);
  });

  it('rejects ids that are not exactly cx:cz:i', () => {
    const s = memoryStorage();
    markSparkle('not-a-sparkle', s);
    markSparkle('1:2:x', s);
    markSparkle('1:2:3:4', s);
    markSparkle('1.5:0:0', s);
    markSparkle('--1:0:0', s);
    markSparkle('../etc', s);
    expect(loadSparkles(s)).toEqual([]);
    expect(isValidSparkleId('12:0:7')).toBe(true);
    expect(isValidSparkleId('-1:0:0')).toBe(true); /* chunk coords go negative */
    expect(isValidSparkleId('1:-22:3')).toBe(true);
    expect(isValidSparkleId('1.5:0:0')).toBe(false);
  });

  it('corrupt storage never crashes the meadow', () => {
    const s = memoryStorage();
    s.setItem('lenny-world-sparkles-v1', '{not json');
    expect(loadSparkles(s)).toEqual([]);
    s.setItem('lenny-world-sparkles-v1', '"just a string"');
    expect(loadSparkles(s)).toEqual([]);
  });

  it('the ledger is capped — a lifetime of wandering, bounded memory', () => {
    const s = memoryStorage();
    for (let i = 0; i < SPARKLE_LEDGER_CAP + 50; i++) {
      markSparkle(`${i}:0:0`, s);
    }
    const ledger = loadSparkles(s);
    expect(ledger.length).toBe(SPARKLE_LEDGER_CAP);
    /* the OLDEST ids fall off, the newest stay */
    expect(ledger[ledger.length - 1]).toBe(`${SPARKLE_LEDGER_CAP + 49}:0:0`);
  });
});
