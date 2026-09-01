import type { PlayerModelData } from '../../games/core/PlayerModel';
import type { ZoneProg } from '../../games/core/ProgressStore';
import { ZONES, type ZoneDef } from '../../data/garden';
import { h, svg } from '../components/common/el';
import type { DayActivity, LensData } from './lensData';

/* ============================================================
   charts — hand-built inline SVG visualizations (Stage 5).

   Zero external dependencies, browser-neutral, RTL-safe.
   Every chart ships with one warm interpretive sentence —
   descriptive + inviting, never clinical (docs/ETHICS.md).
   Empty data renders a gentle illustration, never a broken
   empty graph.
   ============================================================ */

function card(title: string, interpretation: string | null, body: Node, extraClass = ''): HTMLElement {
  /* body may host SVG nodes — h() only builds HTML, the body is pre-built */
  return h(
    'section',
    { class: `parent-card parent-chart${extraClass ? ` ${extraClass}` : ''}` },
    h('h3', { class: 'parent-card-title' }, title),
    interpretation ? h('p', { class: 'parent-chart-note' }, interpretation) : null,
    body,
  );
}

/* ---------- 1. weekly rhythm — 7-day bar chart ---------- */

export function weeklyChart(days: DayActivity[]): HTMLElement {
  const W = 292;
  const H = 132;
  const pad = 6;
  const slot = (W - pad * 2) / 7;
  const max = Math.max(3, ...days.map((d) => d.attempts));
  const maxH = 78;

  const bars: SVGElement[] = [];
  for (const d of days) {
    const x = pad + d.offset * slot + slot * 0.16;
    const bw = slot * 0.68;
    const bh = d.attempts > 0 ? Math.max(6, (d.attempts / max) * maxH) : 0;
    const y = H - 22 - bh;
    bars.push(
      d.attempts > 0
        ? svg('rect', {
            x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1),
            rx: 5, fill: 'url(#pl-bar-grad)', class: 'pl-bar',
          })
        : svg('circle', {
            cx: (x + bw / 2).toFixed(1), cy: (H - 26).toFixed(1), r: 2.2,
            fill: 'rgba(255,246,236,0.28)', class: 'pl-bar-dot',
          }),
    );
    bars.push(
      svg('text', {
        x: (x + bw / 2).toFixed(1), y: H - 6, 'text-anchor': 'middle',
        class: 'pl-axis-label',
      }, d.label),
    );
    if (d.attempts > 0) {
      bars.push(svg('text', {
        x: (x + bw / 2).toFixed(1), y: (y - 4).toFixed(1), 'text-anchor': 'middle', class: 'pl-value-label',
      }, String(d.attempts)));
    }
  }

  const chart = svg(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, class: 'pl-svg', role: 'img', 'aria-label': 'פעילות לפי יום בשבוע האחרון' },
    svg('defs', {},
      svg('linearGradient', { id: 'pl-bar-grad', x1: 0, y1: 0, x2: 0, y2: 1 },
        svg('stop', { offset: '0%', 'stop-color': '#ffe9a6' }),
        svg('stop', { offset: '55%', 'stop-color': '#ffd76a' }),
        svg('stop', { offset: '100%', 'stop-color': '#f2549a' })),
    ),
    svg('line', { x1: pad, y1: H - 22, x2: W - pad, y2: H - 22, stroke: 'rgba(255,255,255,0.14)', 'stroke-width': 1 }),
    ...bars,
  );

  const total = days.reduce((a, d) => a + d.attempts, 0);
  const note = total > 0
    ? 'כָּל עַמּוּד הוּא יוֹם — רוֹאִים בְּאֵילּוּ יָמִים הַגַּן הָיָה פָּעִיל.'
    : 'הַשָּׁבוּעַ עֲדַיִן שָׁקֵט — הַפְּעִילוּת תִּפְרוֹחַ כָּאן כְּשֶׁתִּהְיֶה.';

  return card('קֶצֶב הַשְּׁבוּעַ', note, chart, 'parent-chart--wide');
}

/* ---------- 2. strengths & gaps — sorted horizontal bars ---------- */

export function strengthsChart(player: PlayerModelData): HTMLElement {
  type Row = { name: string; success: number; rounds: number; color: string };
  const rows: Row[] = [];
  for (const zone of ZONES) {
    const stat = player.zones[zone.id];
    if (stat && stat.rounds > 0) {
      rows.push({ name: zone.name, success: stat.success, rounds: stat.rounds, color: zone.uiColor });
    }
  }
  rows.sort((a, b) => b.success - a.success);

  if (rows.length === 0) {
    return card(
      'כּוֹחוֹת וּפְתָחוֹת',
      'אַחֲרֵי כַּמָּה סִבּוֹבִים כָּאן יֵרָאֶה מָה מְצָחֲקִים וּמָה מְאַתְגֵּר.',
      gentleIllustration('❋'),
    );
  }

  const list = h('div', { class: 'parent-power-list' });
  for (const r of rows) {
    const tone = r.success >= 0.6 ? 'high' : r.success <= 0.4 ? 'warm' : 'mid';
    list.append(
      h(
        'div',
        { class: `parent-power-row parent-power-${tone}` },
        h('span', { class: 'parent-power-name' }, r.name),
        h('span', { class: 'parent-power-track' },
          h('span', {
            class: 'parent-power-fill',
            style: `width:${Math.round(Math.min(1, Math.max(0.04, r.success)) * 100)}%;background:${r.color}`,
          })),
        h('span', { class: 'parent-power-value' }, `${Math.round(r.success * 100)}%`),
      ),
    );
  }

  const top = rows[0];
  const tough = rows[rows.length - 1];
  const note = rows.length >= 2 && tough.success <= 0.4
    ? `הַצְלָחוֹת גְּבוֹהִיּוֹת בְּ${top.name} — וּבְ${tough.name} דַּוְקָא מְאַתְגֵּר. מְעַנְיֵן!`
    : `הַכֹּל בְּטֵרָם מְטֻפָּח — ${top.name} מִתְחַבֵּב בְּמִיּוֹחָד.`;

  return card('כּוֹחוֹת וּפְתָחוֹת', note, list);
}

/* ---------- 3. blooming map — progress rings ---------- */

export function bloomingChart(gardenZones: Record<string, ZoneProg>, graphProgress: number, finishedFor: (zoneId: string) => number): HTMLElement {
  const ringSize = 44;
  const r = 17;
  const c = 2 * Math.PI * r;

  const zoneRing = (zone: ZoneDef): HTMLElement => {
    const done = Math.min(3, finishedFor(zone.id));
    const frac = done / 3;
    const ring = svg(
      'svg',
      { viewBox: `0 0 ${ringSize} ${ringSize}`, width: ringSize, height: ringSize, class: 'pl-ring-svg', 'aria-hidden': 'true' },
      svg('circle', { cx: ringSize / 2, cy: ringSize / 2, r, fill: 'none', stroke: 'rgba(255,255,255,0.1)', 'stroke-width': 4.5 }),
      svg('circle', {
        cx: ringSize / 2, cy: ringSize / 2, r, fill: 'none', stroke: zone.uiColor, 'stroke-width': 4.5,
        'stroke-linecap': 'round', 'stroke-dasharray': c.toFixed(1),
        'stroke-dashoffset': (c * (1 - frac)).toFixed(1),
        transform: `rotate(-90 ${ringSize / 2} ${ringSize / 2})`,
      }),
      svg('text', { x: ringSize / 2, y: ringSize / 2 + 3.5, 'text-anchor': 'middle', class: 'pl-ring-value' }, String(done)),
    );
    return h('div', { class: 'pl-ring' , title: zone.name }, ring, h('span', { class: 'pl-ring-label' }, zone.name));
  };

  /* the big overall ring (skill graph) */
  const R = 34;
  const C = 2 * Math.PI * R;
  const overall = svg(
    'svg',
    { viewBox: '0 0 84 84', width: 84, height: 84, class: 'pl-ring-svg pl-ring-overall', role: 'img', 'aria-label': `התקדמות מיומנויות ${Math.round(graphProgress * 100)} אחוז` },
    svg('defs', {},
      svg('linearGradient', { id: 'pl-ring-grad', x1: 0, y1: 0, x2: 1, y2: 1 },
        svg('stop', { offset: '0%', 'stop-color': '#ffd76a' }),
        svg('stop', { offset: '100%', 'stop-color': '#f2549a' })),
    ),
    svg('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: 'rgba(255,255,255,0.1)', 'stroke-width': 7 }),
    svg('circle', {
      cx: 42, cy: 42, r: R, fill: 'none', stroke: 'url(#pl-ring-grad)', 'stroke-width': 7,
      'stroke-linecap': 'round', 'stroke-dasharray': C.toFixed(1),
      'stroke-dashoffset': (C * (1 - Math.min(1, Math.max(0, graphProgress)))).toFixed(1),
      transform: 'rotate(-90 42 42)',
    }),
    svg('text', { x: 42, y: 47, 'text-anchor': 'middle', class: 'pl-ring-big' }, `${Math.round(graphProgress * 100)}%`),
  );

  const body = h(
    'div',
    { class: 'parent-blooming' },
    h('div', { class: 'parent-blooming-overall' },
      overall,
      h('p', { class: 'parent-blooming-overall-label' }, 'מִגְדַּל הַמִּיּוּמָחוֹת'),
    ),
    h('div', { class: 'parent-blooming-zones' }, ...ZONES.map(zoneRing)),
  );

  return card('מַפַּת הַפְּרִיחָה', 'כָּל טַבַּעַת הִיא אֲזוֹר — הִיא מִתְמַלֵּא֪ת כְּכָל מִשְׂחָק שֶׁהֻשְׁלַם.', body, 'parent-chart--wide');
}

/* ---------- 4. error depth — donut of top error kinds ---------- */

export function errorDonut(errorKinds: Record<string, number>): HTMLElement {
  const entries = Object.entries(errorKinds).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((a, [, n]) => a + n, 0);

  if (entries.length === 0) {
    return card(
      'עוֹמֶק הַטְּעוּיָה',
      'עֲדַיִן אֵין טְעוּיּוֹת לְסַפֵּר עֲלֵיהֶן — וְזֶה בְּסֵדֶר גָּמוּר.',
      gentleIllustration('✧'),
    );
  }

  const COLORS_POOL = ['#ffd76a', '#7c4dff', '#f2549a', '#7dffb8', '#4a9eff'];
  const size = 120;
  const r = 44;
  let startAngle = -Math.PI / 2;
  const slices: SVGElement[] = [];

  for (const [i, [, count]] of entries.entries()) {
    const frac = count / total;
    const endAngle = startAngle + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = size / 2 + r * Math.cos(startAngle);
    const y1 = size / 2 + r * Math.sin(startAngle);
    const x2 = size / 2 + r * Math.cos(endAngle);
    const y2 = size / 2 + r * Math.sin(endAngle);
    if (frac >= 0.999) {
      slices.push(svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: COLORS_POOL[i % COLORS_POOL.length], 'stroke-width': 15 }));
    } else {
      slices.push(svg('path', {
        d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        fill: 'none', stroke: COLORS_POOL[i % COLORS_POOL.length], 'stroke-width': 15, 'stroke-linecap': 'butt',
      }));
    }
    startAngle = endAngle;
  }

  const legend = h('ul', { class: 'pl-legend' },
    ...entries.map(([kind, count], i) =>
      h('li', { class: 'pl-legend-item' },
        h('span', { class: 'pl-legend-swatch', style: `background:${COLORS_POOL[i % COLORS_POOL.length]}` }),
        h('span', { class: 'pl-legend-kind' }, errorKindLabel(kind)),
        h('span', { class: 'pl-legend-count' }, String(count)),
      )),
  );

  const donut = svg(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'pl-svg', role: 'img', 'aria-label': 'התפלגות סוגי הטעויות' },
    svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 15 }),
    ...slices,
    svg('text', { x: size / 2, y: size / 2 + 4, 'text-anchor': 'middle', class: 'pl-ring-big' }, String(total)),
  );

  const top = entries[0];
  const note = entries.length === 1
    ? `כל הטעויות מאותו סוג (${errorKindLabel(top[0])}) — סימן ממוקד אחד.`
    : `הטעויות מְרֻכָּזוֹת סְבִיב "${errorKindLabel(top[0])}" — העדשה עדינה על נקודת למידה אחת.`;

  return card('עוֹמֶק הַטְּעוּיָה', note, h('div', { class: 'parent-donut-wrap' }, donut, legend));
}

/* friendly Hebrew labels for the error-kind taxonomy */
function errorKindLabel(kind: string): string {
  const map: Record<string, string> = {
    'near-miss-same-suit': 'בִּלְבּוּל בֵּין דּוֹמִים',
    'near-miss-same-color': 'בִּלְבּוּל צְבָעִים קְרוֹבִים',
    'near-miss-same-shape': 'בִּלְבּוּל צוּרוֹת דּוֹמוֹת',
    'wrong-suit': 'טָעוּת זֵהוּי',
    'wrong-order': 'סִדּוּר שֶׁנִּפָּגַם',
    'wrong-letter': 'אוֹת שֶׁהִתְחַלְּפָה',
    'tap-hurry': 'מַקָּשׁ מְמֻהָר',
    'timeout': 'הַזְמָן חָלַף',
    'wrong-target': 'מִטָּרָה שֶׁלֹּא זֻהֲתָה',
  };
  return map[kind] ?? kind;
}

/* ---------- shared bits ---------- */

function gentleIllustration(glyph: string): HTMLElement {
  return h('div', { class: 'parent-gentle', 'aria-hidden': 'true' },
    h('span', { class: 'parent-gentle-icon' }, glyph),
  );
}

export interface ChartSet {
  weekly: HTMLElement;
  strengths: HTMLElement;
  blooming: HTMLElement;
  errors: HTMLElement;
}

export function buildCharts(data: LensData): ChartSet {
  return {
    weekly: weeklyChart(data.days),
    strengths: strengthsChart(data.player),
    blooming: bloomingChart(data.garden.zones, data.graph.progress(), (zoneId) => {
      const z = data.garden.zones[zoneId];
      const fromMap = data.garden.finished?.[zoneId] ?? 0;
      return Math.max(fromMap, z?.finished ?? 0);
    }),
    errors: errorDonut(data.summary.errorKinds),
  };
}
