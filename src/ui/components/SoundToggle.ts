import { audio } from '../../games/engine/AudioEngine';
import { h } from './common/el';

/* ============================================================
   SoundToggle — the sound choice, visible where the child is.

   ETHICS §9: אין אודיו כברירת מחדל. The app is silent until
   someone explicitly presses this button; the choice is then
   remembered on-device (lenny-muted). Same control that exists
   in the game HUD, now on the hero and in the world too.
   ============================================================ */

export function createSoundToggle(id: string): HTMLElement {
  let muted = audio.isMuted();
  const btn = h('button', {
    class: 'sound-toggle',
    id,
    type: 'button',
    'aria-label': muted ? 'הפעלת צלילים' : 'השתקת צלילים',
    'aria-pressed': String(!muted),
  });
  const paint = (): void => {
    btn.textContent = muted ? '🔇' : '🔊';
  };
  paint();
  btn.addEventListener('click', () => {
    /* a click IS a user gesture — safe to create the context here */
    audio.unlock();
    muted = audio.toggleMute();
    paint();
    btn.setAttribute('aria-label', muted ? 'הפעלת צלילים' : 'השתקת צלילים');
    btn.setAttribute('aria-pressed', String(!muted));
  });
  return btn;
}
