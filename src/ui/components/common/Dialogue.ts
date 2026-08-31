import { h } from './el';

export interface DialogueOptions {
  className?: string;
  charDelayMs?: number;
  holdMs?: number;
  ariaLabel?: string;
}

export interface DialogueHandle {
  el: HTMLElement;
  /** Types lines one by one (niqqud-safe), then fires onDone. */
  say(lines: string | string[], onDone?: () => void): void;
  /** Finish the current line immediately (tap-to-skip). */
  skip(): void;
  clear(): void;
  isBusy(): boolean;
}

/* Hebrew niqqud (U+05B0–U+05C7) and generic combining marks (U+0300–U+036F)
   must never be separated from their base letter — they are revealed
   together with it, exactly like the old canvas DialogueBox did. */
function isCombiningMark(code: number): boolean {
  return (code >= 0x05b0 && code <= 0x05c7) || (code >= 0x0300 && code <= 0x036f);
}

function splitUnits(line: string): string[] {
  const chars = Array.from(line);
  const units: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    let unit = chars[i];
    while (i + 1 < chars.length && isCombiningMark(chars[i + 1].codePointAt(0) ?? 0)) {
      unit += chars[i + 1];
      i++;
    }
    units.push(unit);
  }
  return units;
}

/** Glass dialogue bubble with a Hebrew-safe typewriter effect. */
export function createDialogue(options: DialogueOptions = {}): DialogueHandle {
  const charDelay = options.charDelayMs ?? 45;
  const hold = options.holdMs ?? 1500;

  const textSpan = h('span', { class: 'dialogue-text' });
  const el = h('div', { class: `dialogue ${options.className ?? ''}`.trim(), role: 'status', 'aria-label': options.ariaLabel ?? 'לני אומר' }, textSpan);

  let units: string[] = [];
  let idx = 0;
  let typeTimer: number | null = null;
  let holdTimer: number | null = null;
  let queue: string[] = [];
  let onDoneCb: (() => void) | null = null;

  function cancelTimers(): void {
    if (typeTimer !== null) window.clearTimeout(typeTimer);
    if (holdTimer !== null) window.clearTimeout(holdTimer);
    typeTimer = null;
    holdTimer = null;
  }

  function nextLine(): void {
    const line = queue.shift();
    if (line === undefined) {
      el.classList.remove('is-typing');
      const cb = onDoneCb;
      onDoneCb = null;
      cb?.();
      return;
    }
    textSpan.textContent = '';
    units = splitUnits(line);
    idx = 0;
    revealNext();
  }

  function revealNext(): void {
    if (idx < units.length) {
      textSpan.textContent += units[idx++];
      typeTimer = window.setTimeout(revealNext, charDelay);
    } else {
      typeTimer = null;
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        nextLine();
      }, hold);
    }
  }

  el.addEventListener('pointerdown', () => skip());

  function skip(): void {
    if (typeTimer !== null) {
      window.clearTimeout(typeTimer);
      typeTimer = null;
      textSpan.textContent = units.join('');
      idx = units.length;
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        nextLine();
      }, 350);
    } else if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
      nextLine();
    }
  }

  return {
    el,
    say(lines, onDone) {
      cancelTimers();
      queue = Array.isArray(lines) ? [...lines] : [lines];
      onDoneCb = onDone ?? null;
      el.classList.add('is-typing');
      nextLine();
    },
    skip,
    clear() {
      cancelTimers();
      queue = [];
      onDoneCb = null;
      units = [];
      idx = 0;
      textSpan.textContent = '';
      el.classList.remove('is-typing');
    },
    isBusy() {
      return typeTimer !== null || holdTimer !== null || queue.length > 0;
    },
  };
}
