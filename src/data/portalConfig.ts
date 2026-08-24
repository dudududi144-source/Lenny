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
  /* Core pulse frequency in Hz (theta band: 4-8Hz) */
  freq: 6.0,
  /* Max alpha added by the pulse (kept subtle & epilepsy-safe) */
  pulseAlpha: 0.25,
  /* Soft global breathing rate for background (cycles per minute) */
  ambientRate: 6,
};

/* ---------- Guided breath (4-2-4 box breathing, kid-friendly) ---------- */
export const BREATH = {
  inhale: 4.0,
  hold: 2.0,
  exhale: 4.0,
  /* Number of full cycles before auto-advancing past BREATH state */
  cyclesToAdvance: 1,
};

/* ---------- Portal state timings (seconds) ---------- */
export const TIMING = {
  void: 0.5,
  spark: 2.0,
  breath: 10.5,   /* one full 4-2-4 cycle + settle */
  reveal: 2.0,
  mandala: 3.5,
  /* GALAXY runs forever after */
};

/* ---------- Semantic palette (Dream Minimalism) ---------- */
export const COLORS = {
  void: 0x050210,      /* deep night */
  night: 0x0a0416,     /* base background */
  dawn: 0x2a1a4a,      /* deep purple */
  spark: 0xffd76a,     /* golden spark */
  violet: 0x7c4dff,    /* subconscious */
  mint: 0x7dffb8,      /* calm / healing */
  coral: 0xf2549a,     /* love */
  cream: 0xfff6ec,     /* purity / text */
  locked: 0x3a3350,    /* dormant games */
};

/* ---------- Subliminal affirmation layer ---------- */
export const SUBLIMINAL = {
  /* Flash duration in ms (below conscious threshold, above render) */
  flashMs: 90,
  /* Random interval range in ms between appearances */
  minGapMs: 12000,
  maxGapMs: 17000,
  messages: [
    '\u05d0\u05b7\u05ea\u05b0\u05bc \u05de\u05d5\u05bc\u05e4\u05b0\u05dc\u05b8\u05d0\u05b8\u05d4',
    '\u05d4\u05b7\u05dc\u05b5\u05bc\u05d1 \u05e9\u05b6\u05c1\u05dc\u05b8\u05da\u05b0\u05bc \u05d7\u05b8\u05db\u05b8\u05dd',
    '\u05d4\u05b7\u05d3\u05bc\u05b4\u05de\u05b0\u05d9\u05d5\u05b9\u05df \u05d0\u05b5\u05d9\u05e0\u05d5\u05b9 \u05e1\u05d5\u05b9\u05e4\u05b4\u05d9\u05d9',
    '\u05db\u05b8\u05bc\u05dc \u05e0\u05b0\u05e9\u05b4\u05c1\u05d9\u05de\u05b8\u05d4 \u2014 \u05e7\u05b6\u05e1\u05b6\u05dd',
    '\u05d0\u05b7\u05ea\u05b0\u05bc \u05d0\u05d5\u05b9\u05e8',
    '\u05d0\u05b7\u05ea\u05b0\u05bc \u05d7\u05b2\u05d6\u05b8\u05e7\u05b8\u05d4',
    '\u05d4\u05b7\u05e2\u05d5\u05b9\u05dc\u05b8\u05dd \u05de\u05d7\u05b7\u05db\u05b8\u05bc\u05d4 \u05dc\u05b8\u05da\u05b0\u05bc',
    '\u05d0\u05b7\u05ea\u05b0\u05bc \u05de\u05b0\u05d9\u05d5\u05bc\u05d7\u05b6\u05d3\u05b6\u05ea',
  ],
};

/* ---------- Lenny (mascot) ---------- */
export const LENNY = {
  color: 0xffd76a,
  glow: 0xffd76a,
  breathRate: 0.5, /* Hz — slow calm breathing */
};

/* ---------- Galaxy (home screen) ---------- */
export const GALAXY = {
  rings: 9,
  baseRadius: 0.16,   /* fraction of min(w,h) */
  ringGap: 0.085,
  starSize: 9,
  orbitSpeed: 0.05,   /* radians/sec base */
};
