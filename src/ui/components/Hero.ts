import lennySvg from '../assets/lenny-star.svg?raw';
import { uiButton } from './common/Button';
import { h } from './common/el';

export interface HeroCallbacks {
  onStart(): void;
  onContinue(): void;
  onParent(): void;
  onNameChange(name: string): void;
}

export interface HeroHandle {
  root: HTMLElement;
  setGreeting(text: string): void;
  setShowContinue(show: boolean): void;
  setBloomLit(lit: boolean): void;
}

/** Full-screen opening: animated starfield, breathing Lenny, gradient title. */
export function createHero(callbacks: HeroCallbacks): HeroHandle {
  const sky = h(
    'div',
    { class: 'starfield', 'aria-hidden': 'true' },
    h('div', { class: 'stars-layer stars-layer--far' }),
    h('div', { class: 'stars-layer stars-layer--mid' }),
    h('div', { class: 'stars-layer stars-layer--near' }),
  );

  const badge = h(
    'span',
    { class: 'badge' },
    h('span', { class: 'badge-dot', 'aria-hidden': 'true' }),
    'הגן מחכה',
  );

  /* ETHICS §2#6: no daily-streak mechanics — the charter bans return-visit
     hooks for children. The chip that once lived here was removed (audit 9-a). */
  const parentBtn = h(
    'button',
    { class: 'parent-link', type: 'button', onClick: () => callbacks.onParent() },
    'פִּנַּת הַהוֹרִים ←',
  );

  const lennyHolder = h('span', { class: 'lenny-inline', 'aria-hidden': 'true' });
  lennyHolder.innerHTML = lennySvg;
  const lennyFigure = h(
    'div',
    { class: 'lenny-figure' },
    h('div', { class: 'lenny-halo', 'aria-hidden': 'true' }),
    lennyHolder,
  );

  const greeting = h('p', { class: 'greeting', id: 'hero-greeting' });

  const nameInput = h('input', {
    class: 'name-input',
    id: 'name-input',
    type: 'text',
    maxlength: '14',
    placeholder: 'מָה הַשֵּׁם שֶׁלְּךָ?',
    'aria-label': 'השם שלך',
    autocomplete: 'off',
  });
  nameInput.addEventListener('input', () => callbacks.onNameChange(nameInput.value.trim()));

  const root = h(
    'section',
    { class: 'screen screen--hero hidden', id: 'hero-screen', 'aria-label': 'מסך הפתיחה' },
    sky,
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar-side' }, badge),
      parentBtn,
    ),
    h(
      'main',
      { class: 'hero-center' },
      lennyFigure,
      h('p', { class: 'eyebrow' }, 'גַּן שֶׁל אוֹרוֹת'),
      h('h1', { class: 'hero-title' }, 'לֶנִי'),
      h('p', { class: 'subtitle' }, 'מסע קטן שגדל איתך'),
      greeting,
      nameInput,
    ),
    h(
      'div',
      { class: 'hero-cta' },
      uiButton({ label: 'בּוֹאוּ נַתְחִיל אֶת הַמַּסָּע', id: 'start-btn', onPress: callbacks.onStart }),
      uiButton({
        label: 'הַמְשִׁיכִים מֵאֵיפֹה עָצַרְנוּ',
        id: 'continue-btn',
        variant: 'secondary',
        hidden: true,
        onPress: callbacks.onContinue,
      }),
      h('p', { class: 'micro' }, 'ללא פִּרְסוֹמוֹת · ללא רְכִישׁוֹת · הַכֹּל נִשְׁמָר בַּמָּסָךְ'),
    ),
  );

  const badgeEl = root.querySelector<HTMLSpanElement>('.badge')!;
  const continueBtn = root.querySelector<HTMLButtonElement>('#continue-btn')!;

  return {
    root,
    setGreeting(text: string) {
      greeting.textContent = text;
    },
    setShowContinue(show: boolean) {
      continueBtn.hidden = !show;
    },
    setBloomLit(lit: boolean) {
      badgeEl.classList.toggle('is-lit', lit);
    },
  };
}
