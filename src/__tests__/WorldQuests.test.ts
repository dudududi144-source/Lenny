import { describe, expect, it, vi } from 'vitest';
import {
  QUEST_FAMILIES,
  QUEST_TIER_MAX,
  WorldQuests,
  buildPatternQuest,
  coerceQuestData,
  countingCountFor,
  emptyQuestData,
  nextFamily,
  pruneQuestDays,
  questDayKey,
  tierForCompletions,
  type WorldQuestData,
} from '../world/worldQuests';

/* storage stub — the worldDiary test pattern */
function stubStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  dump: () => Record<string, string>;
} {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

const DAY = 86_400_000;
const BASE = new Date(2026, 8, 10, 15, 0, 0).getTime(); /* a local afternoon */

describe('worldQuests — the honest schema (critic W3)', () => {
  it('empty data has every family at tier 1 and nothing active', () => {
    const d = emptyQuestData();
    expect(d.v).toBe(2);
    for (const f of QUEST_FAMILIES) {
      expect(d.families[f]).toEqual({ completions: 0, trials: 0, corrections: 0, tier: 1 });
    }
    expect(d.active).toBeNull();
    expect(d.days).toEqual({});
  });

  it('coercion keeps only whitelisted keys and sane numbers', () => {
    const hostile = {
      v: 99,
      families: {
        counting: { completions: 2.7, trials: -5, corrections: 'x', tier: 99, hacked: true },
        intruder: { completions: 100 },
      },
      active: { family: 'nope', tier: 12 },
      days: { '2026-09-10': { completed: 3 }, 'garbage': { completed: 9 } },
      freeText: 'nope',
    };
    const d = coerceQuestData(hostile);
    expect(d.families.counting).toEqual({ completions: 2, trials: 0, corrections: 0, tier: QUEST_TIER_MAX });
    expect((d.families as Record<string, unknown>)['intruder']).toBeUndefined();
    expect(d.active).toBeNull();
    expect(d.days).toEqual({ '2026-09-10': { completed: 3 } });
    expect((d as unknown as Record<string, unknown>)['freeText']).toBeUndefined();
  });

  it('completions drive tiers and cap at 3', () => {
    expect(tierForCompletions(0)).toBe(1);
    expect(tierForCompletions(3)).toBe(2);
    expect(tierForCompletions(6)).toBe(3);
    expect(tierForCompletions(50)).toBe(3);
  });

  it('rotation: the family with the fewest completions is offered next', () => {
    const d = emptyQuestData();
    d.families.counting.completions = 5;
    d.families.patterns.completions = 2;
    expect(nextFamily(d)).toBe('wayfinding');
    d.families.wayfinding.completions = 1;
    expect(nextFamily(d)).toBe('wayfinding'); /* still the fewest */
    d.families.wayfinding.completions = 2; /* tie with patterns → canonical order */
    expect(nextFamily(d)).toBe('wayfinding');
    d.families.wayfinding.completions = 3;
    expect(nextFamily(d)).toBe('patterns');
    d.families.patterns.completions = 4;
    expect(nextFamily(d)).toBe('wayfinding');
  });
});

describe('worldQuests — the store', () => {
  it('offerNext rotates, seeds, and persists; complete clears and counts', () => {
    const storage = stubStorage();
    const now = vi.fn(() => BASE);
    const quests = new WorldQuests(storage as unknown as Storage, now as () => number);

    const q1 = quests.offerNext();
    expect(QUEST_FAMILIES).toContain(q1.family);
    expect(q1.seq).toBe(1);
    expect(quests.current()).toEqual(q1);

    quests.complete(q1.family, 1, 2);
    expect(quests.current()).toBeNull();
    expect(quests.isEmpty()).toBe(false);
    const snap = quests.snapshot();
    expect(snap.families[q1.family].completions).toBe(1);
    expect(snap.families[q1.family].trials).toBe(1);
    expect(snap.families[q1.family].corrections).toBe(2);
    expect(snap.days[questDayKey(BASE)]).toEqual({ completed: 1 });

    /* the next offer is a DIFFERENT family and a later seq */
    const q2 = quests.offerNext();
    expect(q2.family).not.toBe(q1.family);
    expect(q2.seq).toBe(2);
  });

  it('prunes day buckets beyond the retention window (incl. midnight)', () => {
    const storage = stubStorage();
    let now = BASE;
    const quests = new WorldQuests(storage as unknown as Storage, () => now);
    quests.offerNext();
    quests.complete('counting', 0, 0);
    now = BASE + 31 * DAY;
    quests.offerNext();
    const snap = quests.snapshot();
    expect(snap.days[questDayKey(BASE)]).toBeUndefined();
  });

  it('corrupt storage starts clean and never throws', () => {
    const storage = stubStorage();
    storage.setItem('lenny-world-quests-v1', '{not json');
    const quests = new WorldQuests(storage as unknown as Storage);
    expect(quests.current()).toBeNull();
    expect(quests.isEmpty()).toBe(true);
    expect(() => quests.offerNext()).not.toThrow();
  });
});

describe('worldQuests — deterministic content (critic W2)', () => {
  it('counting counts stay in the age-honest band per tier', () => {
    for (let seq = 0; seq < 40; seq++) {
      expect(countingCountFor(1, seq)).toBeGreaterThanOrEqual(3);
      expect(countingCountFor(1, seq)).toBeLessThanOrEqual(4);
      expect(countingCountFor(2, seq)).toBeGreaterThanOrEqual(4);
      expect(countingCountFor(2, seq)).toBeLessThanOrEqual(6);
      expect(countingCountFor(3, seq)).toBeGreaterThanOrEqual(6);
      expect(countingCountFor(3, seq)).toBeLessThanOrEqual(8);
    }
  });

  it('pattern quests always contain exactly one gap with a valid answer among options', () => {
    for (let seq = 0; seq < 60; seq++) {
      for (let tier = 1; tier <= 3; tier++) {
        const pq = buildPatternQuest(tier, seq);
        const gaps = pq.stones.filter((s) => s === null).length;
        expect(gaps).toBe(1);
        expect(pq.options).toContain(pq.answer);
        expect(pq.options.length).toBeGreaterThanOrEqual(2);
        expect(pq.stones.filter((s) => s !== null).length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('pattern units grow in complexity by tier (AB → AAB → ABC)', () => {
    for (let seq = 0; seq < 30; seq++) {
      const t1 = buildPatternQuest(1, seq);
      const t2 = buildPatternQuest(2, seq);
      const t3 = buildPatternQuest(3, seq);
      /* tier 1: two colors; tier 2: two colors in AAB; tier 3: three colors */
      expect(new Set(t1.stones.filter(Boolean)).size).toBe(2);
      expect(new Set(t2.stones.filter(Boolean)).size).toBe(2);
      expect(new Set(t3.stones.filter(Boolean)).size).toBe(3);
      expect(t3.options.length).toBe(3);
    }
  });

  it('the same seq always builds the same quest, on any device', () => {
    const a = buildPatternQuest(2, 17);
    const b = buildPatternQuest(2, 17);
    expect(a).toEqual(b);
  });
});

describe('pruneQuestDays — lexicographic day pruning', () => {
  it('keeps only days at or after the cutoff', () => {
    const data: WorldQuestData = {
      v: 2,
      families: emptyQuestData().families,
      active: null,
      lastSeq: 0,
      days: {
        '2026-08-01': { completed: 1 },
        '2026-09-09': { completed: 2 },
        '2026-09-10': { completed: 3 },
      },
    };
    const pruned = pruneQuestDays(data, '2026-09-09');
    expect(Object.keys(pruned.days).sort()).toEqual(['2026-09-09', '2026-09-10']);
  });
});
