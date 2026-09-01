import { uiButton } from '../components/common/Button';
import { h } from '../components/common/el';

/* ============================================================
   gate — the child-safe entrance to the ParentLens.

   Two doors, both gentle:
   1. HOLD — press and hold the star for 2 seconds (the primary,
      toddler-proof gesture: a stray tap never gets in).
   2. QUESTION — a small multiplication question, kept from the
      previous lens (a grown-up can always do it; a 4-year-old
      playing along simply waits).

   No passwords, no shame, no timers that punish.
   ============================================================ */

export const HOLD_MS = 2000;

export interface ParentGateCallbacks {
  onUnlock(): void;
  onExit(): void;
}

export interface ParentGateHandle {
  root: HTMLElement;
  /** Shows a fresh gate (new question, reset hold). */
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

export function createParentGate(callbacks: ParentGateCallbacks): ParentGateHandle {
  const gate = h('div', { class: 'parent-gate' });
  let holdTimer: number | null = null;
  let holding = false;

  function clearHold(): void {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
    holding = false;
    gate.querySelector('.parent-hold')?.classList.remove('is-holding');
  }

  function buildHoldCard(): HTMLElement {
    const fill = h('span', { class: 'parent-hold-fill', 'aria-hidden': 'true' });
    const star = h('span', { class: 'parent-hold-star', 'aria-hidden': 'true' }, '✦');
    const btn = h(
      'button',
      {
        class: 'parent-hold',
        type: 'button',
        'aria-label': 'החזיקו שתי שניות כדי להיכנס לעדשת ההורה',
        onpointerdown: (e: Event) => {
          e.preventDefault();
          if (holding) return;
          holding = true;
          btn.classList.add('is-holding');
          holdTimer = window.setTimeout(() => {
            clearHold();
            callbacks.onUnlock();
          }, HOLD_MS);
        },
        onpointerup: () => clearHold(),
        onpointerleave: () => clearHold(),
        onpointercancel: () => clearHold(),
        onkeydown: (ev: Event) => {
          const e = ev as KeyboardEvent;
          if ((e.key === ' ' || e.key === 'Enter') && !holding) {
            e.preventDefault();
            holding = true;
            btn.classList.add('is-holding');
            holdTimer = window.setTimeout(() => {
              clearHold();
              callbacks.onUnlock();
            }, HOLD_MS);
          }
        },
        onkeyup: (ev: Event) => {
          const e = ev as KeyboardEvent;
          if (e.key === ' ' || e.key === 'Enter') clearHold();
        },
      },
      fill,
      star,
    );
    return h(
      'div',
      { class: 'parent-hold-wrap' },
      btn,
      h('p', { class: 'parent-hold-hint' }, 'הַחֲזִיקוּ שְׁתֵּי שְׁנִיּוֹת'),
    );
  }

  function show(): void {
    clearHold();
    gate.replaceChildren();

    /* fresh multiplication question every open */
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
      h(
        'div',
        { class: 'parent-gate-card' },
        h('h2', { class: 'parent-title' }, 'עֲדֶשֶׁת הַהוֹרֶה'),
        h('p', { class: 'parent-gate-line' }, 'הַפִּנָּה הַזּוֹ מְיֻעֶדֶת לִמְבוּגָרִים בִּלְבַד.'),
        buildHoldCard(),
        h('div', { class: 'parent-gate-divider', role: 'separator', 'aria-hidden': 'true' }, 'אוֹ'),
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
                  clearHold();
                  callbacks.onUnlock();
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

  return {
    root: gate,
    open: show,
  };
}
