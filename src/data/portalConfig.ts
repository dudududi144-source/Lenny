/* ============================================================
 * Portal Configuration — Single source of truth
 * All frequencies, colors, timings for the cognitive portal.
 * Theta-wave entrainment · Guided breath · Subliminal layer.
 * ============================================================ */

export type PortalState =
  | 'VOID'
  | 'SPARK'
  | 'BREATH'
  | 'REVEAL'
  | 'MANDALA'
  | 'GALAXY';

/* ---------- Theta-wave entrainment ---------- */
export const THETA = {
  freq: 6.0,
  pulseAlpha: 0.25,
  ambientRate: 6,
};

/* ---------- Guided breath (4-2-4 box breathing, kid-friendly) ---------- */
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

/* ---------- Subliminal affirmation layer (proper Hebrew niqqud) ---------- */
export const SUBLIMINAL = {
  flashMs: 90,
  minGapMs: 12000,
  maxGapMs: 17000,
  messages: [
    'אַתְּ מוּפְלָאָה',
    'הַלֵּב שֶׁלָּךְ חָכָם',
    'הַדִּמְיוֹן אֵינוֹ נִגְמָר',
    'כָּל נְשִׁימָה הִיא קֶסֶם',
    'אַתְּ אוֹר קָטָן',
    'אַתְּ חֲזָקָה',
    'הָעוֹלָם מְחַכֶּה לָךְ',
    'אַתְּ מְיֻחֶדֶת',
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
 * baseRadius + 8*ringGap = 0.46 -> outer ring fits within the
 * 420px-wide viewport (half width = 210px). This is the critical
 * fix so every one of the 9 rings stays visible and tappable.
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
  lockedMsg: 'הַכּוֹכָב עוֹד יִשָּׂן',
  tapToSkip: 'נִגְעוּ כְּדֵי לְהַמְשִׁיךְ',
};
