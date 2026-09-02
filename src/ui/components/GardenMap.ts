import { gamesInZone } from '../../games/builder/GameRegistry';
import { GARDEN_TEXT, ZONES, type ZoneDef } from '../../data/garden';
import {
  finishedCount,
  freshGarden,
  bloomLevel,
  isUnlocked,
  LocalProgressStore,
  unlockRequirement,
  zoneName,
  consumeNewZones,
  type GardenData,
} from '../../games/core/ProgressStore';
import { ZONE_ICONS } from './zoneIcons';
import { bloomStageFor, buildLifeLayer, buildZoneGrowth, type BloomStage } from './gardenLife';
import { zoneCatalog } from '../../content/catalog';
import { phaseNow, type DayPhase } from '../../content/dayCycle';
import { uiButton } from './common/Button';
import { ProgressRing } from './common/ProgressRing';
import { h, svg } from './common/el';

export interface GardenMapCallbacks {
  onBack(): void;
  onZone(zoneId: string): void;
  onLockedTap(zoneId: string): void;
  onFreshZones(zoneIds: string[]): void;
  /** Stage-5: quiet entrance for the grown-ups (bottom corner). */
  onParents?(): void;
}

export interface GardenMapHandle {
  root: HTMLElement;
  setGreeting(lines: string): void;
  /** Rebuilds the zone cards from current progress (call on every open). */
  refresh(): void;
}

const store = new LocalProgressStore();

function loadGarden(): GardenData {
  try {
    return store.load();
  } catch {
    return freshGarden();
  }
}

/** Serpentine golden ribbon behind the zone cards; draws itself on load. */
/* ---------- daylight (Stage 6, commit 7): visual-only hour phases ---------- */

function dayObj(cls: string, left: string, top: string, svgHtml: string): HTMLElement {
  const el = h('span', { class: `day-obj ${cls}`, style: `left:${left};top:${top};--d:${(left.length % 5) + 1}s` });
  el.innerHTML = svgHtml;
  return el;
}

const MOON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z" fill="#f3ecd0"/></svg>';
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9l.9 2.1L15 12l-2.1.9L12 15l-.9-2.1L9 12l2.1-.9Z" fill="#fff7d6"/></svg>';
const FIREFLY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.2" fill="#ffe9a6" opacity="0.24"/><circle cx="12" cy="12" r="1.7" fill="#fff7d6"/></svg>';
const BUTTERFLY_SVG = (tint: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="8.6" cy="10.6" rx="4.4" ry="3.1" transform="rotate(-24 8.6 10.6)" fill="${tint}" opacity="0.92"/><ellipse cx="15.4" cy="10.6" rx="4.4" ry="3.1" transform="rotate(24 15.4 10.6)" fill="${tint}" opacity="0.92"/><ellipse cx="9.4" cy="14.2" rx="3" ry="2.2" fill="${tint}" opacity="0.7"/><ellipse cx="14.6" cy="14.2" rx="3" ry="2.2" fill="${tint}" opacity="0.7"/><rect x="11.3" y="7.4" width="1.4" height="8.4" rx="0.7" fill="#4a3560"/></svg>`;

/**
 * Build the two atmosphere layers (tint veil + ambient objects) once,
 * then swap the phase attribute — CSS crossfades the veils over 5s.
 */
export function createDaylight(root: HTMLElement): { apply(): void } {
  const veil = h(
    'div',
    { class: 'daylight-veil veil-morning', 'aria-hidden': 'true' },
  );
  const veilMid = h('div', { class: 'daylight-veil veil-midday', 'aria-hidden': 'true' });
  const veilEve = h('div', { class: 'daylight-veil veil-evening', 'aria-hidden': 'true' });
  const veilNight = h('div', { class: 'daylight-veil veil-night', 'aria-hidden': 'true' });
  const ambient = h('div', { class: 'daylight-ambient', id: 'daylight-ambient', 'aria-hidden': 'true' });
  root.prepend(veilNight, veilEve, veilMid, veil, ambient);

  let lastPhase: DayPhase | null = null;

  function fill(phase: DayPhase): void {
    ambient.replaceChildren();
    const put = (cls: string, svgHtml: string, spots: Array<[string, string]>): void => {
      for (const [l, t] of spots) ambient.append(dayObj(cls, l, t, svgHtml));
    };
    if (phase === 'morning') {
      put('morning-only day-butterfly', BUTTERFLY_SVG('#ffd76a'), [['22%', '30%'], ['58%', '22%'], ['80%', '38%']]);
      put('morning-only day-butterfly', BUTTERFLY_SVG('#7dffb8'), [['40%', '46%']]);
    } else if (phase === 'midday') {
      put('midday-only day-butterfly', BUTTERFLY_SVG('#f2549a'), [['30%', '26%'], ['70%', '34%']]);
    } else if (phase === 'evening') {
      put('evening-only day-star', STAR_SVG, [['14%', '12%'], ['82%', '18%']]);
    } else {
      put('night-only day-moon', MOON_SVG, [['84%', '9%']]);
      put('night-only day-star', STAR_SVG, [['10%', '10%'], ['26%', '18%'], ['45%', '8%'], ['62%', '16%'], ['74%', '24%'], ['92%', '30%']]);
      put('night-only day-firefly', FIREFLY_SVG, [['18%', '58%'], ['38%', '70%'], ['55%', '52%'], ['72%', '64%']]);
    }
  }

  return {
    apply(): void {
      const phase = phaseNow();
      if (phase === lastPhase) return;
      lastPhase = phase;
      root.dataset.daylight = phase;
      root.setAttribute('data-daylight', phase);
      fill(phase);
    },
  };
}

/** Serpentine golden ribbon behind the zone cards; draws itself on load. */
function ribbonSvg(): SVGSVGElement {
  return svg(
    'svg',
    {
      class: 'path-ribbon',
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    },
    svg(
      'defs',
      {},
      svg(
        'linearGradient',
        { id: 'ribbon-gold', x1: '0', y1: '0', x2: '0.35', y2: '1' },
        svg('stop', { offset: '0', 'stop-color': '#ffd76a', 'stop-opacity': '0.1' }),
        svg('stop', { offset: '0.5', 'stop-color': '#ffd76a', 'stop-opacity': '0.85' }),
        svg('stop', { offset: '1', 'stop-color': '#f2549a', 'stop-opacity': '0.55' }),
      ),
    ),
    svg('path', {
      class: 'ribbon-glow',
      d: 'M50,0 C86,12 14,26 50,38 C86,50 14,62 50,74 C86,86 30,92 50,100',
      fill: 'none',
      stroke: 'url(#ribbon-gold)',
      'stroke-width': '9',
      'stroke-linecap': 'round',
      pathLength: 1,
      'vector-effect': 'non-scaling-stroke',
      opacity: 0.28,
    }),
    svg('path', {
      class: 'ribbon-core',
      d: 'M50,0 C86,12 14,26 50,38 C86,50 14,62 50,74 C86,86 30,92 50,100',
      fill: 'none',
      stroke: 'url(#ribbon-gold)',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      pathLength: 1,
      'vector-effect': 'non-scaling-stroke',
    }),
  );
}

function lockChip(): HTMLElement {
  const icon = svg(
    'svg',
    { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' },
    svg('path', {
      d: 'M8 10.5V8a4 4 0 1 1 8 0v2.5',
      fill: 'none',
      stroke: 'rgba(255,246,236,0.75)',
      'stroke-width': '2',
      'stroke-linecap': 'round',
    }),
    svg('rect', {
      x: 5.5,
      y: 10.5,
      width: 13,
      height: 9,
      rx: 3,
      fill: 'rgba(255,246,236,0.14)',
      stroke: 'rgba(255,246,236,0.75)',
      'stroke-width': '1.6',
    }),
    svg('circle', { cx: 12, cy: 15, r: 1.6, fill: 'rgba(255,246,236,0.85)' }),
  );
  return h('span', { class: 'lock-chip', 'aria-hidden': 'true' }, icon);
}

function zoneCard(
  zone: ZoneDef,
  data: GardenData,
  freshIds: Set<string>,
  animateBloom: boolean,
  callbacks: GardenMapCallbacks,
): HTMLButtonElement {
  const unlocked = isUnlocked(data, zone.id);
  const done = finishedCount(data, zone.id);
  const total = Math.max(1, gamesInZone(zone.id).length);
  const fresh = freshIds.has(zone.id);

  const iconHolder = h('span', { class: 'zone-icon', 'aria-hidden': 'true' });
  iconHolder.innerHTML = ZONE_ICONS[zone.id] ?? '';

  let slot: HTMLElement;
  if (unlocked) {
    const ring = new ProgressRing({ size: 52, stroke: 5, ariaLabel: `${zone.name}: ${Math.min(done, total)} מתוך ${total}` });
    /* the ring counts the milestone spine; the flowers below carry the
       ongoing growth — clamp so a deep run never renders 7/3 */
    ring.setCounts(Math.min(done, total), total);
    /* Stage 6: the zone's visible growth — one flower per finished game */
    slot = h(
      'span',
      { class: 'zone-slot', 'data-growth': zone.id },
      ring.el,
      buildZoneGrowth(zone.uiColor, done, 6, animateBloom),
    );
  } else {
    slot = h('span', { class: 'zone-slot' }, lockChip());
  }

  const req = unlocked ? null : unlockRequirement(zone.id);
  const lockHint =
    req && req.from
      ? `${done}/${req.needed} ב${zoneName(req.from)} — שַׂחֲקוּ שָׁם כְּדֵי לִפְתֹּחַ`
      : GARDEN_TEXT.lockedSoon;

  const card = h(
    'button',
    {
      class: `zone-card${unlocked ? '' : ' locked'}${fresh ? ' fresh' : ''}`,
      type: 'button',
      'data-zone': zone.id,
      style: `--zc: ${zone.uiColor}`,
      'aria-label': unlocked ? `${zone.name} — ${zone.desc}` : `${zone.name} — נָעוּל`,
      onClick: () => {
        if (unlocked) {
          callbacks.onZone(zone.id);
          return;
        }
        /* gentle feedback, never a dead click */
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        callbacks.onLockedTap(zone.id);
      },
    },
    iconHolder,
    h(
      'span',
      { class: 'zone-body' },
      h('span', { class: 'zone-name' }, zone.name),
      h('span', { class: 'zone-desc' }, zone.desc),
      unlocked
        ? h('span', { class: 'zone-count' }, `${zoneCatalog(zone.id).length} מִשְׂחָקִים`)
        : null,
      unlocked ? null : h('span', { class: 'zone-lockhint' }, lockHint),
    ),
    slot,
    fresh ? h('span', { class: 'new-badge' }, 'חָדָשׁ!') : null,
  );

  return card;
}

/**
 * The garden journey map: glass zone cards along a self-drawing golden
 * ribbon, progress rings, lock states and fresh-zone celebration.
 * Unlock logic comes straight from ProgressStore (untouched cognitive core).
 */
export function createGardenMap(callbacks: GardenMapCallbacks): GardenMapHandle {
  const greeting = h('p', { class: 'garden-greeting', id: 'garden-greeting' });

  /* light counter — the garden's collectible currency (core-managed) */
  const lightChip = h(
    'span',
    { class: 'light-chip', id: 'light-chip', 'aria-label': 'אורות שנאספו' },
    h('span', { class: 'light-star', 'aria-hidden': 'true' }, '✦'),
    h('span', { class: 'light-count', id: 'light-count' }, '0'),
  );

  const path = h('div', { class: 'garden-path', id: 'garden-path' });
  path.append(ribbonSvg());

  const back = uiButton({
    label: '→ חזרה',
    variant: 'ghost',
    id: 'garden-back',
    ariaLabel: 'חזרה למסך הפתיחה',
    onPress: callbacks.onBack,
  });

  const root = h(
    'section',
    { class: 'screen screen--garden hidden', id: 'garden-screen', 'aria-label': 'מפת הגן' },
    h(
      'header',
      { class: 'garden-head' },
      h(
        'div',
        {},
        h('h2', { class: 'garden-title' }, 'הַגַּן שֶׁל לֶנִי'),
        h('p', { class: 'garden-sub' }, 'בַּחֲרִי אָן רוֹצִים לְשַׂחֵק'),
      ),
      h('div', { class: 'garden-head-side' }, lightChip, back),
    ),
    greeting,
    path,
    h(
      'div',
      { class: 'garden-foot' },
      h(
        'button',
        {
          class: 'garden-parents-link',
          id: 'garden-parent-link',
          type: 'button',
          'aria-label': 'פינת ההורים',
          onClick: () => callbacks.onParents?.(),
        },
        'לְהוֹרִים',
      ),
    ),
  );

  /* Stage 6: the hour's atmosphere (tint veil + moon/stars/butterflies),
     refreshed with the garden and every half minute (5s crossfades) */
  const daylight = createDaylight(root);
  daylight.apply();
  window.setInterval(() => daylight.apply(), 30_000);

  let list: HTMLElement | null = null;
  let lastLights = -1;
  /* Stage 6: bloom-ladder + per-zone payoff bookkeeping */
  let prevCounts: Record<string, number> | null = null;
  let lifeLayer: HTMLElement | null = null;
  let lastStage: BloomStage | null = null;

  function refresh(): void {
    const data = loadGarden();
    const freshIds = new Set(consumeNewZones());
    if (freshIds.size > 0) callbacks.onFreshZones([...freshIds]);

    /* light counter + celebration pulse when it grows */
    const lights = data.lights || 0;
    lightChip.querySelector('.light-count')!.textContent = String(lights);
    if (lastLights >= 0 && lights > lastLights) {
      lightChip.classList.remove('pulse');
      void lightChip.offsetWidth;
      lightChip.classList.add('pulse');
    }
    lastLights = lights;

    /* Stage 6: which zone GREW since the last visit? Its newest flower
       opens with the bloom-in payoff exactly when the child returns. */
    const grewZones = new Set<string>();
    const nextCounts: Record<string, number> = {};
    for (const zone of ZONES) {
      const done = finishedCount(data, zone.id);
      nextCounts[zone.id] = done;
      if (prevCounts && done > (prevCounts[zone.id] ?? 0)) grewZones.add(zone.id);
    }
    prevCounts = nextCounts;

    /* the garden life layer follows the global bloom ladder (0..5);
       rebuilt only when the stage changes so animations never replay */
    const stage = bloomStageFor(bloomLevel(data));
    if (stage !== lastStage || !lifeLayer) {
      lifeLayer?.remove();
      lifeLayer = buildLifeLayer(stage);
      path.insertBefore(lifeLayer, path.firstChild);
      lastStage = stage;
    }

    list?.remove();
    list = h('div', { class: 'zone-list' });
    ZONES.forEach((zone, i) => {
      const card = zoneCard(zone, data, freshIds, grewZones.has(zone.id), callbacks);
      card.style.setProperty('--i', String(i));
      list!.append(card);
    });
    path.append(list);
  }

  return {
    root,
    setGreeting(lines: string) {
      greeting.textContent = lines;
    },
    refresh,
  };
}
