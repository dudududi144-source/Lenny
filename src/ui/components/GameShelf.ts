import { CATEGORIES } from '../../data/games';
import type { GameSpec } from '../../games/builder/GameSpec';
import { zoneCatalog, tierUnlocked, tierMissing, displayNameFor } from '../../content/catalog';
import { zoneName } from '../../games/core/ProgressStore';
import { specsForBand, BAND_NAMES, type StationBand } from '../../world/WorldStations';
import { ZONE_ICONS } from './zoneIcons';
import { h } from './common/el';

export interface GameShelfCallbacks {
  /** The child picked an open game — the host swaps the scene. */
  onPick(spec: GameSpec): void;
  /** The shelf closed without a pick — the host un-freezes the scene. */
  onClose?(): void;
}

export interface GameShelfHandle {
  root: HTMLElement;
  /** Build the shelf for a zone and slide it in. A band narrows the
   *  shelf to one clearing's games (stage 14); null = the whole zone. */
  open(zoneId: string, activeSpecId: string | null, band?: StationBand | null): void;
  close(): void;
  isOpen(): boolean;
}

/** Optional shell metadata (Stage 7): a distinct DOM id when more than
 *  one shelf lives on the page (the world has its own). */
export interface GameShelfOptions {
  id?: string;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function tierDots(spec: GameSpec): HTMLElement {
  const dots = h('span', { class: 'shelf-dots', role: 'img', 'aria-label': `דַּרְגָּה ${spec.baseTier + 1} מִתּוֹךְ 4` });
  for (let i = 0; i < 4; i++) {
    dots.append(h('span', { class: `shelf-dot${i <= spec.baseTier ? ' is-on' : ''}` }));
  }
  return dots;
}

function lockChipSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', '16');
  s.setAttribute('height', '16');
  s.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of [
    ['path', { d: 'M8 10.5V8a4 4 0 1 1 8 0v2.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }],
    ['rect', { x: 5.5, y: 10.5, width: 13, height: 9, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }],
  ] as Array<[string, Record<string, string>]>) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    s.append(el);
  }
  return s;
}

/**
 * GameShelf — the in-zone game picker (Stage 6, commit 2).
 *
 * Slides over the game screen as a horizontal row of glass cards:
 * every game of the zone (seed spine + the 16 derived specs), each
 * with the zone icon tinted by its category, its name, difficulty
 * dots and the honest lock state (tier opens when a previous-tier
 * game of the same category was completed ×3).
 *
 * The zone tap still opens the default game directly — the shelf is
 * the optional "which game?" layer, never a gate in front of play.
 */
export function createGameShelf(callbacks: GameShelfCallbacks, options: GameShelfOptions = {}): GameShelfHandle {
  const row = h('div', { class: 'shelf-row', id: options.id ? `${options.id}-row` : 'shelf-row', role: 'list' });
  const title = h('h3', { class: 'shelf-title' }, '');
  const closeBtn = h(
    'button',
    { class: 'hud-icon-btn shelf-close', id: options.id ? `${options.id}-close` : 'shelf-close', type: 'button', 'aria-label': 'סגירת מדף המשחקים', onClick: () => close() },
    '✕',
  );
  const panel = h(
    'div',
    { class: 'shelf-panel', role: 'document' },
    h('div', { class: 'shelf-head' }, title, closeBtn),
    row,
  );
  const root = h(
    'div',
    { class: 'game-shelf hidden', id: options.id ?? 'game-shelf', 'aria-hidden': 'true', tabindex: '-1' },
    h('div', { class: 'shelf-backdrop', onClick: () => close() }),
    panel,
  );

  /* round C a11y: keyboard children get the shelf too — open hands
     focus to the panel, Esc closes, close returns focus home */
  let lastFocus: HTMLElement | null = null;
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !root.classList.contains('hidden')) {
      ev.stopPropagation();
      close();
    }
  });

  function close(): void {
    if (root.classList.contains('hidden')) return;
    root.classList.remove('is-open');
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    if (lastFocus && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
    callbacks.onClose?.();
  }

  function build(zoneId: string, activeSpecId: string | null, band: StationBand | null): void {
    const all = zoneCatalog(zoneId);
    const specs = band === null || band === undefined ? all : specsForBand(all, band);
    title.textContent =
      band === null || band === undefined
        ? `מִשְׂחָקִים בְּ${zoneName(zoneId)}`
        : `${BAND_NAMES[band]} · ${zoneName(zoneId)}`;
    row.replaceChildren();

    for (const spec of specs) {
      /* the game the garden's path brought the child to is ALWAYS open —
         the shelf lock governs free choice, never the guided journey */
      const unlocked = tierUnlocked(spec.category, spec.baseTier) || spec.id === activeSpecId;
      const missing = unlocked ? 0 : tierMissing(spec.category, spec.baseTier);
      const current = spec.id === activeSpecId;

      const iconHolder = h('span', { class: 'shelf-icon', 'aria-hidden': 'true' });
      iconHolder.innerHTML = ZONE_ICONS[zoneId] ?? '';

      const card = h(
        'button',
        {
          class: `shelf-card${unlocked ? '' : ' locked'}${current ? ' current' : ''}`,
          type: 'button',
          role: 'listitem',
          'data-spec': spec.id,
          'data-tier': String(spec.baseTier),
          'aria-label': current
            ? `${spec.id} — הַמִּשְׂחָק הַנּוֹכְחִי`
            : unlocked
              ? `${spec.id} — שִׂחֲקוּ עַכְשָׁו`
              : `${spec.id} — נָעוּל, עוֹד ${missing} הַשְׁלָמוֹת`,
          style: `--sc: ${hex(CATEGORIES[spec.category].color)}`,
          disabled: !unlocked,
          onClick: () => {
            if (!unlocked) return;
            close();
            callbacks.onPick(spec);
          },
        },
        iconHolder,
        h('span', { class: 'shelf-name' }, displayNameFor(spec)),
        tierDots(spec),
        unlocked
          ? h('span', { class: 'shelf-go', 'aria-hidden': 'true' }, '▶')
          : h(
              'span',
              { class: 'shelf-lockhint' },
              lockChipSvg(),
              ` עוֹד ${missing} הַשְׁלָמוֹת`,
            ),
      );
      row.append(card);
    }
  }

  function open(zoneId: string, activeSpecId: string | null, band?: StationBand | null): void {
    build(zoneId, activeSpecId, band ?? null);
    root.classList.remove('hidden');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    /* the shelf is where the child's attention is — the keyboard's
       focus follows it, and Esc + Tab work from here (round C a11y) */
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.focus({ preventScroll: true });
  }

  return { root, open, close, isOpen: () => !root.classList.contains('hidden') };
}
