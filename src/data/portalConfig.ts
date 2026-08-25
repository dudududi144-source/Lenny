/* ============================================================
 * Portal Configuration — Single source of truth.
 * Language here follows docs/ETHICS.md: no medical/scientific
 * overclaims, and nothing hidden from the child.
 * ============================================================ */

export type PortalState =
  | 'VOID'
  | 'SPARK'
  | 'BREATH'
  | 'REVEAL'
  | 'MANDALA'
  | 'GALAXY';

/* ---------- Calming visual rhythm ----------
 * A gentle pulsing light used purely for a soothing atmosphere.
 * It makes NO medical or brainwave-entrainment claims (see ETHICS 4).
 */
export const THETA = {
  freq: 6.0,          /* gentle visual pulse rate (Hz) */
  pulseAlpha: 0.25,   /* kept low for photosensitivity safety */
  ambientRate: 6,
};

/* ---------- Guided breath (4-2-4), an invitation, never forced ---------- */
export const BREATH = {
  inhale: 4.0,
  hold: 2.0,
  exhale: 4.0,
  cyclesToAdvance: 1,
};

/* ---------- Portal state timings (seconds) ---------- */
export const TIMING = {
  void: 0.4,
  spark: 1.6,
  breath: 10.5,
  reveal: 1.8,
  mandala: 3.0,
};

/* ---------- Semantic palette (Dream Minimalism) ---------- */
export const COLORS = {
  void: 0x050210,
  night: 0x0a0416,
  dawn: 0x2a1a4a,
  spark: 0xffd76a,
  violet: 0x7c4dff,
  mint: 0x7dffb8,
  coral: 0xf2549a,
  cream: 0xfff6ec,
  locked: 0x3a3350,
};

/* ---------- Encouragement messages — VISIBLE, never hidden ----------
 * Per ETHICS 5: these are shown clearly to the child for a few seconds.
 * There is no subliminal / below-awareness content in this product.
 */
export const AFFIRMATIONS = {
  /* how long the message stays on screen, clearly readable */
  displayMs: 2500,
  /* gap between messages so they feel calm, not spammy */
  minGapMs: 14000,
  maxGapMs: 20000,
  messages: [
    'אַתְּ מוּפְלָאָה',
    'הַלֵּב שֶׁלָּךְ חָכָם',
    'הַדִּמְיוֹן שֶׁלָּךְ גָּדוֹל',
    'כָּל נְשִׁימָה מַרְגִּיעָה',
    'אַתְּ אוֹר קָטָן',
    'הָעוֹלָם שָׂמֵחַ שֶׁאַתְּ כָּאן',
    'אַתְּ מְיֻחֶדֶת',
    'טוֹב שֶׁאַתְּ',
  ],
};

/* ---------- Lenny (mascot) ---------- */
export const LENNY = {
  color: 0xffd76a,
  glow: 0xffd76a,
  breathRate: 0.5,
};

/* ---------- Galaxy (home screen) ----------
 * Radii are fractions of min(width,height).
 * baseRadius + 8*ringGap = 0.46 so every ring stays on screen.
 */
export const GALAXY = {
  rings: 9,
  baseRadius: 0.14,
  ringGap: 0.04,
  starSize: 11,
  orbitSpeed: 0.05,
};

/* ---------- UI text (proper Hebrew, RTL-safe) ---------- */
export const UI_TEXT = {
  title: 'לֶנִי',
  subtitle: 'גַּן שֶׁל אוֹרוֹת',
  breathIntro: 'נִשְׁמוּ יַחַד',
  galaxyPrompt: 'נִגְעוּ בְּכוֹכָב זָהָב',
  lockedMsg: 'הַכּוֹכָב עוֹד יָשֵׁן',
  tapToSkip: 'נִגְעוּ כְּדֵי לְהַמְשִׁיךְ',
};
