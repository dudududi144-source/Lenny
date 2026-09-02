/* ============================================================
   lensData — read-only aggregation for the ParentLens.

   Everything here READS the untouched cognitive core stores
   (ProgressStore / PlayerModel / LearningSignals / SkillGraph)
   plus the documented localStorage keys they own. Nothing is
   written, nothing is computed into the stores — the dashboard
   is a pure view over the child's real learning data.
   Privacy: all data stays on this device (see ETHICS.md).
   ============================================================ */

import { PlayerModel } from '../../games/core/PlayerModel';
import { LearningSignals, type LearningEvent, type SessionSummary } from '../../games/core/LearningSignals';
import { bloomLevel, finishedCount, type GardenData } from '../../games/core/ProgressStore';
import { LITERACY_GRAPH, SkillGraph } from '../../games/core/SkillGraph';
import { dayKeyFor, type WorldDiaryData } from '../../world/worldDiary';
import { WorldDiary } from '../../world/worldDiary';
import { ZONES } from '../../data/garden';

const SIG_KEY = 'lenny-signals-v1';

export interface DayActivity {
  /** 0=6 days ago … 6=today */
  offset: number;
  label: string;
  attempts: number;
}

export interface LensData {
  garden: GardenData;
  player: ReturnType<PlayerModel['snapshot']>;
  summary: SessionSummary;
  events: LearningEvent[];
  graph: SkillGraph;
  totalFinished: number;
  bloom: number;
  days: DayActivity[];
  /** rough total play time in minutes (rolling EMA estimate) */
  approxMinutes: number;
  /** zone id the child returns to most (null = no signal yet) */
  interestZone: string | null;
  /** stage 8: the 3D garden through the parent's eyes (local diary) */
  world: WorldLens;
  hasAnyData: boolean;
}

export interface WorldLens {
  /** minutes inside the world over the last 7 days (day-grain data) */
  minutes7d: number;
  opens7d: number;
  arrivals7d: number;
  picks7d: number;
  /** arrivals per zone id over the last 7 days */
  zones: Record<string, number>;
  hasData: boolean;
}

/** Pure transform: the diary's day buckets → the parent's 7-day view. */
export function worldLensFromDiary(diary: WorldDiaryData, nowMs: number = Date.now()): WorldLens {
  const cutoff = dayKeyFor(nowMs - 7 * 86_400_000);
  let ms = 0;
  let opens = 0;
  let arrivals = 0;
  let picks = 0;
  const zones: Record<string, number> = {};
  for (const [key, stat] of Object.entries(diary.days)) {
    if (key < cutoff) continue;
    ms += stat.ms;
    opens += stat.opens;
    arrivals += stat.arrivals;
    picks += stat.picks;
    for (const [zone, count] of Object.entries(stat.zones)) {
      zones[zone] = (zones[zone] ?? 0) + count;
    }
  }
  const minutes7d = Math.round(ms / 60_000);
  return {
    minutes7d,
    opens7d: opens,
    arrivals7d: arrivals,
    picks7d: picks,
    zones,
    hasData: minutes7d > 0 || opens > 0 || arrivals > 0 || picks > 0,
  };
}

function readSignalEvents(): LearningEvent[] {
  try {
    const raw = localStorage.getItem(SIG_KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as { events?: LearningEvent[] };
    return Array.isArray(s.events) ? s.events : [];
  } catch {
    return [];
  }
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שב׳'];

function dayLabel(date: Date): string {
  return DAY_LABELS[date.getDay()] ?? '';
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Last 7 days of activity — real event timestamps, never invented history. */
function buildDays(events: LearningEvent[]): DayActivity[] {
  const today = startOfDay(Date.now());
  const days: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const from = today - i * 86_400_000;
    const to = from + 86_400_000;
    const attempts = events.filter((e) => e.kind === 'attempt' && e.t >= from && e.t < to).length;
    days.push({ offset: 6 - i, label: dayLabel(new Date(from)), attempts });
  }
  return days;
}

export function loadLensData(garden: GardenData): LensData {
  const playerModel = new PlayerModel();
  const player = playerModel.snapshot();
  const signals = new LearningSignals();
  const summary = signals.summarize();
  const events = readSignalEvents();
  const graph = new SkillGraph(LITERACY_GRAPH);

  let totalFinished = 0;
  for (const zone of ZONES) totalFinished += finishedCount(garden, zone.id);

  /* rough minutes: per-zone rolling avg seconds × rounds */
  let approxSeconds = 0;
  for (const stat of Object.values(player.zones)) {
    approxSeconds += (stat.avgTime || 0) * stat.rounds;
  }

  const zoneRounds = Object.values(player.zones).reduce((a, z) => a + z.rounds, 0);
  const diary = new WorldDiary();
  const world = worldLensFromDiary(diary.snapshot());
  const hasAnyData = totalFinished > 0 || zoneRounds > 0 || summary.attempts > 0 || world.hasData;

  return {
    garden,
    player,
    summary,
    events,
    graph,
    totalFinished,
    bloom: bloomLevel(garden),
    days: buildDays(events),
    approxMinutes: Math.max(1, Math.round(approxSeconds / 60)),
    interestZone: playerModel.interest(),
    world,
    hasAnyData,
  };
}
