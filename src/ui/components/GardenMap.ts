import { uiButton } from './common/Button';
import { h } from './common/el';

export interface GardenMapCallbacks {
  onBack(): void;
}

export interface GardenMapHandle {
  root: HTMLElement;
  setGreeting(lines: string): void;
}

/**
 * The garden journey map.
 * Commit 1 ships the shell (header, greeting, waking state); Commit 2
 * replaces the waking placeholder with the full zone path — glass cards,
 * gradient borders, progress rings and the unlock logic from ProgressStore.
 */
export function createGardenMap(callbacks: GardenMapCallbacks): GardenMapHandle {
  const greeting = h('p', { class: 'garden-greeting', id: 'garden-greeting' });

  const path = h(
    'div',
    { class: 'garden-path', id: 'garden-path' },
    h(
      'div',
      { class: 'map-waking', 'aria-busy': 'true' },
      h('span', { class: 'sprout', 'aria-hidden': 'true' }),
      'הַגַּן מִתְעוֹרֵר...',
    ),
  );

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
      back,
    ),
    greeting,
    path,
  );

  return {
    root,
    setGreeting(lines: string) {
      greeting.textContent = lines;
    },
  };
}
