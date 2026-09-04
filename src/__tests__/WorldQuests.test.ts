import { describe, expect, it, vi } from 'vitest';
import {
  OFFERED_FAMILIES,
  QUEST_FAMILIES,
  QUEST_TIER_MAX,
  WorldQuests,
  buildPatternQuest,
  buildWalkCountQuest,
  coerceQuestData,
  countingCountFor,
  emptyQuestData,
  nextFamily,
  pruneQuestDays,
  questDayKey,
  tierForCompletions,
  WALK_THINGS,
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

describe('worldQuests — the counting walk (stage 15-C)', () => {
  it('the store knows four families; the rotation offers only the rendered three', () => {
    expect(QUEST_FAMILIES).toEqual(['wayfinding', 'counting', 'patterns', 'walk-count']);
    expect(OFFERED_FAMILIES).toEqual(['wayfinding', 'counting', 'patterns']);
    expect(QUEST_FAMILIES).toContain('walk-count');
    /* walk-count never leaks into the rotation before the shell renders it */
    const d = emptyQuestData();
    expect(OFFERED_FAMILIES).not.toContain('walk-count');
    expect(nextFamily(d)).toBe('wayfinding');
  });

  it('walk-count storage is live: corrections, trials, completions and tiers', () => {
    const storage = stubStorage();
    const now = vi.fn(() => BASE);
    const quests = new WorldQuests(storage as unknown as Storage, now as () => number);
    quests.noteCorrection('walk-count');
    quests.noteTrial('walk-count');
    const snap = quests.snapshot();
    expect(snap.families['walk-count']).toEqual({ completions: 0, trials: 1, corrections: 1, tier: 1 });
    quests.complete('walk-count', 2, 1);
    const after = quests.snapshot();
    expect(after.families['walk-count'].completions).toBe(1);
    expect(after.families['walk-count'].tier).toBe(1);
    expect(after.days[questDayKey(BASE)]).toEqual({ completed: 1 });
    expect(after.active).toBeNull();
    expect(quests.isEmpty()).toBe(false);
    /* three completions grow the family's tier, like every family */
    quests.complete('walk-count', 0, 0);
    quests.complete('walk-count', 0, 0);
    quests.complete('walk-count', 0, 0);
    expect(quests.snapshot().families['walk-count'].tier).toBe(2);
  });

  it('coercion keeps a walk-count stat from storage (schema-white, no free text)', () => {
    const d = coerceQuestData({
      families: { 'walk-count': { completions: 4, trials: 3, corrections: 2, tier: 9 } },
    });
    expect(d.families['walk-count']).toEqual({ completions: 4, trials: 3, corrections: 2, tier: QUEST_TIER_MAX });
  });

  it('content: deterministic (tier, seq), honest counts, chips always hold the truth', () => {
    for (let seq = 0; seq < 60; seq++) {
      for (let tier = 1; tier <= 3; tier++) {
        const q = buildWalkCountQuest(tier, seq);
        expect(WALK_THINGS.map((t) => t.id)).toContain(q.thing.id);
        expect(q.thing.name.length).toBeGreaterThan(0);
        expect(q.count).toBeGreaterThanOrEqual(3);
        expect(q.count).toBeLessThanOrEqual(8);
        expect(q.chips).toContain(q.count);
        expect(new Set(q.chips).size).toBe(3);
        for (const c of q.chips) expect(c).toBeGreaterThanOrEqual(1);
      }
    }
    /* tier bands mirror the counting family */
    for (let seq = 0; seq < 40; seq++) {
      expect(buildWalkCountQuest(1, seq).count).toBeLessThanOrEqual(4);
      const c2 = buildWalkCountQuest(2, seq).count;
      expect(c2).toBeGreaterThanOrEqual(4);
      expect(c2).toBeLessThanOrEqual(6);
    }
    /* same seq, same quest, every device */
    expect(buildWalkCountQuest(2, 17)).toEqual(buildWalkCountQuest(2, 17));
    /* the true chip is not always in the middle — the row is shuffled */
    const positions = new Set<number>();
    for (let seq = 0; seq < 50; seq++) {
      positions.add(buildWalkCountQuest(1, seq).chips.indexOf(buildWalkCountQuest(1, seq).count));
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});
