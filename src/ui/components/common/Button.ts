import { h } from './el';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  id?: string;
  ariaLabel?: string;
  hidden?: boolean;
  onPress?: () => void;
}

/** Glass/gradient button with hover-glow + press-spring built in. */
export function uiButton(options: ButtonOptions): HTMLButtonElement {
  const { label, variant = 'primary', id, ariaLabel, hidden, onPress } = options;
  return h(
    'button',
    {
      class: `ui-btn ui-btn--${variant}`,
      id,
      type: 'button',
      'aria-label': ariaLabel,
      hidden: hidden === true,
      onClick: () => onPress?.(),
    },
    label,
  );
}
