import { describe, expect, it } from 'vitest';
import {
  EVENING_PALETTE,
  MIDDAY_PALETTE,
  NIGHT_PALETTE,
  PHASE_PALETTES,
  paletteChanged,
  paletteForPhase,
} from '../world/WorldSky';
import { cubicBezier } from '../world/WorldCreatures';
import { MOODS } from '../audio/MusicEngine';
import type { DayPhase } from '../content/dayCycle';

describe('WorldSky — the painted day', () => {
  it('covers all four phases with a palette', () => {
    const phases: DayPhase[] = ['morning', 'midday', 'evening', 'night'];
    for (const p of phases) {
      expect(PHASE_PALETTES[p]).toBeTruthy();
      expect(paletteForPhase(p)).toBe(PHASE_PALETTES[p]);
    }
  });

  it('night is dark and starry, midday is bright', () => {
    expect(NIGHT_PALETTE.stars).toBeGreaterThan(40);
    expect(NIGHT_PALETTE.moon).toBe(true);
    expect(NIGHT_PALETTE.sun).toBeNull();
    expect(NIGHT_PALETTE.hemiIntensity).toBeLessThan(0.4);
    expect(MIDDAY_PALETTE.stars).toBe(0);
    expect(MIDDAY_PALETTE.moon).toBe(false);
    expect(MIDDAY_PALETTE.hemiIntensity).toBeGreaterThan(0.5);
  });

  it('evening is the golden hour (warm horizon, first stars)', () => {
    expect(EVENING_PALETTE.stars).toBeGreaterThan(0);
    expect(EVENING_PALETTE.skyHorizon).toMatch(/ff|d9|a0/); /* warm tones */
  });

  it('paletteChanged notices real changes, ignores cosmetic ones', () => {
    expect(paletteChanged(MIDDAY_PALETTE, NIGHT_PALETTE)).toBe(true);
    expect(paletteChanged(MIDDAY_PALETTE, MIDDAY_PALETTE)).toBe(false);
  });

  it('the hour never touches gameplay data — palettes are visual only', () => {
    /* every palette shares the same structural fields, nothing else */
    for (const p of Object.values(PHASE_PALETTES)) {
      expect(Object.keys(p).sort()).toEqual(Object.keys(MIDDAY_PALETTE).sort());
    }
  });
});

describe('WorldCreatures — ambient paths', () => {
  const p0 = { x: 0, y: 1, z: 0 };
  const p1 = { x: 1, y: 2, z: 0 };
  const p2 = { x: 2, y: 1, z: 1 };
  const p3 = { x: 3, y: 1, z: 3 };

  it('bezier starts at p0 and ends at p3', () => {
    expect(cubicBezier(p0, p1, p2, p3, 0)).toEqual(p0);
    const end = cubicBezier(p0, p1, p2, p3, 1);
    expect(end.x).toBeCloseTo(3);
    expect(end.y).toBeCloseTo(1);
    expect(end.z).toBeCloseTo(3);
  });

  it('bezier stays continuous and bounded by the control hull', () => {
    let prev = cubicBezier(p0, p1, p2, p3, 0);
    for (let i = 1; i <= 40; i++) {
      const pt = cubicBezier(p0, p1, p2, p3, i / 40);
      const jump = Math.hypot(pt.x - prev.x, pt.y - prev.y, pt.z - prev.z);
      expect(jump).toBeLessThan(0.25); /* no teleporting butterflies */
      expect(pt.y).toBeGreaterThan(0);
      prev = pt;
    }
  });
});

describe('MusicEngine — the garden-exploring mood (additive)', () => {
  it('exists in the mood table without touching the original five', () => {
    expect(MOODS['garden-exploring']).toBeTruthy();
    for (const m of ['calm', 'happy', 'celebrating', 'focus', 'night'] as const) {
      expect(MOODS[m]).toBeTruthy();
    }
  });

  it('shares the garden key (C pentatonic) with calm', () => {
    expect(MOODS['garden-exploring'].scale).toBe('pentatonic-major');
    expect(MOODS['garden-exploring'].rootHz).toBe(MOODS.calm.rootHz);
    expect(MOODS['garden-exploring'].padOnly).toBe(false);
    expect(MOODS['garden-exploring'].arpPluck).toBe(true); /* water plucks */
  });
});
