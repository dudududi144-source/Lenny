import { ProgressRing } from './common/ProgressRing';
import { createDialogue, type DialogueHandle } from './common/Dialogue';
import { h } from './common/el';
import { audio } from '../../games/engine/AudioEngine';

export interface HudBridge {
  say(lines: string | string[], onDone?: () => void): void;
  ringSet(fraction: number): void;
  ringCounts(done: number, total: number): void;
  ringReset(): void;
  /** Arena extensions (implemented by HUD v2; optional for compat) */
  score?(points: number): void;
  combo?(count: number, mult: number): void;
  mission?(text: string | null): void;
  pauseEnabled?(on: boolean): void;
}

export interface GameHUDHandle {
  root: HTMLElement;
  bridge: HudBridge;
  setZone(name: string): void;
  clear(): void;
  /** Stage-5: staggered HUD entrance (top → mission → dialogue). */
  playEnter(): void;
}

export interface GameHUDCallbacks {
  onBack(): void;
  onPauseToggle?(paused: boolean): void;
  /** Stage 6: open the in-zone game shelf (additive, optional). */
  onShelf?(): void;
}

const muteIcon = (muted: boolean): string =>
  muted
    ? 'M4 9v6h4l5 4V5L8 9H4z M16 9l5 6 M21 9l-5 6'
    : 'M4 9v6h4l5 4V5L8 9H4z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12';

function svgIcon(paths: string): SVGSVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', '20');
  s.setAttribute('height', '20');
  s.setAttribute('aria-hidden', 'true');
  for (const d of paths.split(' M')) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d.startsWith('M') ? d : `M${d}`);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.9');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
  }
  return s;
}

/**
 * GameHUD v2 (Arena) — the commercial game chrome floating above the
 * Pixi canvas: back + zone + progress ring, live score chip, combo
 * flame meter, mission chip, mute and pause with a full pause menu.
 * Stays in the DOM for CSS styling + accessibility.
 */
export function createGameHUD(callbacks: GameHUDCallbacks): GameHUDHandle {
  const ring = new ProgressRing({ size: 46, stroke: 5, ariaLabel: 'התקדמות הסבב' });
  const dialogue: DialogueHandle = createDialogue({ className: 'hud-dialogue' });

  /* score chip (hidden until the scene scores) */
  const scoreChip = h('span', { class: 'hud-score is-off', id: 'hud-score', 'aria-label': 'נקודות' }, '0');
  /* combo flame (hidden until combo >= 2) */
  const comboChip = h(
    'span',
    { class: 'hud-combo is-off', id: 'hud-combo' },
    h('span', { class: 'combo-flame', 'aria-hidden': 'true' }, '🔥'),
    h('span', { class: 'combo-mult', id: 'hud-combo-mult' }, 'x2'),
  );
  /* mission chip */
  const missionChip = h('span', { class: 'hud-mission is-off', id: 'hud-mission', role: 'status' });

  /* mute */
  let muted = audio.isMuted();
  const muteBtn = h(
    'button',
    {
      class: 'hud-icon-btn',
      id: 'hud-mute',
      type: 'button',
      'aria-label': muted ? 'הפעלת צלילים' : 'השתקת צלילים',
      'aria-pressed': String(muted),
      onClick: () => {
        muted = audio.toggleMute();
        muteBtn.replaceChildren(svgIcon(muteIcon(muted)));
        muteBtn.setAttribute('aria-label', muted ? 'הפעלת צלילים' : 'השתקת צלילים');
        muteBtn.setAttribute('aria-pressed', String(muted));
      },
    },
    svgIcon(muteIcon(muted)),
  );

  /* shelf (Stage 6 — the zone's game list) */
  const shelfBtn = h(
    'button',
    {
      class: 'hud-icon-btn',
      id: 'hud-shelf',
      type: 'button',
      'aria-label': 'מדף המשחקים של האזור',
      onClick: () => callbacks.onShelf?.(),
    },
    svgIcon('M4 6h16 M4 12h16 M4 18h10 M17 15l3 3 3-3'),
  );

  /* pause */
  let paused = false;
  const pauseBtn = h(
    'button',
    {
      class: 'hud-icon-btn is-off',
      id: 'hud-pause',
      type: 'button',
      'aria-label': 'השהיה',
      'aria-expanded': 'false',
      onClick: () => setPaused(!paused),
    },
    svgIcon('M8 5v14 M16 5v14'),
  );

  const setPaused = (value: boolean): void => {
    paused = value;
    pauseBtn.setAttribute('aria-expanded', String(value));
    pauseBtn.setAttribute('aria-label', value ? 'המשך' : 'השהיה');
    pauseBtn.replaceChildren(svgIcon(value ? 'M9 5l11 7-11 7V5z' : 'M8 5v14 M16 5v14'));
    overlay.classList.toggle('is-off', !value);
    callbacks.onPauseToggle?.(value);
  };

  const overlay = h(
    'div',
    { class: 'hud-pause-overlay is-off', id: 'hud-pause-overlay', role: 'dialog', 'aria-label': 'תפריט השהיה' },
    h('div', { class: 'pause-panel' }, h('h3', {}, 'הַפְסָקָה'), h('p', {}, 'נוּחִים קָטָן? לְאָן נֵלֵךְ עַכְשָׁיו?')),
    h(
      'div',
      { class: 'pause-actions' },
      h('button', { class: 'ui-btn ui-btn--ghost', id: 'pause-resume', type: 'button', onClick: () => setPaused(false) }, '← נַמְשִׁיךְ לִשְׂחָק'),
      h('button', { class: 'ui-btn ui-btn--ghost', id: 'pause-exit', type: 'button', onClick: () => { setPaused(false); callbacks.onBack(); } }, 'הַגַּן'),
    ),
  );

  const root = h(
    'div',
    { class: 'game-hud', id: 'game-hud' },
    h(
      'div',
      { class: 'hud-top' },
      h('button', { class: 'ui-btn ui-btn--ghost', id: 'game-back', type: 'button', 'aria-label': 'חזרה לגן', onClick: () => { setPaused(false); callbacks.onBack(); } }, '→ הַגַּן'),
      h('span', { class: 'hud-zone', id: 'hud-zone' }),
      scoreChip,
      comboChip,
      h('span', { class: 'hud-ring', id: 'hud-ring' }, ring.el),
      shelfBtn,
      muteBtn,
      pauseBtn,
    ),
    h('div', { class: 'hud-mission-row' }, missionChip),
    h('div', { class: 'hud-spacer' }),
    h('div', { class: 'hud-bottom' }, h('div', { class: 'hud-dialogue-slot', id: 'hud-dialogue' }, dialogue.el)),
    overlay,
  );

  return {
    root,
    bridge: {
      say(lines, onDone) {
        dialogue.say(lines, onDone);
      },
      ringSet(fraction) {
        ring.set(fraction);
      },
      ringCounts(done, total) {
        ring.setCounts(done, total);
      },
      ringReset() {
        ring.set(0);
        ring.setCounts(0, 0);
      },
      score(points) {
        scoreChip.textContent = String(points);
        scoreChip.classList.toggle('is-off', points <= 0);
        scoreChip.classList.remove('bump');
        void scoreChip.offsetWidth;
        scoreChip.classList.add('bump');
      },
      combo(count, mult) {
        const on = count >= 2;
        comboChip.classList.toggle('is-off', !on);
        if (on) {
          comboChip.querySelector('.combo-mult')!.textContent = `x${mult}`;
          comboChip.setAttribute('aria-label', `רצף של ${count} — כפול ${mult}`);
          comboChip.classList.remove('bump');
          void comboChip.offsetWidth;
          comboChip.classList.add('bump');
        }
      },
      mission(text) {
        missionChip.textContent = text ?? '';
        missionChip.classList.toggle('is-off', !text);
      },
      pauseEnabled(on) {
        pauseBtn.classList.toggle('is-off', !on);
        if (!on) setPaused(false);
      },
    },
    setZone(name: string) {
      const el = root.querySelector('#hud-zone');
      if (el) el.textContent = name;
    },
    clear() {
      dialogue.clear();
      ring.set(0);
      ring.setCounts(0, 0);
      scoreChip.textContent = '0';
      scoreChip.classList.add('is-off');
      comboChip.classList.add('is-off');
      missionChip.textContent = '';
      missionChip.classList.add('is-off');
      setPaused(false);
    },
    playEnter() {
      root.classList.remove('hud-entering');
      void root.offsetWidth; /* restart the CSS animation */
      root.classList.add('hud-entering');
      window.setTimeout(() => root.classList.remove('hud-entering'), 900);
    },
  };
}
