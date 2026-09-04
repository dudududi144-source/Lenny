import { describe, expect, it } from 'vitest';
import {
  dayKeyFor,
  WorldDiary,
  WORLD_DIARY_HEARTBEAT_CAP_MS,
  WORLD_DIARY_KEY,
  WORLD_DIARY_RETENTION_DAYS,
} from '../world/worldDiary';

/* The worldMode.test.ts storage stub pattern — every path is pure. */
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
      map.set(key, String(value));
    },
  };
}

/** Local-noon pin: day buckets never wobble around midnight. */
const NOON = new Date(2026, 8, 2, 12, 0, 0).getTime(); /* 2026-09-02 local noon */

describe('dayKeyFor', () => {
  it('formats a local date bucket key YYYY-MM-DD', () => {
    expect(dayKeyFor(new Date(2026, 2, 5, 7, 30).getTime())).toBe('2026-03-05');
    expect(dayKeyFor(NOON)).toBe('2026-09-02');
  });
});

describe('WorldDiary', () => {
  it('records opens, heartbeats, arrivals, shelf opens and picks in today bucket', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);

    diary.noteOpen();
    diary.noteHeartbeat(30_000);
    diary.noteHeartbeat(45_000);
    diary.noteArrival('light-path');
    diary.noteArrival('light-path');
    diary.noteArrival('memory-hill');
    diary.noteShelfOpen();
    diary.notePick();

    const snap = diary.snapshot();
    const today = snap.days['2026-09-02'];
    expect(today.opens).toBe(1);
    expect(today.ms).toBe(75_000);
    expect(today.arrivals).toBe(3);
    expect(today.zones['light-path']).toBe(2);
    expect(today.zones['memory-hill']).toBe(1);
    expect(today.shelfOpens).toBe(1);
    expect(today.picks).toBe(1);
  });

  it('buckets by the local midnight — a heartbeat past midnight lands tomorrow', () => {
    const storage = fakeStorage();
    let now = NOON;
    const diary = new WorldDiary(storage, () => now);

    diary.noteOpen();
    diary.noteHeartbeat(10_000);
    now = new Date(2026, 8, 3, 0, 0, 1).getTime(); /* just past midnight */
    diary.noteHeartbeat(20_000);

    const snap = diary.snapshot();
    expect(snap.days['2026-09-02'].ms).toBe(10_000);
    expect(snap.days['2026-09-03'].ms).toBe(20_000);
  });

  it('bounds one heartbeat — a sleeping tab cannot invent hours', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);
    diary.noteHeartbeat(6 * 3_600_000);
    expect(diary.snapshot().days['2026-09-02'].ms).toBe(WORLD_DIARY_HEARTBEAT_CAP_MS);
    diary.noteHeartbeat(Number.NaN);
    diary.noteHeartbeat(-5);
    expect(diary.snapshot().days['2026-09-02'].ms).toBe(WORLD_DIARY_HEARTBEAT_CAP_MS);
  });

  it('prunes day buckets beyond the retention window', () => {
    const old = new Date(NOON - (WORLD_DIARY_RETENTION_DAYS + 5) * 86_400_000);
    const oldKey = dayKeyFor(old.getTime());
    const storage = fakeStorage({
      [WORLD_DIARY_KEY]: JSON.stringify({
        v: 1,
        days: {
          [oldKey]: { ms: 99, opens: 9, arrivals: 9, shelfOpens: 9, picks: 9, zones: { x: 9 } },
          '2026-09-01': { ms: 1000, opens: 1, arrivals: 0, shelfOpens: 0, picks: 0, zones: {} },
        },
      }),
    });
    const diary = new WorldDiary(storage, () => NOON);
    const snap = diary.snapshot();
    expect(snap.days[oldKey]).toBeUndefined();
    expect(snap.days['2026-09-01'].ms).toBe(1000);
  });

  it('survives corrupt storage and keeps writing', () => {
    const storage = fakeStorage({ [WORLD_DIARY_KEY]: '{not json at all' });
    const diary = new WorldDiary(storage, () => NOON);
    expect(diary.isEmpty()).toBe(true);
    diary.noteArrival('breath-pool');
    const today = diary.snapshot().days['2026-09-02'];
    expect(today.arrivals).toBe(1);
  });

  it('ignores malformed day keys and zone ids when reading (schema hygiene)', () => {
    const storage = fakeStorage({
      [WORLD_DIARY_KEY]: JSON.stringify({
        v: 1,
        days: {
          'not-a-date': { ms: 5, opens: 1, arrivals: 0, shelfOpens: 0, picks: 0, zones: {} },
          '2026-09-01': {
            ms: 10,
            opens: 1,
            arrivals: 2,
            shelfOpens: 0,
            picks: 0,
            zones: { 'light-path': 2, [`${'x'.repeat(80)}`]: 7 },
          },
        },
      }),
    });
    const snap = new WorldDiary(storage, () => NOON).snapshot();
    expect(snap.days['not-a-date']).toBeUndefined();
    const zones = snap.days['2026-09-01'].zones;
    expect(zones['light-path']).toBe(2);
    expect(Object.keys(zones).length).toBe(1); /* the 80-char blob was dropped */
  });

  it('the persisted schema carries only whitelisted keys — no identifiers, ever', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);
    diary.noteOpen();
    diary.noteHeartbeat(1000);
    diary.noteArrival('light-path');
    diary.noteShelfOpen();
    diary.notePick();

    const raw = JSON.parse(storage.getItem(WORLD_DIARY_KEY)!) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['days', 'v']);
    for (const stat of Object.values(raw.days as Record<string, Record<string, unknown>>)) {
      /* stage 15-C: the whitelisted set grows by gathers + well — still
         counters only, no identifiers, ever */
      expect(Object.keys(stat).sort()).toEqual([
        'arrivals', 'gathers', 'ms', 'opens', 'picks', 'shelfOpens', 'well', 'zones',
      ]);
      for (const zoneKey of Object.keys(stat.zones as Record<string, unknown>)) {
        expect(zoneKey.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('isEmpty distinguishes a silent diary from even a tiny visit', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);
    expect(diary.isEmpty()).toBe(true);
    diary.noteHeartbeat(1);
    expect(diary.isEmpty()).toBe(false);
  });
});

describe('WorldDiary — stage 15-C activities (gathers + well)', () => {
  it('noteGathers counts honest gathers today, ignores garbage', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);
    diary.noteGathers();
    diary.noteGathers(2);
    diary.noteGathers(0);
    diary.noteGathers(-3);
    diary.noteGathers(Number.NaN);
    const today = diary.snapshot().days['2026-09-02'];
    expect(today.gathers).toBe(3);
  });

  it('noteWell counts a purchase a day', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);
    diary.noteWell();
    diary.noteWell();
    const today = diary.snapshot().days['2026-09-02'];
    expect(today.well).toBe(2);
    expect(diary.isEmpty()).toBe(false);
  });

  it('a gathers-only diary is not empty (real activity, honest lens)', () => {
    const storage = fakeStorage();
    const diary = new WorldDiary(storage, () => NOON);
    diary.noteGathers(1);
    expect(diary.isEmpty()).toBe(false);
  });

  it('old saves without the new keys coerce to zeros (schema growth is safe)', () => {
    const storage = fakeStorage({
      [WORLD_DIARY_KEY]: JSON.stringify({
        v: 1,
        days: { '2026-09-01': { ms: 1000, opens: 1, arrivals: 0, shelfOpens: 0, picks: 0, zones: {} } },
      }),
    });
    const snap = new WorldDiary(storage, () => NOON).snapshot();
    expect(snap.days['2026-09-01'].gathers).toBe(0);
    expect(snap.days['2026-09-01'].well).toBe(0);
  });
});
