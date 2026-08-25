/* ============================================================
 * ProgressStore — the persistence abstraction.
 *
 * The garden "grows with the child" and can one day sync across
 * devices / friends. To keep the product working TODAY and ready
 * for the cloud tomorrow, this is an interface with:
 *   - LocalProgressStore (localStorage, works now, offline-first)
 *   - (future) CloudProgressStore (Turso/Supabase via env config)
 *
 * Secrets are NEVER hardcoded; a cloud store reads import.meta.env.
 * ============================================================ */

export interface ZoneProg { finished: number; unlocked: boolean; }
export interface GardenData {
  firstSeen: number;
  lights: number;
  zones: Record<string, ZoneProg>;
  finished?: Record<string, number>;
}

export interface ProgressStore {
  load(): GardenData;
  save(data: GardenData): void;
}

const KEY = 'lenny-garden';
export const DEFAULT_UNLOCKED = ['light-path', 'breath-pool'];

export function freshGarden(): GardenData {
  return { firstSeen: Date.now(), lights: 0, zones: {} };
}

export class LocalProgressStore implements ProgressStore {
  load(): GardenData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          firstSeen: s.firstSeen || Date.now(),
          lights: s.lights || 0,
          zones: s.zones || {},
          finished: s.finished || {},
        };
      }
    } catch { /* fresh */ }
    return freshGarden();
  }
  save(data: GardenData): void {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* noop */ }
  }
}

/* Bloom level = how much the garden has grown (drives hero + map). */
export function bloomLevel(data: GardenData): number {
  let finished = 0;
  for (const k in data.zones) finished += data.zones[k].finished;
  return Math.floor(finished / 3) + Math.floor(data.lights / 5);
}

export function isUnlocked(data: GardenData, zone: string): boolean {
  if (DEFAULT_UNLOCKED.includes(zone)) return true;
  if (data.finished && (data.finished[zone] || 0) > 0) return true;
  return !!data.zones[zone] && data.zones[zone].unlocked;
}

/* Record a finished game in a zone; returns updated data. */
export function recordFinish(data: GardenData, zone: string): GardenData {
  const z = data.zones[zone] || { finished: 0, unlocked: true };
  z.finished += 1;
  z.unlocked = true;
  data.zones[zone] = z;
  data.lights += 1;
  return data;
}
