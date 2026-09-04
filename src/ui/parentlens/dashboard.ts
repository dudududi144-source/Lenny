import { finishedCount, zoneName } from '../../games/core/ProgressStore';
import { ZONES } from '../../data/garden';
import { uiButton } from '../components/common/Button';
import { h } from '../components/common/el';
import { buildCharts } from './charts';
import { buildInsights, INTRO } from './insights';
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

function worldMinutesPhrase(mins: number): string {
  if (mins >= 2) return `בְּעֵרֶךְ כְּ-${mins} דַּקּוֹת בַּגַּן הַתְּלַת-מֶמְדִּי הַשָּׁבוּעַ`;
  if (mins === 1) return 'בְּעֵרֶךְ דַּקָּה אַחַת בַּגַּן הַתְּלַת-מֶמְדִּי הַשָּׁבוּעַ';
  return 'בִּיקּוּר קָצָר בַּגַּן הַתְּלַת-מֶמְדִּי הַשָּׁבוּעַ';
}

function worldPicksPhrase(count: number): string {
  if (count === 1) return 'מִשְׂחָק אֶחָד נִפְתַּח מֵאֵי הַגַּן.';
  return `${count} מִשְׂחָקִים נִפְתְּחוּ מֵאֵי הַגַּן.`;
}

function worldQuestsPhrase(count: number): string {
  if (count === 1) return 'מְשִׂימַת גִּלּוּי אַחַת הֻשְׁלַמָּה בַּגַּן הַשָּׁבוּעַ.';
  return `${count} מְשִׂימוֹת גִּלּוּי הֻשְׁלְמוּ בַּגַּן הַשָּׁבוּעַ.`;
}

function worldFoundPhrase(found: number, total: number): string {
  if (found === 0) return '';
  if (found === total) return 'כָּל הַמְּקוֹמוֹת בַּגַּן מֻכָּרִים!';
  return `${found} מִתּוֹךְ ${total} מְקוֹמוֹת בַּגַּן כְּבָר מֻכָּרִים.`;
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
        const dda = data.ddaTiers[zone.id];
        const rung = dda ? `דַּרְגָּה ${'אבגד'[dda - 1] ?? dda}` : '';
        const tempo = [stat ? tempoFor(data, zone.id) : '', rung].filter(Boolean).join(' · ');
        return h(
          'div',
          { class: 'parent-zone-row' },
          h('span', { class: 'parent-zone-name' }, zone.name),
          bar(Math.min(1, done / 3), zone.uiColor),
          h('span', { class: 'parent-zone-count' }, `${done}`),
          h('span', { class: 'parent-zone-tempo' }, tempo),
        );
      }),
    ),
  );
}

function worldCard(data: LensData): HTMLElement {
  const w = data.world;
  const lines: HTMLElement[] = [];
  if (!w.hasData) {
    lines.push(
      h('p', { class: 'parent-line' }, 'הַגַּן הַתְּלַת-מֶמְדִּי עוֹד לֹא זָכָה לְבִיקּוּר — מֵהָרֶגַע הָרִאשׁוֹן, הַדֶּרֶךְ בּוֹ תֵּסָפֵר כָּאן.'),
    );
  } else {
    lines.push(h('p', { class: 'parent-line' }, worldMinutesPhrase(w.minutes7d)));
    if (w.opens7d >= 2) {
      lines.push(h('p', { class: 'parent-line' }, `כְּ-${w.opens7d} בִּיקּוּרִים בַּגַּן הַשָּׁבוּעַ.`));
    }
    if (w.picks7d > 0) {
      lines.push(h('p', { class: 'parent-line' }, worldPicksPhrase(w.picks7d)));
    }
    if (w.quests7d > 0) {
      lines.push(h('p', { class: 'parent-line' }, worldQuestsPhrase(w.quests7d)));
    }
    const foundLine = worldFoundPhrase(w.landmarksFound, w.landmarksTotal);
    if (foundLine) {
      lines.push(h('p', { class: 'parent-line' }, foundLine));
    }
    if (w.regionsFound > 0) {
      lines.push(h('p', { class: 'parent-line' }, `${w.regionsFound} מִתּוֹךְ 6 אֲזוֹרִים בְּעוֹלָם הַגָּדוֹל כְּבָר הִתְגַּלּוּ.`));
    }
    /* stage 15-C: the honest ledgers — gathers, the well, the snow's crystals */
    if (w.gathers7d > 0) {
      lines.push(h('p', { class: 'parent-line' }, `הַשְּׁבוּעַ נֶאֱסְפוּ בַּדֶּרֶךְ ${w.gathers7d} אוֹצָרוֹת קְטַנִּים (נְצָנִים, בְּלוּטִים וּקְרִיסְטַלִּים).`));
    }
    if (w.well7d > 0) {
      lines.push(h('p', { class: 'parent-line' }, `הַשָּׁבוּעַ נִקְנָה מַשֶּׁהוּ בְּאֵר הַגַּן — ${w.well7d} ${w.well7d === 1 ? 'בִּקּוּר' : 'בִּקּוּרִים'}.`));
    }
    if (w.scarvesOwned > 0) {
      lines.push(h('p', { class: 'parent-line' }, `לַשּׁוּעָל יֵשׁ ${w.scarvesOwned} צָעִיפִים בָּאֲרוֹן — כָּל אֶחָד נִקְנָה בַּאֲקָרוֹנִים שֶׁנֶּאֱסְפוּ בַּדֶּרֶךְ.`));
    }
    if (w.crystalsFound > 0) {
      lines.push(h('p', { class: 'parent-line' }, `${w.crystalsFound} מִתּוֹךְ 12 קְרִיסְטַּלִּים כְּבָר נִמְצְאוּ בְּאֶרֶץ הַשֶּׁלֶג.`));
    }
  }
  /* stage 12: the honest horizon — this is a world that grows with the
     child for years (new regions, roads, and a fresh daily journey),
     not a pastime of a few minutes */
  lines.push(h('p', { class: 'parent-line parent-world-vision' }, 'הָעוֹלָם גָּדֵל עִם הַיֶּלֶד — אֲזוֹרִים, דְּרָכִים וּמַסַּע הַיּוֹם מְחַכִּים בְּכָל בִּיקּוּר, לְשָׁנִים.'));
  /* the spiral is the map — all 10 islands always show, even the quiet ones */
  return h(
    'section',
    { class: 'parent-card parent-world-card', 'aria-label': 'הגן התלת-ממדי' },
    h('h3', { class: 'parent-card-title' }, 'הַגַּן הַתְּלַת-מֶמְדִּי'),
    ...lines,
    h(
      'div',
      { class: 'parent-world-zones' },
      ...ZONES.map((zone) => {
        const dot = h('span', { class: 'parent-world-dot', 'aria-hidden': 'true' });
        dot.style.background = zone.uiColor;
        return h(
          'div',
          { class: 'parent-world-zone-row' },
          dot,
          h('span', { class: 'parent-world-name' }, zone.name),
          h('span', { class: 'parent-world-count' }, String(w.zones[zone.id] ?? 0)),
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
    h('h3', { class: 'parent-card-title' }, 'מִגְדַּל הַמְּיֻמָּנוּיוֹת'),
    h('div', { class: 'parent-skill-row' },
      bar(progress, 'linear-gradient(135deg,#ffd76a,#f2549a)'),
      h('span', { class: 'parent-zone-count' }, `${Math.round(progress * 100)}%`)),
    frontier.length ? h('p', { class: 'parent-line' }, `בַּפֶּתַח עַכְשָׁיו: ${frontier.join(' · ')}`) : null,
    h('p', { class: 'parent-line' }, 'כָּל מִיּוּמָן נִרְכָּשׁ בְּעַכְשֵׁו — הַמִּגְדָּל נִבְנֶה בַּקֶּצֶב שֶׁל הַיֶּלֶד.'),
  );
}

/* raw error-kind ids become warm Hebrew phrases (audit 9-d #9) */
const ERROR_KIND_LABEL: Record<string, string> = {
  'confused-bet-kaf': 'בּ/כּ מִתְבַּלְבְּלִים',
  'confused-mem-samech': 'מ/ס מִתְבַּלְבְּלִים',
  'confused-dalet-resh': 'ד/ר מִתְבַּלְבְּלִים',
  'confused-similar-emotions': 'רְגָשׁוֹת דּוֹמוֹת',
  'wrong-emotion': 'זִיהוּי רְגָשׁוֹת',
};

function signalsCard(data: LensData): HTMLElement {
  const s = data.summary;
  const errorKinds = Object.entries(s.errorKinds).sort((x, y) => y[1] - x[1]).slice(0, 3);
  return h(
    'section',
    { class: 'parent-card', 'aria-label': 'אותות הלמידה' },
    h('h3', { class: 'parent-card-title' }, 'אוֹתוֹת הַלְּמִידָה'),
    h('p', { class: 'parent-line' }, `נִסְיוֹנוֹת: ${s.attempts} · הַצְלָחוֹת: ${s.correct} · עִזְרָה שֶׁנִּדְרְשָׁה: ${s.hints}`),
    errorKinds.length
      ? h('p', { class: 'parent-line' }, `סוּגֵי טָעוּיָה נָפו֦צִים: ${errorKinds.map(([kind, count]) => `${ERROR_KIND_LABEL[kind] ?? kind} (${count})`).join(' · ')}`)
      : h('p', { class: 'parent-line' }, 'עַדַּיִן אֵין טָעוּיּוֹת מִפְתַּח — הַכֹּל בִּקְצֶב שֶׁל הַיֶּלֶד.'),
  );
}

function insightsCard(data: LensData): HTMLElement {
  const list = buildInsights(data);
  return h(
    'section',
    { class: 'parent-card parent-insights', 'aria-label': 'מה הדרך מספרת' },
    h('h3', { class: 'parent-card-title' }, 'מָה הַדֶּרֶךְ מְסַפֶּרֶת'),
    list.length
      ? h('ul', { class: 'parent-insight-list' },
          ...list.map((ins) =>
            h('li', { class: `parent-insight parent-insight-${ins.kind}` },
              h('span', { class: 'parent-insight-icon', 'aria-hidden': 'true' }, ins.icon),
              h('span', { class: 'parent-insight-text' }, ins.text),
            )),
        )
      : h('p', { class: 'parent-line' }, 'כְּכָל מִשְׂחָק יִצְטָרְפוּ כָּאן הַפְּתִיעוֹת הַקְּטַנּוֹת שֶׁל הַדֶּרֶךְ.'),
  );
}

function introCard(): HTMLElement {
  return h(
    'section',
    { class: 'parent-card parent-intro', 'aria-label': 'מה זו עדשת ההורה' },
    h('h3', { class: 'parent-card-title' }, 'מָה זוֹ עֲדֶשֶׁת הַהוֹרֶה?'),
    h('p', { class: 'parent-line' }, `💛 ${INTRO.what}`),
    h('p', { class: 'parent-line' }, `🌿 ${INTRO.whatNot}`),
    h('p', { class: 'parent-line' }, `🔒 ${INTRO.stored}`),
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
    ? [insightsCard(data), zonesCard(data), worldCard(data), charts.weekly, charts.strengths, skillsCard(data), charts.errors, charts.blooming, signalsCard(data), introCard()]
    : [insightsCard(data), zonesCard(data), worldCard(data), emptyState(), introCard()];

  root.append(
    h(
      'div',
      { class: 'parent-grid' },
      ...sections,
    ),
  );
  return root;
}
