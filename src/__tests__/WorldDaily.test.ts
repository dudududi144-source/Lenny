import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  WorldDaily,
  WORLD_DAILY_KEY,
  coerceDaily,
  dailyDayKey,
  dailyTargets,
  dayHash,
} from '../world/worldDaily';
import { LANDMARKS } from '../world/WorldLayout';

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

describe('worldDaily — the journey of the day (stage 12)', () => {
  it('offers exactly three distinct places, every day anew', () => {
    const a = dailyTargets('2026-09-01');
    const b = dailyTargets('2026-09-02');
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(b).toHaveLength(3);
    expect(a).not.toEqual(b); /* a different day, a different journey */
  });

  it('is deterministic — the same day, the same three places, on every device', () => {
    expect(dailyTargets('2026-09-03')).toEqual(dailyTargets('2026-09-03'));
    expect(dayHash('2026-09-03')).toBe(dayHash('2026-09-03'));
  });

  it('every target is a real landmark id', () => {
    const valid = new Set<string>(LANDMARKS.map((l) => l.id));
    for (const day of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      for (const id of dailyTargets(day)) expect(valid.has(id)).toBe(true);
    }
  });

  it('the day always includes one reachable place near the hub', () => {
    for (const day of ['2026-02-01', '2026-03-14', '2026-07-04', '2026-11-20']) {
      const targets = dailyTargets(day).map((id) => LANDMARKS.find((l) => l.id === id)!);
      expect(targets.some((l) => Math.hypot(l.x, l.z) < 100)).toBe(true);
    }
  });

  it('rolls over at local midnight — yesterday is gone, today is fresh', () => {
    const storage = memoryStorage();
    let now = new Date('2026-09-01T10:00:00').getTime();
    const daily = new WorldDaily(storage, () => now);
    const first = daily.today();
    expect(first.done).toEqual([]);
    daily.markDone(first.targets[0]);
    expect(daily.today().done).toEqual([first.targets[0]]);
    /* the next day */
    now = new Date('2026-09-02T09:00:00').getTime();
    const second = daily.today();
    expect(second.targets).toEqual(dailyTargets('2026-09-02'));
    expect(second.done).toEqual([]);
  });

  it('markDone ignores ids that are not today\'s targets', () => {
    const storage = memoryStorage();
    const now = new Date('2026-09-01T10:00:00').getTime();
    const daily = new WorldDaily(storage, () => now);
    const targets = daily.today().targets;
    const outsider = LANDMARKS.map((l) => l.id).find((id) => !targets.includes(id))!;
    daily.markDone(outsider);
    expect(daily.today().done).toEqual([]);
    daily.markDone(targets[0]);
    expect(daily.today().done).toEqual([targets[0]]);
    daily.markDone(targets[0]); /* idempotent */
    expect(daily.today().done).toEqual([targets[0]]);
  });

  it('coerceDaily is hostile to garbage but keeps valid ids', () => {
    expect(coerceDaily(null)).toEqual({ day: '', done: [] });
    expect(coerceDaily({ day: 'nope', done: ['nope'] })).toEqual({ day: '', done: [] });
    const valid = LANDMARKS[0].id;
    const state = coerceDaily({ day: '2026-09-01', done: [valid, valid, 'bogus', 42] });
    expect(state.day).toBe('2026-09-01');
    expect(state.done).toEqual([valid]);
  });

  it('survives a corrupt store and private mode silently', () => {
    const storage = memoryStorage();
    storage.setItem(WORLD_DAILY_KEY, '{not json');
    const daily = new WorldDaily(storage, () => new Date('2026-09-01T10:00:00').getTime());
    expect(daily.today().targets).toHaveLength(3);
    const throwing = {
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    const daily2 = new WorldDaily(throwing);
    expect(daily2.today().targets).toHaveLength(3);
  });

  it('dailyDayKey uses the child\'s local midnight', () => {
    expect(dailyDayKey(new Date(2026, 8, 3, 23, 59).getTime())).toBe('2026-09-03');
    expect(dailyDayKey(new Date(2026, 8, 4, 0, 1).getTime())).toBe('2026-09-04');
  });
});

describe('vi-free: the daily journey is offered, never forced', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('targets exist whether or not the child ever marks one done', () => {
    const daily = new WorldDaily(memoryStorage(), () => new Date('2026-09-01T10:00:00').getTime());
    const { targets, done } = daily.today();
    expect(targets).toHaveLength(3);
    expect(done).toEqual([]);
  });
});
