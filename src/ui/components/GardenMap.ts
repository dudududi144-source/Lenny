import { gamesInZone } from '../../games/builder/GameRegistry';
import { GARDEN_TEXT, ZONES, type ZoneDef } from '../../data/garden';
import {
  finishedCount,
  freshGarden,
  isUnlocked,
  LocalProgressStore,
  unlockRequirement,
  zoneName,
  consumeNewZones,
  type GardenData,
} from '../../games/core/ProgressStore';
import { ZONE_ICONS } from './zoneIcons';
import { uiButton } from './common/Button';
import { ProgressRing } from './common/ProgressRing';
import { h, svg } from './common/el';

export interface GardenMapCallbacks {
  onBack(): void;
  onZone(zoneId: string): void;
  onLockedTap(zoneId: string): void;
  onFreshZones(zoneIds: string[]): void;
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

function zoneCard(zone: ZoneDef, data: GardenData, freshIds: Set<string>, callbacks: GardenMapCallbacks): HTMLButtonElement {
  const unlocked = isUnlocked(data, zone.id);
  const done = finishedCount(data, zone.id);
  const total = Math.max(1, gamesInZone(zone.id).length);
  const fresh = freshIds.has(zone.id);

  const iconHolder = h('span', { class: 'zone-icon', 'aria-hidden': 'true' });
  iconHolder.innerHTML = ZONE_ICONS[zone.id] ?? '';

  let slot: HTMLElement;
  if (unlocked) {
    const ring = new ProgressRing({ size: 52, stroke: 5, ariaLabel: `${zone.name}: ${done} מתוך ${total}` });
    ring.setCounts(done, total);
    slot = h('span', { class: 'zone-slot' }, ring.el);
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
  );

  let list: HTMLElement | null = null;
  let lastLights = -1;

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

    list?.remove();
    list = h('div', { class: 'zone-list' });
    ZONES.forEach((zone, i) => {
      const card = zoneCard(zone, data, freshIds, callbacks);
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
