/* ============================================================
 * worldDiary — a local, identifier-free diary of the child's
 * time inside the 3D garden (stage 8).
 *
 * Why: ParentLens (stage 5) reads game data only. The world is
 * now the garden's default, yet a parent sees nothing of it.
 * The diary closes that gap the same way everything else does:
 * local-only storage, no identifiers, no scores, no verdicts —
 * just honest counts the parent's lens can read.
 *
 * What is recorded (and nothing more):
 *   - ms          accumulated time inside the world
 *   - opens       how many times the world was opened
 *   - arrivals    island arrivals (proximity)
 *   - shelfOpens  shelf slide-ins on open zones
 *   - picks       games opened from the world shelf
 *   - zones       arrivals per zone id
 *   - gathers     (stage 15-C) collectibles gathered that day —
 *                 sparkles, acorns, crystals (one call per gather;
 *                 the writer is the gather site in the shell)
 *   - well        (stage 15-C) purchases at the garden well
 *
 * Privacy contract (mirrors ETHICS.md):
 *   - localStorage only, key `lenny-world-diary-v1`
 *   - day buckets keyed by local date (YYYY-MM-DD), pruned to
 *     the last 30 days — a rolling window, never an archive
 *   - the schema holds ONLY the whitelisted keys above — no
 *     free text, no names, no timestamps beyond the day grain
 *
 * Pure + storage/now-injectable (the worldMode.ts pattern) so
 * the unit tests can pin every path, including midnight.
 * ============================================================ */

export const WORLD_DIARY_KEY = 'lenny-world-diary-v1';
export const WORLD_DIARY_RETENTION_DAYS = 30;

/** Bound one heartbeat so a sleeping tab never invents hours. */
export const WORLD_DIARY_HEARTBEAT_CAP_MS = 10 * 60_000;

export interface WorldDayStat {
  ms: number;
  opens: number;
  arrivals: number;
  shelfOpens: number;
  picks: number;
  zones: Record<string, number>;
  /** collectibles gathered today (sparkles + acorns + crystals) */
  gathers: number;
  /** purchases at the garden well today */
  well: number;
}

export interface WorldDiaryData {
  v: 1;
  days: Record<string, WorldDayStat>;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Local-date bucket key — the child's own midnight, not UTC's. */
export function dayKeyFor(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyStat(): WorldDayStat {
  return { ms: 0, opens: 0, arrivals: 0, shelfOpens: 0, picks: 0, zones: {}, gathers: 0, well: 0 };
}

/* ---------- defensive reads: storage is the child's device, treat it kindly ---------- */

function coerceStat(raw: unknown): WorldDayStat {
  const out = emptyStat();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  out.ms = num(r.ms);
  out.opens = num(r.opens);
  out.arrivals = num(r.arrivals);
  out.shelfOpens = num(r.shelfOpens);
  out.picks = num(r.picks);
  out.gathers = num(r.gathers);
  out.well = num(r.well);
  if (typeof r.zones === 'object' && r.zones !== null) {
    for (const [zone, count] of Object.entries(r.zones as Record<string, unknown>)) {
      /* zone ids are short internal keys — anything longer is not ours */
      if (typeof zone === 'string' && zone.length <= 40) {
        const c = num(count);
        if (c > 0) out.zones[zone] = c;
      }
    }
  }
  return out;
}

function coerceDiary(raw: unknown): WorldDiaryData {
  const out: WorldDiaryData = { v: 1, days: {} };
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.days !== 'object' || r.days === null) return out;
  for (const [key, stat] of Object.entries(r.days as Record<string, unknown>)) {
    /* keys must look like local dates — anything else is not ours */
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) out.days[key] = coerceStat(stat);
  }
  return out;
}

function pruneDays(data: WorldDiaryData, cutoffKey: string): WorldDiaryData {
  const days: Record<string, WorldDayStat> = {};
  for (const [key, stat] of Object.entries(data.days)) {
    if (key >= cutoffKey) days[key] = stat; /* ISO day keys sort lexicographically */
  }
  return { v: 1, days };
}

export class WorldDiary {
  private storage: StorageLike;
  private now: () => number;

  constructor(storage: StorageLike = localStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  private read(): WorldDiaryData {
    try {
      const raw = this.storage.getItem(WORLD_DIARY_KEY);
      if (!raw) return { v: 1, days: {} };
      return pruneDays(coerceDiary(JSON.parse(raw) as unknown), dayKeyFor(this.now() - WORLD_DIARY_RETENTION_DAYS * 86_400_000));
    } catch {
      return { v: 1, days: {} }; /* private mode / corrupt — the diary starts clean */
    }
  }

  private write(mutate: (today: WorldDayStat, key: string) => void): void {
    try {
      const data = this.read();
      const key = dayKeyFor(this.now());
      const today = data.days[key] ?? emptyStat();
      mutate(today, key);
      data.days[key] = today;
      this.storage.setItem(WORLD_DIARY_KEY, JSON.stringify(pruneDays(data, dayKeyFor(this.now() - WORLD_DIARY_RETENTION_DAYS * 86_400_000))));
    } catch {
      /* private mode / quota — the garden keeps playing either way */
    }
  }

  /** The world was opened (a fresh boot or a return). */
  noteOpen(): void {
    this.write((today) => {
      today.opens += 1;
    });
  }

  /** Add real elapsed ms inside the world (the shell's heartbeat). */
  noteHeartbeat(ms: number): void {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return;
    const bounded = Math.min(ms, WORLD_DIARY_HEARTBEAT_CAP_MS);
    this.write((today) => {
      today.ms += bounded;
    });
  }

  /** The presence arrived at an island. */
  noteArrival(zone: string): void {
    if (typeof zone !== 'string' || zone.length === 0 || zone.length > 40) return;
    this.write((today) => {
      today.arrivals += 1;
      today.zones[zone] = (today.zones[zone] ?? 0) + 1;
    });
  }

  /** The game shelf slid in over an open zone. */
  noteShelfOpen(): void {
    this.write((today) => {
      today.shelfOpens += 1;
    });
  }

  /** A game was picked from the world shelf. */
  notePick(): void {
    this.write((today) => {
      today.picks += 1;
    });
  }

  /** One collectible was gathered (sparkle / acorn / crystal) — the
   *  shell's gather site calls this beside its ledger write. */
  noteGathers(n: number = 1): void {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return;
    this.write((today) => {
      today.gathers += Math.floor(n);
    });
  }

  /** A purchase was made at the garden well. */
  noteWell(): void {
    this.write((today) => {
      today.well += 1;
    });
  }

  /** Read-only view, pruned to the retention window. */
  snapshot(): WorldDiaryData {
    return this.read();
  }

  /** True when nothing was ever recorded (the lens shows a soft line). */
  isEmpty(): boolean {
    const data = this.snapshot();
    for (const stat of Object.values(data.days)) {
      if (
        stat.ms > 0 ||
        stat.opens > 0 ||
        stat.arrivals > 0 ||
        stat.shelfOpens > 0 ||
        stat.picks > 0 ||
        stat.gathers > 0 ||
        stat.well > 0
      )
        return false;
    }
    return true;
  }
}
