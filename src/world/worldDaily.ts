/* ============================================================
 * worldDaily — the journey of the day (stage 12).
 *
 * "לא משחק של כמה דקות — משחק של שנים": every local day, three
 * named places across the continent light their beacons — a small
 * honest journey that is NEVER the same twice and NEVER runs out.
 * It is offered, never forced (ETHICS): the child can ignore it
 * completely; the beacons are simply there, like a friend waving.
 *
 * Storage contract (mirrors worldFound / worldDiary):
 *   - localStorage only, key `lenny-world-daily-v1`
 *   - schema: { day: 'YYYY-MM-DD', done: string[] } — ids validated
 *     against WorldLayout.LANDMARKS, no free text, no identifiers
 *
 * Pure + storage/now-injectable (the worldQuests pattern), so the
 * unit tests pin the day rollover and the determinism.
 * ============================================================ */

import { LANDMARKS } from './WorldLayout';

export const WORLD_DAILY_KEY = 'lenny-world-daily-v1';
export const DAILY_TARGETS = 3;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const VALID = new Set<string>(LANDMARKS.map((l) => l.id));

/** Small deterministic hash of the day key — the day's world seed. */
export function dayHash(dayKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dayKey.length; i++) {
    h ^= dayKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The three places of the day: deterministic in the day key, always
 * distinct, spread across the continent (one close, two far when
 * possible — a journey, not a list).
 */
export function dailyTargets(dayKey: string): string[] {
  const h = dayHash(dayKey);
  /* rotation order by hash — LANDMARKS is canonical, the pick is fair */
  const pool = LANDMARKS.map((l) => l.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.imul(h ^ (i * 2654435761), 0x2545f491) >>> 8) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const far = pool.filter((id) => {
    const l = LANDMARKS.find((x) => x.id === id)!;
    return Math.hypot(l.x, l.z) > 100;
  });
  const near = pool.filter((id) => !far.includes(id));
  const out: string[] = [];
  /* one reachable place + two true journeys — every single day */
  if (near.length > 0) out.push(near[h % near.length]);
  const step = Math.max(1, Math.floor(far.length / 2));
  for (let i = 0; i < far.length && out.length < DAILY_TARGETS; i += step) {
    out.push(far[(i + (h >>> 4)) % far.length]);
  }
  for (const id of far) {
    if (out.length >= DAILY_TARGETS) break;
    if (!out.includes(id)) out.push(id);
  }
  for (const id of pool) {
    if (out.length >= DAILY_TARGETS) break;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, DAILY_TARGETS);
}

export interface DailyState {
  day: string;
  done: string[];
}

/** Local-date bucket key — the child's own midnight (mirrors worldQuests). */
export function dailyDayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function coerceDaily(raw: unknown): DailyState {
  if (typeof raw !== 'object' || raw === null) return { day: '', done: [] };
  const r = raw as Record<string, unknown>;
  const day = typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : '';
  const done: string[] = [];
  if (Array.isArray(r.done)) {
    for (const id of r.done) {
      if (typeof id === 'string' && VALID.has(id) && !done.includes(id)) done.push(id);
    }
  }
  return { day, done };
}

export class WorldDaily {
  private storage: StorageLike;
  private now: () => number;

  constructor(storage: StorageLike = localStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  private read(): DailyState {
    try {
      const raw = this.storage.getItem(WORLD_DAILY_KEY);
      if (!raw) return { day: '', done: [] };
      return coerceDaily(JSON.parse(raw) as unknown);
    } catch {
      return { day: '', done: [] }; /* private mode / corrupt — a fresh day */
    }
  }

  private write(state: DailyState): void {
    try {
      this.storage.setItem(WORLD_DAILY_KEY, JSON.stringify(state));
    } catch {
      /* private mode — today's journey still plays, nothing persists */
    }
  }

  /** Today's targets, done-status filtered to THIS day (rollover is free). */
  today(): { targets: string[]; done: string[] } {
    const dayKey = dailyDayKey(this.now());
    const state = this.read();
    if (state.day !== dayKey) {
      /* a new day — yesterday's journey is over, a fresh one begins */
      this.write({ day: dayKey, done: [] });
      return { targets: dailyTargets(dayKey), done: [] };
    }
    const targets = dailyTargets(dayKey);
    return { targets, done: state.done.filter((id) => targets.includes(id)) };
  }

  /** One daily place was visited (idempotent, best effort). */
  markDone(id: string): Array<string> {
    const dayKey = dailyDayKey(this.now());
    const state = this.read();
    if (state.day !== dayKey || !dailyTargets(dayKey).includes(id)) {
      return this.today().done;
    }
    if (!state.done.includes(id)) {
      state.done.push(id);
      this.write(state);
    }
    return state.done;
  }
}
