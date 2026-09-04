/* ============================================================
 * worldQuests — discovery quests: the roaming becomes learning.
 * (critic round B, W2 + W3)
 *
 * WHY: the world had one verb ("walk there") and zero provable
 * cognition — the diary records attendance, not development.
 * Discovery quests turn wandering into three REAL cognitive skills
 * (GDD categories, no new invented ones):
 *
 *   wayfinding — "let's walk to the big tree": landmark knowledge,
 *                spatial mapping, route planning (spatial).
 *   counting   — tap-count the bloomed flowers one by one, then say
 *                HOW MANY (cardinality, not just reciting).
 *   patterns   — which color stone continues the sequence?
 *                AB → AAB → ABC by tier (seriation / logic).
 *   walk-count — (stage 15-C) count the world's OWN things on the
 *                way — butterflies, clouds, stones — and answer via
 *                number chips (cardinality on a real walk). Offered
 *                when the shell renders its chips branch; storage,
 *                rotation and content are live (OFFERED_FAMILIES).
 *
 * ETHICS + storage contract (mirrors worldDiary):
 *   - localStorage only, key `lenny-world-quests-v1`
 *   - whitelisted coerced schema; counters only, no free text,
 *     no identifiers, day-grain buckets pruned to 30 days
 *   - NO lights, NO unlocks, NO ProgressStore touch — quest
 *     rewards are their own honest badge counter, never inflating
 *     the games' economy or the parent's charts
 *   - quests are offered, never forced; ignoring one is free
 *   - failure-free: a wrong pick re-asks softly (a "correction"),
 *     nothing is ever called wrong
 *
 * Pure + storage/now-injectable (the worldDiary pattern) so the
 * unit tests pin every path, including midnight.
 * ============================================================ */

export const WORLD_QUESTS_KEY = 'lenny-world-quests-v1';
export const QUEST_RETENTION_DAYS = 30;

/**
 * Every quest family the STORE knows (storage schema + coercion + stats).
 * stage 15-C adds the fourth: the counting walk — the child counts the
 * world's own things on the way (butterflies, clouds...) and answers via
 * number chips. See OFFERED_FAMILIES for the rotation contract.
 */
export const QUEST_FAMILIES = ['wayfinding', 'counting', 'patterns', 'walk-count'] as const;
export type QuestFamily = (typeof QUEST_FAMILIES)[number];

/**
 * The families the world shell RENDERS today (WorldScreen's startQuest
 * branches). The rotation offers ONLY rendered families — a quest is
 * never offered that the child cannot see. When the shell grows its
 * small walk-count branch (chips-only: setQuestPanel + onCountChip),
 * 'walk-count' joins this list and the engine needs nothing else —
 * storage, tiers and content are live already.
 */
export const OFFERED_FAMILIES: readonly QuestFamily[] = ['wayfinding', 'counting', 'patterns'];

export const QUEST_TIER_MAX = 3;

export interface FamilyStat {
  completions: number;
  /** extra tries a quest took (arrived elsewhere first / corrected picks) */
  trials: number;
  corrections: number;
  tier: number;
}

export interface ActiveQuest {
  family: QuestFamily;
  tier: number;
  /** monotonic offer counter — the seed of every content generator */
  seq: number;
}

export interface QuestDayStat {
  completed: number;
}

export interface WorldQuestData {
  v: 2;
  families: Record<QuestFamily, FamilyStat>;
  active: ActiveQuest | null;
  /** monotonic offer counter — the seed of every content generator */
  lastSeq: number;
  days: Record<string, QuestDayStat>;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function emptyFamilyStat(): FamilyStat {
  return { completions: 0, trials: 0, corrections: 0, tier: 1 };
}

export function emptyQuestData(): WorldQuestData {
  const families = {} as Record<QuestFamily, FamilyStat>;
  for (const f of QUEST_FAMILIES) families[f] = emptyFamilyStat();
  return { v: 2, families, active: null, lastSeq: 0, days: {} };
}

/** Tier grows with every 3rd completion of the family, capped. */
export function tierForCompletions(completions: number): number {
  return Math.max(1, Math.min(QUEST_TIER_MAX, 1 + Math.floor(Math.max(0, completions) / 3)));
}

/* ---------- defensive reads: storage is the child's device ---------- */

function coerceStat(raw: unknown): FamilyStat {
  const base = emptyFamilyStat();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    completions: num(r.completions),
    trials: num(r.trials),
    corrections: num(r.corrections),
    tier: Math.max(1, Math.min(QUEST_TIER_MAX, num(r.tier) || 1)),
  };
}

export function coerceQuestData(raw: unknown): WorldQuestData {
  const out = emptyQuestData();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.families === 'object' && r.families !== null) {
    const fam = r.families as Record<string, unknown>;
    for (const f of QUEST_FAMILIES) {
      if (typeof fam[f] === 'object' && fam[f] !== null) out.families[f] = coerceStat(fam[f]);
    }
  }
  if (typeof r.active === 'object' && r.active !== null) {
    const a = r.active as Record<string, unknown>;
    const family = QUEST_FAMILIES.find((f) => f === a.family);
    if (family) {
      const tier = typeof a.tier === 'number' && Number.isFinite(a.tier) ? Math.max(1, Math.min(QUEST_TIER_MAX, Math.floor(a.tier))) : 1;
      const seq = typeof a.seq === 'number' && Number.isFinite(a.seq) && a.seq >= 0 ? Math.floor(a.seq) : 0;
      out.active = { family, tier, seq };
    }
  }
  if (typeof r.lastSeq === 'number' && Number.isFinite(r.lastSeq) && r.lastSeq >= 0) {
    out.lastSeq = Math.floor(r.lastSeq);
  }
  if (typeof r.days === 'object' && r.days !== null) {
    for (const [key, stat] of Object.entries(r.days as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const s = (stat ?? {}) as Record<string, unknown>;
      const completed = typeof s.completed === 'number' && Number.isFinite(s.completed) && s.completed >= 0 ? Math.floor(s.completed) : 0;
      if (completed > 0) out.days[key] = { completed };
    }
  }
  return out;
}

/** ISO day keys sort lexicographically — prune is a single compare. */
export function pruneQuestDays(data: WorldQuestData, cutoffKey: string): WorldQuestData {
  const days: Record<string, QuestDayStat> = {};
  for (const [key, stat] of Object.entries(data.days)) {
    if (key >= cutoffKey) days[key] = stat;
  }
  return { ...data, days };
}

/** Local-date bucket key — the child's own midnight, not UTC's. */
export function questDayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ---------- rotation + content (pure, deterministic) ---------- */

/**
 * The next family to offer: fewest completions wins; ties follow the
 * canonical order. Every RENDERED family gets its turn — no starving
 * one skill (see OFFERED_FAMILIES for the rotation contract).
 */
export function nextFamily(data: WorldQuestData): QuestFamily {
  let best: QuestFamily = OFFERED_FAMILIES[0];
  for (const f of OFFERED_FAMILIES) {
    if (data.families[f].completions < data.families[best].completions) best = f;
  }
  return best;
}

/** Small deterministic hash — same seq, same quest, every device. */
export function questHash(seq: number, salt: number): number {
  let h = (Math.max(0, Math.floor(seq)) * 2654435761 + salt * 97 + 101) >>> 0;
  h = (h ^ (h >>> 13)) * 0x5bd1e995;
  h = (h ^ (h >>> 15)) >>> 0;
  return h;
}

/** The counting quest's flower count by tier (3..8, age-honest). */
export function countingCountFor(tier: number, seq: number): number {
  const t = Math.max(1, Math.min(QUEST_TIER_MAX, tier));
  const lo = [3, 4, 6][t - 1];
  const span = [2, 3, 3][t - 1];
  return lo + (questHash(seq, 7) % span);
}

/* ---------- walk-count content (pure, stage 15-C) ---------- */

/**
 * The things a child can honestly COUNT on the way in this world —
 * the meadow blooms, butterflies loop, birds land, clouds drift,
 * stones line the road. Names are everyday Hebrew (niqqud).
 */
export const WALK_THINGS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'flowers', name: 'פְּרָחִים' },
  { id: 'butterflies', name: 'פַּרְפָּרִים' },
  { id: 'birds', name: 'צִפּוֹרִים' },
  { id: 'clouds', name: 'עָנָנִים' },
  { id: 'stones', name: 'אֲבָנִים' },
];

export interface WalkCountQuest {
  /** what to count (a WALK_THINGS entry) */
  thing: { id: string; name: string };
  /** the honest answer (3..8 — never above the attention span) */
  count: number;
  /** the answer chips: the truth with its two neighbors, shuffled */
  chips: number[];
}

/**
 * A deterministic walk-count quest for (tier, seq): the thing, the
 * count, and the chip row. Same inputs, same quest, every device —
 * the buildPatternQuest discipline.
 */
export function buildWalkCountQuest(tier: number, seq: number): WalkCountQuest {
  const t = Math.max(1, Math.min(QUEST_TIER_MAX, tier));
  const lo = [3, 4, 6][t - 1];
  const span = [2, 3, 3][t - 1];
  const count = lo + (questHash(seq, 13) % span);
  const thing = WALK_THINGS[questHash(seq, 29) % WALK_THINGS.length];
  const chips = [Math.max(1, count - 1), count, count + 1];
  /* a deterministic shuffle: the true chip is not always the middle one */
  const r = questHash(seq, 17);
  const swap = (i: number, j: number): void => {
    [chips[i], chips[j]] = [chips[j], chips[i]];
  };
  swap(0, r % 3);
  swap(1, (r >>> 3) % 3);
  return { thing, count, chips };
}

/* ---------- pattern content (pure) ---------- */

/** The stone colors — same hexes the world paints them with. */
export const PATTERN_COLORS = ['gold', 'rose', 'teal'] as const;
export type PatternColor = (typeof PATTERN_COLORS)[number];

export interface PatternQuest {
  /** the shown stones in order; `null` = the gap the child fills */
  stones: Array<PatternColor | null>;
  options: PatternColor[];
  answer: PatternColor;
}

/**
 * Build a pattern quest. Tier 1: AB unit, gap at the end.
 * Tier 2: AAB unit, gap at the end. Tier 3: ABC unit shown twice
 * with the gap mid-sequence — the child must read BOTH sides.
 */
export function buildPatternQuest(tier: number, seq: number): PatternQuest {
  const t = Math.max(1, Math.min(QUEST_TIER_MAX, tier));
  const h = questHash(seq, 11);
  const pick = <T,>(arr: readonly T[], salt: number): T => arr[questHash(h, salt) % arr.length];

  if (t === 1) {
    const a = pick(PATTERN_COLORS, 1);
    const b = pick(PATTERN_COLORS.filter((c) => c !== a), 2);
    const answer = a; /* AB AB AB A[B] */
    return { stones: [a, b, a, b, a, null], options: [a, b], answer };
  }
  if (t === 2) {
    const a = pick(PATTERN_COLORS, 3);
    const b = pick(PATTERN_COLORS.filter((c) => c !== a), 4);
    const answer = b; /* AAB AAB A[AB] */
    return { stones: [a, a, b, a, a, b, a, null], options: [a, b], answer };
  }
  const a = pick(PATTERN_COLORS, 5);
  const rest = PATTERN_COLORS.filter((c) => c !== a);
  const b = pick(rest, 6);
  const c = rest.find((x) => x !== b)!;
  /* ABC ABC with the C missing mid-way: child reads both sides */
  return { stones: [a, b, null, a, b, c], options: [...PATTERN_COLORS], answer: c };
}

/* ---------- the store (thin, injectable) ---------- */

export class WorldQuests {
  private storage: StorageLike;
  private now: () => number;

  constructor(storage: StorageLike = localStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  private read(): WorldQuestData {
    try {
      const raw = this.storage.getItem(WORLD_QUESTS_KEY);
      if (!raw) return emptyQuestData();
      return pruneQuestDays(coerceQuestData(JSON.parse(raw) as unknown), questDayKey(this.now() - QUEST_RETENTION_DAYS * 86_400_000));
    } catch {
      return emptyQuestData(); /* private mode / corrupt — quests start clean */
    }
  }

  private write(data: WorldQuestData): void {
    try {
      this.storage.setItem(WORLD_QUESTS_KEY, JSON.stringify(pruneQuestDays(data, questDayKey(this.now() - QUEST_RETENTION_DAYS * 86_400_000))));
    } catch {
      /* private mode / quota — the garden keeps playing either way */
    }
  }

  /** The quest currently offered, if any. */
  current(): ActiveQuest | null {
    return this.read().active;
  }

  /** Offer the next quest (rotation + tier); replaces any active one. */
  offerNext(): ActiveQuest {
    const data = this.read();
    const family = nextFamily(data);
    const tier = tierForCompletions(data.families[family].completions);
    const quest: ActiveQuest = { family, tier, seq: data.lastSeq + 1 };
    data.lastSeq = quest.seq;
    data.active = quest;
    this.write(data);
    return quest;
  }

  /** A correction happened mid-quest — persisted immediately (honest). */
  noteCorrection(family: QuestFamily): void {
    if (!QUEST_FAMILIES.includes(family)) return;
    const data = this.read();
    data.families[family].corrections += 1;
    this.write(data);
  }

  /** An extra trial happened mid-quest (wrong place arrived at). */
  noteTrial(family: QuestFamily): void {
    if (!QUEST_FAMILIES.includes(family)) return;
    const data = this.read();
    data.families[family].trials += 1;
    this.write(data);
  }

  /** A quest was completed (any trials/corrections it took — honest). */
  complete(family: QuestFamily, trials: number, corrections: number): void {
    if (!QUEST_FAMILIES.includes(family)) return;
    const data = this.read();
    const stat = data.families[family];
    stat.completions += 1;
    stat.trials += Math.max(0, Math.floor(trials));
    stat.corrections += Math.max(0, Math.floor(corrections));
    stat.tier = tierForCompletions(stat.completions);
    const key = questDayKey(this.now());
    const day = data.days[key] ?? { completed: 0 };
    day.completed += 1;
    data.days[key] = day;
    data.active = null; /* celebrated; the shell offers the next one */
    this.write(data);
  }

  /** Read-only view, pruned to the retention window. */
  snapshot(): WorldQuestData {
    return this.read();
  }

  isEmpty(): boolean {
    const data = this.snapshot();
    for (const f of QUEST_FAMILIES) {
      const s = data.families[f];
      if (s.completions > 0 || s.trials > 0 || s.corrections > 0) return false;
    }
    for (const day of Object.values(data.days)) {
      if (day.completed > 0) return false;
    }
    return true;
  }
}
