import { audio } from '../engine/AudioEngine';

/* ============================================================
 * speak — the scenes' Hebrew voice (the FindLetter pattern).
 *
 * Best effort, always: no TTS / muted choice / missing voice =
 * the visual hint stands alone. Niqqud is for the eyes; the
 * voice reads the letters alone. One helper so every new scene
 * speaks EXACTLY the same guarded way.
 * ============================================================ */

export function speak(text: string): void {
  try {
    if (audio.isMuted()) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u0591-\u05C7]/g, ''));
    u.lang = 'he-IL';
    u.rate = 0.85;
    synth.speak(u);
  } catch {
    /* silent fallthrough — the scene never depends on the voice */
  }
}
