/* ============================================================
 * Portal Configuration — Single source of truth.
 * Language follows docs/ETHICS.md and docs/GARDEN.md:
 * honest claims, warm everyday Hebrew, nothing hidden.
 * ============================================================ */

export type PortalState =
  | 'VOID'
  | 'SPARK'
  | 'BREATH'
  | 'STORY'
  | 'GARDEN';

/* ---------- Calming visual rhythm ----------
 * A gentle pulsing light used purely for a soothing atmosphere.
 * It makes NO medical or brainwave-entrainment claims (see ETHICS 4).
 */
export const THETA = {
  freq: 6.0,
  pulseAlpha: 0.25,
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
  story: 6.0,
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

/* ---------- Encouragement messages — VISIBLE, never hidden ---------- */
export const AFFIRMATIONS = {
  displayMs: 2500,
  minGapMs: 14000,
  maxGapMs: 20000,
  messages: [
    'וָאו, כָּל הַכָּבוֹד!',
    'אַתְּ מַצְלִיחָה!',
    'כָּל נְשִׁימָה מַרְגִּיעָה',
    'אֵיזֶה יֹפִי!',
    'בּוֹא נְגַלֶּה מָה יֵשׁ פֹּה',
    'טוֹב שֶׁאַתְּ כָּאן',
    'הַגַּן שָׂמֵחַ שֶׁבָּאת',
  ],
};

/* ---------- Lenny (mascot) ---------- */
export const LENNY = {
  color: 0xffd76a,
  glow: 0xffd76a,
  breathRate: 0.5,
};

/* ---------- Garden (home world) ----------
 * The garden replaces the old galaxy. Zones sit along a path.
 */
export const GARDEN_UI = {
  zoneRadius: 17,
  currentRadius: 22,
};
