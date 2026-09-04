import { describe, expect, it } from 'vitest';
import {
  ACORN_LEDGER_CAP,
  ACORN_SPOTS,
  isValidAcornId,
  loadAcornSave,
  loadAcorns,
  loadWallet,
  markAcorn,
  mulberry32,
  spendAcorns,
} from '../world/worldAcorns';
import { LANDMARKS, WANDER_RADIUS, WORLD_ISLANDS } from '../world/WorldLayout';
import { REGION_ROADS } from '../world/WorldRegions';
import { STATIONS, STATION_NEAR_RADIUS } from '../world/WorldStations';

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

describe('worldAcorns — the road pays the walker', () => {
  it('scatters a generous, deterministic table of acorns', () => {
    expect(ACORN_SPOTS.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(ACORN_SPOTS.map((a) => a.id));
    expect(ids.size).toBe(ACORN_SPOTS.length);
    for (const a of ACORN_SPOTS) {
      expect(isValidAcornId(a.id)).toBe(true);
      expect(Math.hypot(a.x, a.z)).toBeLessThanOrEqual(WANDER_RADIUS);
    }
  });

  it('every acorn keeps clear of the places, the islands and the pads', () => {
    for (const a of ACORN_SPOTS) {
      for (const l of LANDMARKS) {
        expect(Math.hypot(a.x - l.x, a.z - l.z)).toBeGreaterThanOrEqual(l.keep + 0.6);
      }
      for (const p of WORLD_ISLANDS) {
        expect(Math.hypot(a.x - p.x, a.z - p.z)).toBeGreaterThanOrEqual(p.radius + 1.0);
      }
      for (const s of STATIONS) {
        expect(Math.hypot(a.x - s.x, a.z - s.z)).toBeGreaterThanOrEqual(STATION_NEAR_RADIUS + 0.3);
      }
    }
  });

  it('road acorns sit on the shoulder, never IN the walking line', () => {
    for (const a of ACORN_SPOTS) {
      let best = Infinity;
      for (const road of REGION_ROADS) {
        for (const p of road.points) {
          const d = Math.hypot(a.x - p.x, a.z - p.z);
          if (d < best) best = d;
        }
      }
      expect(best).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('the mulberry32 seed is deterministic (every device sees the same woods)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 8; i++) expect(a()).toBe(b());
  });

  it('starts empty on a fresh device (and in private mode)', () => {
    const s = memoryStorage();
    expect(loadAcorns(s)).toEqual([]);
  });

  it('a gathered acorn stays gathered (idempotent, honest)', () => {
    const s = memoryStorage();
    expect(markAcorn('acorn:3', s).ids).toEqual(['acorn:3']);
    expect(markAcorn('acorn:3', s).ids).toEqual(['acorn:3']);
    expect(markAcorn('acorn:1', s).ids).toEqual(['acorn:3', 'acorn:1']);
  });

  it('the wallet fills by gathering and drains at the well (never below zero)', () => {
    const s = memoryStorage();
    expect(loadWallet(s)).toBe(0);
    markAcorn('acorn:0', s);
    markAcorn('acorn:1', s);
    markAcorn('acorn:2', s);
    expect(loadWallet(s)).toBe(3);
    /* a gathered acorn re-touched does NOT pay twice */
    markAcorn('acorn:0', s);
    expect(loadWallet(s)).toBe(3);
    expect(spendAcorns(2, s)).toBe(1);
    expect(spendAcorns(5, s)).toBe(0); /* honest floor */
    expect(loadAcorns(s)).toEqual(['acorn:0', 'acorn:1', 'acorn:2']);
  });

  it('legacy saves (a bare id array) migrate into a full wallet', () => {
    const s = memoryStorage();
    s.setItem('lenny-world-acorns-v1', JSON.stringify(['acorn:0', 'acorn:1', 'acorn:2']));
    expect(loadWallet(s)).toBe(3);
    expect(loadAcorns(s)).toEqual(['acorn:0', 'acorn:1', 'acorn:2']);
  });

  it('a corrupt wallet is re-vouched by the ledger', () => {
    const s = memoryStorage();
    s.setItem('lenny-world-acorns-v1', JSON.stringify({ ids: ['acorn:5'], wallet: 'x' }));
    expect(loadAcornSave(s).wallet).toBe(1);
  });

  it('rejects ids that are not exactly acorn:<int>', () => {
    const s = memoryStorage();
    markAcorn('acorn:x', s);
    markAcorn('acorn:1:2', s);
    markAcorn('acorn', s);
    markAcorn('sparkle:1', s);
    markAcorn('1:2:3', s);
    expect(loadAcorns(s)).toEqual([]);
    expect(isValidAcornId('acorn:42')).toBe(true);
    expect(isValidAcornId('acorn:-4')).toBe(true);
  });

  it('the ledger never outgrows its cap', () => {
    const s = memoryStorage();
    for (let i = 0; i < ACORN_LEDGER_CAP + 30; i++) markAcorn(`acorn:${i}`, s);
    const ledger = loadAcorns(s);
    expect(ledger.length).toBe(ACORN_LEDGER_CAP);
    expect(ledger[0]).toBe(`acorn:30`); /* the oldest fell off, honestly */
  });

  it('corrupt storage starts golden, never crashes', () => {
    const s = memoryStorage();
    s.setItem('lenny-world-acorns-v1', '{{{not json');
    expect(loadAcorns(s)).toEqual([]);
    s.setItem('lenny-world-acorns-v1', '"just a string"');
    expect(loadAcorns(s)).toEqual([]);
  });
});
