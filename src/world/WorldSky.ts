/* ============================================================
 * WorldSky — the painted day (Stage 7, commit 4).
 *
 * The garden breathes with the real day (visual only — the hour
 * may change the LIGHT, never the challenge, per ETHICS):
 *
 *   morning  soft gold + butterflies
 *   midday   bright blue + butterflies
 *   evening  golden hour + the first stars
 *   night    deep blue, moon, stars + fireflies
 *
 * The phase comes from the existing content/dayCycle.ts (with its
 * lenny-hour-override for deterministic e2e). Pure mapping here —
 * WorldApp applies the palettes.
 * ============================================================ */

import type { DayPhase } from '../content/dayCycle';

/* ---------- the palette shape (lives here; WorldApp consumes it) ---------- */

export interface WorldPalette {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  /** sun disc position on the painted dome (0..1 of texture space) or null */
  sun: { x: number; y: number; r: number; color: string } | null;
  moon: boolean;
  stars: number;
  sunDir: [number, number, number];
  sunIntensity: number;
  hemiIntensity: number;
  hemiSky: string;
  hemiGround: string;
  grassBase: string;
  grassDark: string;
  grassLight: string;
  fogColor: string;
}

export const MORNING_PALETTE: WorldPalette = {
  skyTop: '#5db3e3',
  skyMid: '#a8d8f0',
  skyHorizon: '#fdf3d8',
  sun: { x: 0.3, y: 0.3, r: 30, color: '#ffe9a6' },
  moon: false,
  stars: 6,
  sunDir: [-0.55, -0.6, 0.35],
  sunIntensity: 0.95,
  hemiIntensity: 0.68,
  hemiSky: '#fff6e0',
  hemiGround: '#4a7a3a',
  grassBase: '#83c95c',
  grassDark: '#66a94a',
  grassLight: '#abdf83',
  fogColor: '#fdf3d8',
};

export const MIDDAY_PALETTE: WorldPalette = {
  skyTop: '#3fa7e0',
  skyMid: '#8fd0ef',
  skyHorizon: '#eaf7dc',
  sun: { x: 0.22, y: 0.14, r: 34, color: '#fff3b0' },
  moon: false,
  stars: 0,
  sunDir: [-0.4, -0.85, 0.3],
  sunIntensity: 1,
  hemiIntensity: 0.65,
  hemiSky: '#ffffff',
  hemiGround: '#4a7a3a',
  grassBase: '#79c356',
  grassDark: '#5ea344',
  grassLight: '#a4d97b',
  fogColor: '#eaf7dc',
};

export const EVENING_PALETTE: WorldPalette = {
  skyTop: '#4a6fa5',
  skyMid: '#e78a5e',
  skyHorizon: '#ffd9a0',
  sun: { x: 0.62, y: 0.55, r: 40, color: '#ffb066' },
  moon: false,
  stars: 14,
  sunDir: [0.6, -0.45, -0.3],
  sunIntensity: 0.85,
  hemiIntensity: 0.55,
  hemiSky: '#ffd9a0',
  hemiGround: '#3d5a34',
  grassBase: '#6ba850',
  grassDark: '#528a3e',
  grassLight: '#93c76e',
  fogColor: '#ffd9a0',
};

export const NIGHT_PALETTE: WorldPalette = {
  skyTop: '#0b1a3a',
  skyMid: '#1d3a5f',
  skyHorizon: '#31527a',
  sun: null,
  moon: true,
  stars: 60,
  sunDir: [0.3, -0.7, 0.5],
  sunIntensity: 0.32,
  hemiIntensity: 0.34,
  hemiSky: '#8fa8d0',
  hemiGround: '#1c2f24',
  grassBase: '#3f6b3c',
  grassDark: '#2f5530',
  grassLight: '#568750',
  fogColor: '#17263c',
};

export const PHASE_PALETTES: Record<DayPhase, WorldPalette> = {
  morning: MORNING_PALETTE,
  midday: MIDDAY_PALETTE,
  evening: EVENING_PALETTE,
  night: NIGHT_PALETTE,
};

/** The palette for a day phase (pure, total). */
export function paletteForPhase(phase: DayPhase): WorldPalette {
  return PHASE_PALETTES[phase] ?? MIDDAY_PALETTE;
}

/** Do two palettes differ enough to justify a repaint? (pure) */
export function paletteChanged(a: WorldPalette, b: WorldPalette): boolean {
  return (
    a.skyTop !== b.skyTop ||
    a.skyHorizon !== b.skyHorizon ||
    a.moon !== b.moon ||
    a.stars !== b.stars ||
    a.sunIntensity !== b.sunIntensity ||
    a.hemiIntensity !== b.hemiIntensity
  );
}
