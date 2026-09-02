/* ============================================================
 * dayCycle — the garden breathes with the real day (Stage 6, commit 7).
 *
 * Pure functions, no assets. The local hour picks a phase:
 *
 *   morning  6-11   golden light + butterflies
 *   midday  11-16   bright + butterflies
 *   evening 16-20   golden-orange + the first stars
 *   night   20-6    moon + stars + fireflies
 *
 * Visual only — nothing here ever touches difficulty or gameplay
 * (see ETHICS: the day may change the LIGHT, never the challenge).
 *
 * A localStorage override (lenny-hour-override = 0..23) exists for
 * e2e/debug so both worlds can be proven deterministic.
 * ============================================================ */

export type DayPhase = 'morning' | 'midday' | 'evening' | 'night';

const OVERRIDE_KEY = 'lenny-hour-override';

/** The local hour, honoring the debug/e2e override. */
export function currentHour(now: Date = new Date()): number {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (raw !== null) {
      const h = Number(raw);
      if (Number.isFinite(h) && h >= 0 && h <= 23) return Math.floor(h);
    }
  } catch {
    /* private mode: just use the clock */
  }
  return now.getHours();
}

/** Hour → phase (morning 6-11, midday 11-16, evening 16-20, night otherwise). */
export function phaseForHour(hour: number): DayPhase {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'midday';
  if (h >= 16 && h < 20) return 'evening';
  return 'night';
}

/** The phase right now. */
export function phaseNow(now: Date = new Date()): DayPhase {
  return phaseForHour(currentHour(now));
}

/** A warm, hour-aware greeting line (nikud, everyday register). */
export function timeGreeting(phase: DayPhase): string {
  switch (phase) {
    case 'morning':
      return 'בֹּקֶר טוֹב!';
    case 'midday':
      return 'צָהֳרַיִם שֶׁל אוֹר!';
    case 'evening':
      return 'עֶרֶב טוֹב!';
    case 'night':
      return 'לַיְלָה שָׁקֵט בַּגַּן...';
  }
}

/** First visit of this calendar day? (drives the time-aware greeting) */
export function isFirstVisitToday(today: string): boolean {
  try {
    return localStorage.getItem('lenny-last-greet-day') !== today;
  } catch {
    return false;
  }
}

/** Remember that today's hello already happened. */
export function markGreetedToday(today: string): void {
  try {
    localStorage.setItem('lenny-last-greet-day', today);
  } catch {
    /* private mode: the hello repeats — harmless */
  }
}

/** Local calendar day key (YYYY-MM-DD) for the "first today" check. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
