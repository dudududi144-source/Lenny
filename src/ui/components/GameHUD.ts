import { ProgressRing } from './common/ProgressRing';
import { createDialogue, type DialogueHandle } from './common/Dialogue';
import { h } from './common/el';

export interface HudBridge {
  say(lines: string | string[], onDone?: () => void): void;
  ringSet(fraction: number): void;
  ringCounts(done: number, total: number): void;
  ringReset(): void;
}

export interface GameHUDHandle {
  root: HTMLElement;
  bridge: HudBridge;
  setZone(name: string): void;
  clear(): void;
}

/**
 * DOM HUD floating above the Pixi canvas: back button, zone title,
 * animated progress ring and Lenny's typewriter dialogue bubble.
 * Stays in the DOM (not canvas) for CSS styling + accessibility.
 */
export function createGameHUD(callbacks: { onBack(): void }): GameHUDHandle {
  const ring = new ProgressRing({ size: 46, stroke: 5, ariaLabel: 'התקדמות הסבב' });
  const dialogue: DialogueHandle = createDialogue({ className: 'hud-dialogue' });

  const root = h(
    'div',
    { class: 'game-hud', id: 'game-hud' },
    h(
      'div',
      { class: 'hud-top' },
      h('button', { class: 'ui-btn ui-btn--ghost', id: 'game-back', type: 'button', 'aria-label': 'חזרה לגן', onClick: () => callbacks.onBack() }, '→ הַגַּן'),
      h('span', { class: 'hud-zone', id: 'hud-zone' }),
      h('span', { class: 'hud-ring', id: 'hud-ring' }, ring.el),
    ),
    h('div', { class: 'hud-spacer' }),
    h('div', { class: 'hud-bottom' }, h('div', { class: 'hud-dialogue-slot', id: 'hud-dialogue' }, dialogue.el)),
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
    },
    setZone(name: string) {
      const el = root.querySelector('#hud-zone');
      if (el) el.textContent = name;
    },
    clear() {
      dialogue.clear();
      ring.set(0);
      ring.setCounts(0, 0);
    },
  };
}
