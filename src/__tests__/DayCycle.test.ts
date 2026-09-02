/* ============================================================
 * DayCycle tests (Stage 6, commit 7) — pure time math.
 * The phase changes the LIGHT, never the difficulty — so the only
 * contract here is the mapping itself + the e2e hour override.
 * ============================================================ */

import { describe, expect, it, vi } from 'vitest';
import { currentHour, phaseForHour, phaseNow, timeGreeting, todayKey } from '../content/dayCycle';

describe('dayCycle — hour → phase', () => {
  it('maps the day: morning 6-11, midday 11-16, evening 16-20, night 20-6', () => {
    expect(phaseForHour(6)).toBe('morning');
    expect(phaseForHour(10)).toBe('morning');
    expect(phaseForHour(11)).toBe('midday');
    expect(phaseForHour(15)).toBe('midday');
    expect(phaseForHour(16)).toBe('evening');
    expect(phaseForHour(19)).toBe('evening');
    expect(phaseForHour(20)).toBe('night');
    expect(phaseForHour(23)).toBe('night');
    expect(phaseForHour(0)).toBe('night');
    expect(phaseForHour(5)).toBe('night');
  });

  it('wraps and floors fractional hours safely', () => {
    expect(phaseForHour(24)).toBe('night');
    expect(phaseForHour(25)).toBe('night'); /* 1 AM */
    expect(phaseForHour(10.9)).toBe('morning');
    expect(phaseForHour(-2)).toBe('night'); /* 10 PM */
  });

  it('the four greetings exist and differ', () => {
    const set = new Set(['morning', 'midday', 'evening', 'night'].map((p) => timeGreeting(p as never)));
    expect(set.size).toBe(4);
    expect(timeGreeting('morning')).toContain('בֹּקֶר');
    expect(timeGreeting('evening')).toContain('עֶרֶב');
  });

  it('todayKey is a local YYYY-MM-DD stamp', () => {
    expect(todayKey(new Date(2026, 8, 1))).toBe('2026-09-01');
    expect(todayKey(new Date(2026, 10, 7))).toBe('2026-11-07');
  });

  it('the hour override (e2e/debug) is honored and range-checked', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'lenny-hour-override' ? '22' : null),
      setItem: () => undefined,
    });
    expect(currentHour(new Date(2026, 8, 1, 9))).toBe(22);
    expect(phaseNow(new Date(2026, 8, 1, 9))).toBe('night');

    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'lenny-hour-override' ? '99' : null),
      setItem: () => undefined,
    });
    expect(currentHour(new Date(2026, 8, 1, 9))).toBe(9); /* invalid override ignored */

    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
    });
    expect(currentHour(new Date(2026, 8, 1, 9, 30))).toBe(9);
    vi.unstubAllGlobals();
  });
});
