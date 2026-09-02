import { describe, expect, it } from 'vitest';
import { worldLensFromDiary } from '../ui/parentlens/lensData';
import { dayKeyFor, type WorldDiaryData } from '../world/worldDiary';

/* Local-noon pin — the 7-day window never wobbles around midnight. */
const NOW = new Date(2026, 8, 2, 12, 0, 0).getTime(); /* 2026-09-02 local noon */

function stat(over: Partial<WorldDiaryData['days'][string]> = {}): WorldDiaryData['days'][string] {
  return { ms: 0, opens: 0, arrivals: 0, shelfOpens: 0, picks: 0, zones: {}, ...over };
}

function diaryWith(days: Record<string, WorldDiaryData['days'][string]>): WorldDiaryData {
  return { v: 1, days };
}

describe('worldLensFromDiary', () => {
  it('aggregates only the 7-day window — older buckets stay out of the picture', () => {
    const data = diaryWith({
      [dayKeyFor(NOW)]: stat({ ms: 90_000, opens: 2, arrivals: 3, picks: 1, zones: { 'light-path': 3 } }),
      [dayKeyFor(NOW - 6 * 86_400_000)]: stat({ ms: 60_000, opens: 1, arrivals: 1, zones: { 'memory-hill': 1 } }),
      [dayKeyFor(NOW - 8 * 86_400_000)]: stat({ ms: 3_600_000, opens: 9, arrivals: 9, zones: { 'light-path': 9 } }),
    });
    const lens = worldLensFromDiary(data, NOW);
    expect(lens.opens7d).toBe(3);
    expect(lens.arrivals7d).toBe(4);
    expect(lens.picks7d).toBe(1);
    expect(lens.zones['light-path']).toBe(3); /* the 8-day-old 9 arrivals are out */
    expect(lens.zones['memory-hill']).toBe(1);
  });

  it('rounds minutes honestly — day-grain data, no invented precision', () => {
    const data = diaryWith({ [dayKeyFor(NOW)]: stat({ ms: 90_000 }) });
    expect(worldLensFromDiary(data, NOW).minutes7d).toBe(2); /* 1.5 → 2 */
    const tiny = diaryWith({ [dayKeyFor(NOW)]: stat({ ms: 20_000 }) });
    expect(worldLensFromDiary(tiny, NOW).minutes7d).toBe(0);
  });

  it('hasData reflects any real signal; a silent diary stays silent', () => {
    expect(worldLensFromDiary(diaryWith({}), NOW).hasData).toBe(false);
    expect(worldLensFromDiary(diaryWith({ [dayKeyFor(NOW)]: stat({ opens: 1 }) }), NOW).hasData).toBe(true);
    expect(worldLensFromDiary(diaryWith({ [dayKeyFor(NOW)]: stat({ ms: 30_000 }) }), NOW).hasData).toBe(true);
  });

  it('merges per-zone counts across days', () => {
    const data = diaryWith({
      [dayKeyFor(NOW)]: stat({ zones: { 'light-path': 2 } }),
      [dayKeyFor(NOW - 2 * 86_400_000)]: stat({ zones: { 'light-path': 1, 'breath-pool': 4 } }),
    });
    const lens = worldLensFromDiary(data, NOW);
    expect(lens.zones['light-path']).toBe(3);
    expect(lens.zones['breath-pool']).toBe(4);
  });
});
