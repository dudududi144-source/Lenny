import { PlayerModel } from '../../games/core/PlayerModel';
import { LearningSignals } from '../../games/core/LearningSignals';
import { bloomLevel, finishedCount, type GardenData } from '../../games/core/ProgressStore';
import { LITERACY_GRAPH, SkillGraph } from '../../games/core/SkillGraph';
import { ZONES } from '../../data/garden';
import { uiButton } from './common/Button';
import { h, svg } from './common/el';

export interface ParentLensCallbacks {
  loadGarden(): GardenData;
  onExit(): void;
}

export interface ParentLensHandle {
  root: HTMLElement;
  /** Shows the adult gate (fresh question each open). */
  open(): void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function bar(fraction: number, color: string): HTMLElement {
  const fill = h('span', { class: 'parent-bar-fill' });
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  fill.style.background = color;
  return h('span', { class: 'parent-bar', role: 'img', 'aria-label': `${Math.round(fraction * 100)}%` }, fill);
}

function donut(fraction: number, label: string): HTMLElement {
  const size = 92;
  const r = 38;
  const c = 2 * Math.PI * r;
  const ring = svg(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'parent-donut-svg', 'aria-hidden': 'true' },
    svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 9 }),
    svg('circle', {
      cx: size / 2,
      cy: size / 2,
      r,
      fill: 'none',
      stroke: 'url(#parent-donut-gold)',
      'stroke-width': 9,
      'stroke-linecap': 'round',
      'stroke-dasharray': c,
      'stroke-dashoffset': c * (1 - Math.min(1, Math.max(0, fraction))),
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
    }),
  );
  const text = h('span', { class: 'parent-donut-text' }, label);
  return h('div', { class: 'parent-donut' }, ring, text);
}

/**
 * ParentLens — the adult dashboard.
 * Opens behind an adult gate (a multiplication question, ported from the
 * original ParentLensScene), then renders the child's learning picture
 * from the untouched cognitive core: garden progress, skill graph,
 * signals summary and player-model insights — warm, process-focused
 * language only (per docs/ETHICS.md).
 */
export function createParentLens(callbacks: ParentLensCallbacks): ParentLensHandle {
  const gate = h('div', { class: 'parent-gate' });
  const dashboard = h('div', { class: 'parent-dashboard', hidden: true });

  const root = h(
    'section',
    { class: 'screen screen--parent hidden', id: 'parent-screen', 'aria-label': 'פינת ההורים' },
    h('div', { class: 'parent-scroll' }, gate, dashboard),
  );

  function showGate(): void {
    dashboard.hidden = true;
    gate.hidden = false;
    gate.replaceChildren();

    const a = 6 + Math.floor(Math.random() * 4);
    const b = 4 + Math.floor(Math.random() * 4);
    const answer = a * b;
    const options = shuffle([
      answer,
      answer + 1 + Math.floor(Math.random() * 4),
      Math.max(2, answer - 1 - Math.floor(Math.random() * 4)),
    ]);

    const feedback = h('p', { class: 'parent-gate-feedback', 'aria-live': 'polite' });
    gate.append(
      h('div', { class: 'parent-gate-card' },
        h('h2', { class: 'parent-title' }, 'פִּנַּת הַהוֹרִים'),
        h('p', { class: 'parent-gate-line' }, 'הַפִּנָּה הַזּוֹת מְיֻעֶדֶת לִמְבוּגָרִים בִּלְבַד.'),
        h('p', { class: 'parent-gate-question', id: 'parent-question' }, `כַּמָּה זֶה ${a} × ${b}?`),
        h(
          'div',
          { class: 'parent-gate-options' },
          ...options.map((value) =>
            uiButton({
              label: String(value),
              variant: 'secondary',
              onPress: () => {
                if (value === answer) {
                  showDashboard();
                } else {
                  feedback.textContent = 'תְּשׁוּבָה שְׁגוּיָה — נַסּוּ שׁוּב.';
                }
              },
            }),
          ),
        ),
        feedback,
        uiButton({ label: '→ חזרה', variant: 'ghost', onPress: () => callbacks.onExit() }),
      ),
    );
  }

  function showDashboard(): void {
    gate.hidden = true;
    dashboard.hidden = false;
    dashboard.replaceChildren();

    const garden = callbacks.loadGarden();
    const player = new PlayerModel();
    const signals = new LearningSignals();
    const graph = new SkillGraph(LITERACY_GRAPH);
    const summary = signals.summarize();

    const totalFinished = ZONES.reduce((sum, zone) => sum + finishedCount(garden, zone.id), 0);
    const bloom = bloomLevel(garden);

    /* header */
    dashboard.append(
      h(
        'header',
        { class: 'parent-head' },
        h('div', {},
          h('h2', { class: 'parent-title' }, 'מַה שֶּׁהַגַּן מְסַפֵּר'),
          h('p', { class: 'parent-sub' }, 'מַבָּט חַם עַל הַמַּסָּע — לְלֹא שִׁפּוּט, רַק צְמִיחָה.'),
        ),
        uiButton({ label: '→ חזרה', variant: 'ghost', onPress: () => callbacks.onExit() }),
      ),
    );

    /* overview */
    dashboard.append(
      h(
        'div',
        { class: 'parent-cards' },
        h('div', { class: 'parent-card parent-card--overview' },
          donut(ZONES.length ? totalFinished / (ZONES.length * 3) : 0, `${totalFinished} השלמות`),
          h('div', { class: 'parent-overview-lines' },
            h('p', {}, `פְּרִיחָה בַּגַּן: רָמָה ${bloom}`),
            h('p', {}, `אוֹרוֹת שֶׁנִדְלְקוּ: ${garden.lights}`),
            summary.masteredSkills.length
              ? h('p', {}, `מְיֻמָּחִים: ${summary.masteredSkills.join(' · ')}`)
              : h('p', {}, 'הַיּוֹם עוֹד לֹא נִפְתְּחוּ מְיֻמָּחִים — וְזֶה בְּסֵדֶר גָּמוּר.'),
          ),
        ),
      ),
    );

    /* per-zone journey */
    dashboard.append(
      h(
        'div',
        { class: 'parent-card' },
        h('h3', { class: 'parent-card-title' }, 'הַדֶּרֶךְ בָּאֲזוֹרִים'),
        h(
          'div',
          { class: 'parent-zones' },
          ...ZONES.map((zone) => {
            const done = finishedCount(garden, zone.id);
            const stat = player.snapshot().zones[zone.id];
            return h(
              'div',
              { class: 'parent-zone-row' },
              h('span', { class: 'parent-zone-name' }, zone.name),
              bar(Math.min(1, done / 3), zone.uiColor),
              h('span', { class: 'parent-zone-count' }, `${done}`),
              h('span', { class: 'parent-zone-tempo' }, stat ? { fast: 'מהיר', steady: 'יציב', careful: 'בנונח', unknown: '' }[player.tempo(zone.id)] ?? '' : ''),
            );
          }),
        ),
      ),
    );

    /* skills */
    const acquired = LITERACY_GRAPH.filter((node) => graph.isAcquired(node.id)).map((node) => node.label);
    const frontier = graph.frontier().map((id) => LITERACY_GRAPH.find((n) => n.id === id)?.label ?? id);
    dashboard.append(
      h(
        'div',
        { class: 'parent-card' },
        h('h3', { class: 'parent-card-title' }, 'מִגְדַּל הַמִּיָּמָחוֹת'),
        h('div', { class: 'parent-skill-row' }, bar(graph.progress(), 'linear-gradient(135deg,#ffd76a,#f2549a)'), h('span', { class: 'parent-zone-count' }, `${Math.round(graph.progress() * 100)}%`)),
        acquired.length ? h('p', { class: 'parent-line' }, `נִרְכְּשׁוּ: ${acquired.join(' · ')}`) : null,
        frontier.length ? h('p', { class: 'parent-line' }, `בַּפֶּתַח: ${frontier.join(' · ')}`) : null,
      ),
    );

    /* signals */
    const errorKinds = Object.entries(summary.errorKinds).sort((x, y) => y[1] - x[1]).slice(0, 3);
    dashboard.append(
      h(
        'div',
        { class: 'parent-card' },
        h('h3', { class: 'parent-card-title' }, 'אוֹתוֹת הַלְמִידָה'),
        h('p', { class: 'parent-line' }, `נִסְיוֹנוֹת: ${summary.attempts} · הַצְלָחוֹת: ${summary.correct} · עִזְרָה שֶׁנִּדְרְשָׁה: ${summary.hints}`),
        errorKinds.length
          ? h('p', { class: 'parent-line' }, `סוּגֵי טָעוּיָה נָפוּצִים: ${errorKinds.map(([kind, count]) => `${kind} (${count})`).join(' · ')}`)
          : h('p', { class: 'parent-line' }, 'עַדַּיִן אֵין טָעוּיָּת מִפְתַּח — הַכֹּל בִּקְצֶב שֶׁל הַיֶּלֶד.'),
        player.interest() ? h('p', { class: 'parent-line' }, `תַּחוּמִּים חֲבִיבִים כָּרֶגַע: ${player.interest()}`) : null,
        player.strengths().length ? h('p', { class: 'parent-line' }, `חֲזָקִים: ${player.strengths().join(' · ')}`) : null,
      ),
    );
  }

  return {
    root,
    open() {
      showGate();
    },
  };
}
