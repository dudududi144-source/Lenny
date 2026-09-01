import { finishedCount, zoneName } from '../../games/core/ProgressStore';
import { ZONES } from '../../data/garden';
import { uiButton } from '../components/common/Button';
import { h } from '../components/common/el';
import { buildCharts } from './charts';
import type { LensData } from './lensData';

/* ============================================================
   dashboard — "עֲדֶשֶׁת הַהוֹרֶה" (Stage 5).

   HTML overlay in the project design system: RTL, niqqud,
   Heebo, glass cards, 8px grid, 44px touch targets.
   Structure: header → hero summary → sections grid.
   All numbers come from lensData (read-only core views).

   e2e contract notes: `.parent-title` (last) reads
   "מַה שֶּׁהַגַּן מְסַפֵּר" — the hero card keeps that name;
   `.parent-zone-row` renders exactly the 10 garden zones.
   ============================================================ */

export interface DashboardCallbacks {
  onExit(): void;
}

const TEMPO_LABEL: Record<string, string> = {
  fast: 'בְּקֶצֶב מָהִיר',
  steady: 'בְּקֶצֶב יָצִיב',
  careful: 'בְּקֶצֶב זְהִיר',
  unknown: '',
};

function tempoFor(data: LensData, zone: string): string {
  const stat = data.player.zones[zone];
  if (!stat || stat.rounds < 3) return '';
  return TEMPO_LABEL[stat.rounds ? tempoKey(stat.avgTime) : 'unknown'] ?? '';
}

function tempoKey(avgTime: number): 'fast' | 'steady' | 'careful' {
  if (avgTime < 6) return 'fast';
  if (avgTime < 12) return 'steady';
  return 'careful';
}

export function hebrewDate(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

function minutesPhrase(mins: number): string {
  if (mins === 1) return 'בְּעֵרֶךְ דַּקָּה אַחַת שֶׁל מִשְׂחָק';
  return `בְּעֵרֶךְ כְּ-${mins} דַּקּוֹת מִשְׂחָק`;
}

function gamesPhrase(count: number): string {
  if (count === 0) return 'בִּינְתַּיִם בְּלִי מִשְׂחָק שֶׁהֻשְׁלַם';
  if (count === 1) return 'מִשְׂחָק אֶחָד שֶׁהֻשְׁלַם';
  return `${count} מִשְׂחָקִים שֶׁהֻשְׁלְמוּ`;
}

function bar(fraction: number, color: string): HTMLElement {
  const fill = h('span', { class: 'parent-bar-fill' });
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  fill.style.background = color;
  return h('span', { class: 'parent-bar', role: 'img', 'aria-label': `${Math.round(fraction * 100)}%` }, fill);
}

function heroCard(data: LensData): HTMLElement {
  const name = (localStorage.getItem('lenny-name') ?? '').trim();
  const interest = data.interestZone ? zoneName(data.interestZone) : null;
  return h(
    'section',
    { class: 'parent-card parent-card--overview parent-hero', 'aria-label': 'תמצית המשחק' },
    h(
      'div',
      { class: 'parent-hero-ring' },
      h('span', { class: 'parent-hero-bloom', 'aria-hidden': 'true' }, '✦'),
      h('span', { class: 'parent-hero-bloom-label' }, `רִמָּה ${data.bloom}`),
    ),
    h(
      'div',
      { class: 'parent-overview-lines' },
      h('h3', { class: 'parent-title' }, 'מַה שֶּׁהַגַּן מְסַפֵּר'),
      h('p', { class: 'parent-hero-line' },
        `${minutesPhrase(data.approxMinutes)}${name ? ` — ${name} שָׂחֲקָה` : ''} · ${gamesPhrase(data.totalFinished)}.`),
      interest ? h('p', { class: 'parent-hero-line' }, `מָקוֹם חָבִיב בְּמִיּוֹחָד: ${interest}.`) : null,
      data.streakDays >= 2 ? h('p', { class: 'parent-hero-line parent-streak' }, `רֶצֶף ${data.streakDays} יָמִים — הַגַּן מַמְשִׁיךְ לְפָרוֹחַ!`) : null,
    ),
  );
}

function emptyState(): HTMLElement {
  return h(
    'section',
    { class: 'parent-card parent-empty', 'aria-label': 'אין עדיין נתונים' },
    h('span', { class: 'parent-empty-icon', 'aria-hidden': 'true' }, '❋'),
    h('h3', { class: 'parent-card-title' }, 'עֲדַיִן לֹא נֶאֱסַף מַסְפִּיק'),
    h('p', { class: 'parent-line' }, 'אַחֲרֵי כַּמָּה מִשְׂחָקִים בַּגַּן, כָּאן יֵרָאֶה הַתְמוּנָה הַמְּלֵאה — בְּלִי לְחַץ, בְּלִי דְּרָגוֹת.'),
    h('p', { class: 'parent-line' }, 'בֵּינְתַיִם: שֶׁיְּשַׂחֲקִי, וְנִרְאֶה מָה הַגַּן יְלַמֵּד אוֹתָנוּ.'),
  );
}

function zonesCard(data: LensData): HTMLElement {
  return h(
    'section',
    { class: 'parent-card', 'aria-label': 'הדרך באזורים' },
    h('h3', { class: 'parent-card-title' }, 'הַדֶּרֶךְ בָּאֲזוֹרִים'),
    h(
      'div',
      { class: 'parent-zones' },
      ...ZONES.map((zone) => {
        const done = finishedCount(data.garden, zone.id);
        const stat = data.player.zones[zone.id];
        return h(
          'div',
          { class: 'parent-zone-row' },
          h('span', { class: 'parent-zone-name' }, zone.name),
          bar(Math.min(1, done / 3), zone.uiColor),
          h('span', { class: 'parent-zone-count' }, `${done}`),
          h('span', { class: 'parent-zone-tempo' }, stat ? tempoFor(data, zone.id) : ''),
        );
      }),
    ),
  );
}

function skillsCard(data: LensData): HTMLElement {
  const progress = data.graph.progress();
  const frontier = data.graph.frontier().map((id) => data.graph.getNode(id)?.label ?? id);
  return h(
    'section',
    { class: 'parent-card', 'aria-label': 'מגדל המיומנויות' },
    h('h3', { class: 'parent-card-title' }, 'מִגְדַּל הַמִּיָּמָחוֹת'),
    h('div', { class: 'parent-skill-row' },
      bar(progress, 'linear-gradient(135deg,#ffd76a,#f2549a)'),
      h('span', { class: 'parent-zone-count' }, `${Math.round(progress * 100)}%`)),
    frontier.length ? h('p', { class: 'parent-line' }, `בַּפֶּתַח עַכְשָׁיו: ${frontier.join(' · ')}`) : null,
    h('p', { class: 'parent-line' }, 'כָּל מִיּוּמָן נִרְכָּשׁ בְּעַכְשֵׁו — הַמִּגְדָּל נִבְנֶה בַּקֶּצֶב שֶׁל הַיֶּלֶד.'),
  );
}

function signalsCard(data: LensData): HTMLElement {
  const s = data.summary;
  const errorKinds = Object.entries(s.errorKinds).sort((x, y) => y[1] - x[1]).slice(0, 3);
  return h(
    'section',
    { class: 'parent-card', 'aria-label': 'אותות הלמידה' },
    h('h3', { class: 'parent-card-title' }, 'אוֹתוֹת הַלְּמִידָה'),
    h('p', { class: 'parent-line' }, `נִסְיוֹנוֹת: ${s.attempts} · הַצְלָחוֹת: ${s.correct} · עִזְרָה שֶׁנִּדְרְשָׁה: ${s.hints}`),
    errorKinds.length
      ? h('p', { class: 'parent-line' }, `סוּגֵי טָעוּיָה נָפו֦צִים: ${errorKinds.map(([kind, count]) => `${kind} (${count})`).join(' · ')}`)
      : h('p', { class: 'parent-line' }, 'עַדַּיִן אֵין טָעוּיּוֹת מִפְתַּח — הַכֹּל בִּקְצֶב שֶׁל הַיֶּלֶד.'),
  );
}

export function renderDashboard(data: LensData, callbacks: DashboardCallbacks): HTMLElement {
  const root = h('div', { class: 'parent-dashboard-body' });

  root.append(
    h(
      'header',
      { class: 'parent-head' },
      h(
        'div',
        {},
        h('h2', { class: 'parent-head-title' }, 'עֲדֶשֶׁת הַהוֹרֶה'),
        h('p', { class: 'parent-sub' }, hebrewDate()),
      ),
      uiButton({ label: '→ חזרה', variant: 'ghost', onPress: () => callbacks.onExit() }),
    ),
    heroCard(data),
  );

  /* the garden path always renders (it is the map, not a chart) —
     the analytics sections yield to the gentle empty state when
     nothing has been collected yet */
  const charts = data.hasAnyData ? buildCharts(data) : null;
  const sections = data.hasAnyData && charts
    ? [zonesCard(data), charts.weekly, charts.strengths, skillsCard(data), charts.errors, charts.blooming, signalsCard(data)]
    : [zonesCard(data), emptyState()];

  root.append(
    h(
      'div',
      { class: 'parent-grid' },
      ...sections,
    ),
  );
  return root;
}
