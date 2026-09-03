import { zoneName } from '../../games/core/ProgressStore';
import { ZONES } from '../../data/garden';
import type { LensData } from './lensData';

/* ============================================================
   insights — the reading rules behind "מה הדרך מספרת".

   Every insight is derived from the child's real data
   (PlayerModel + LearningSignals + SkillGraph) and written in
   ETHICS language (docs/ETHICS.md):
     - description + invitation, never a verdict
     - no clinical claims, no "needs practice", no grades
     - the parent is a partner, the child is never scored
   ============================================================ */

export type InsightKind =
  | 'tempo'
  | 'gaps'
  | 'explore'
  | 'milestone'
  | 'balance'
  | 'world';

export interface Insight {
  kind: InsightKind;
  icon: string;
  text: string;
}

const TEMPO_TEXT: Record<'fast' | 'steady' | 'careful', (zone: string) => string> = {
  fast: (z) => `ב${z} העבודה מהירה ובטוחה — סגנון של "רואים מהר ועושים".`,
  steady: (z) => `ב${z} יש קצב יציב ונעים — לא ממהרים ולא מתמהמהים.`,
  careful: (z) => `ב${z} העבודה זהירה ומחושבת — אוספים את העולם בנחת.`,
};

export function buildInsights(data: LensData): Insight[] {
  const out: Insight[] = [];
  if (!data.hasAnyData) return out;

  /* ---- 1. tempo detection (zones with ≥3 rounds) ---- */
  for (const zone of ZONES) {
    const stat = data.player.zones[zone.id];
    if (!stat || stat.rounds < 3) continue;
    const key: 'fast' | 'steady' | 'careful' = stat.avgTime < 6 ? 'fast' : stat.avgTime < 12 ? 'steady' : 'careful';
    out.push({ kind: 'tempo', icon: '⏱', text: TEMPO_TEXT[key](zone.name) });
    break; /* one tempo line is enough — the picture, not a report */
  }

  /* ---- 2. persistent gaps: 2+ zones with success ≤ 0.4 (≥2 rounds) ---- */
  const gapZones = ZONES.filter((z) => {
    const s = data.player.zones[z.id];
    return s && s.rounds >= 2 && s.success <= 0.4;
  });
  if (gapZones.length >= 2) {
    const names = gapZones.slice(0, 2).map((z) => z.name).join(' וּבְ');
    out.push({
      kind: 'gaps',
      icon: '🌤',
      text: `ב${names} ההצלחה עדינה כרגע. לשחק יחד, לצד אחד — זו ההזמנה הכי טובה שיש.`,
    });
  }

  /* ---- 3. unexplored zones ---- */
  const unexplored = ZONES.filter((z) => {
    const s = data.player.zones[z.id];
    return !s || s.rounds === 0;
  });
  if (unexplored.length > 0) {
    const pick = unexplored[Math.floor(Math.random() * unexplored.length)];
    out.push({
      kind: 'explore',
      icon: '🧭',
      text: `${pick.name} עדיין מחכה לגלות מי תבוא אליה. אולי בביקור הבא?`,
    });
  }

  /* ---- 4. mastery milestones (graph + signals) ---- */
  const acquired = ZONES.length ? recentMilestones(data) : [];
  for (const label of acquired.slice(0, 2)) {
    out.push({ kind: 'milestone', icon: '⭐', text: `נרכש לאחרונה: "${label}" — ציון דרך של ממש.` });
  }

  /* ---- 6. balance: >60% of recent play in one zone ---- */
  const order = data.player.playOrder;
  if (order.length >= 5) {
    const counts: Record<string, number> = {};
    for (const z of order) counts[z] = (counts[z] || 0) + 1;
    const [topZone, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (topCount / order.length > 0.6) {
      const other = ZONES.find((z) => z.id !== topZone && (data.player.zones[z.id]?.rounds ?? 0) > 0);
      out.push({
        kind: 'balance',
        icon: '⚖',
        text: `לאחרונה רוב הזמן נשאר ב${zoneName(topZone)}. יש עוד גינות יפות — ${other ? `אולי ${other.name}?` : 'שווה ביקור.'}`,
      });
    }
  }

  /* ---- 7. the world: a favorite island (≥2 arrivals this week) ---- */
  const favoriteIsland = Object.entries(data.world.zones)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (favoriteIsland) {
    out.push({
      kind: 'world',
      icon: '✦',
      text: `בגן התלת-ממדי, ${zoneName(favoriteIsland[0])} קוסמת במיוחד — ${favoriteIsland[1]} הגעות השבוע.`,
    });
  }

  return out;
}

/* audit 9-d #9: a skill id the graph doesn't carry still gets Hebrew */
const SKILL_FALLBACK_LABEL: Record<string, string> = {
  'memory.pairs': 'זִכְּרוֹן זוּגוֹת',
  'letter.alef': 'הָאוֹת א',
  'letter.bet': 'הָאוֹת ב',
  'emotion.recognition': 'זִיהוּי רְגָשׁוֹת',
};

/* skills that crossed the mastery threshold inside the last 7 days
   (from the append-only signals stream — real timestamps only) */
function recentMilestones(data: LensData): string[] {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const e of data.events) {
    if (e.kind !== 'mastery' || e.t < weekAgo) continue;
    if (seen.has(e.skill)) continue;
    seen.add(e.skill);
    const label = data.graph.getNode(e.skill)?.label ?? SKILL_FALLBACK_LABEL[e.skill] ?? e.skill;
    labels.push(label);
  }
  return labels;
}

/* ---------- the parent intro — three honest sentences ---------- */

export const INTRO = {
  what: 'זו עדשה חמה להסתכל על המסע של הילדה בגן — מה מרתק אותה, איפה היא פורחת, ומה עוד בדרך.',
  whatNot: 'זו לא מדידה, לא ציון ולא אבחון — אין כאן שיפוט ואין "חייבים להשתפר".',
  stored: 'הכול נשמר על המכשיר הזה בלבד. שום דבר לא נשלח לשום מקום.',
} as const;
