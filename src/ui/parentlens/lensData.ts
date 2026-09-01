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
import { ZONES } from '../../data/garden';

const SIG_KEY = 'lenny-signals-v1';
const STREAK_KEY = 'lenny-streak';

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
  streakDays: number;
  days: DayActivity[];
  /** rough total play time in minutes (rolling EMA estimate) */
  approxMinutes: number;
  /** zone id the child returns to most (null = no signal yet) */
  interestZone: string | null;
  hasAnyData: boolean;
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

function readStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw) as { count?: number };
    return typeof s.count === 'number' ? s.count : 0;
  } catch {
    return 0;
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
  const hasAnyData = totalFinished > 0 || zoneRounds > 0 || summary.attempts > 0;

  return {
    garden,
    player,
    summary,
    events,
    graph,
    totalFinished,
    bloom: bloomLevel(garden),
    streakDays: readStreak(),
    days: buildDays(events),
    approxMinutes: Math.max(1, Math.round(approxSeconds / 60)),
    interestZone: playerModel.interest(),
    hasAnyData,
  };
}
