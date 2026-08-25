/* ============================================================
 * ProgressStore — the persistence abstraction + unlock engine.
 *
 * The garden "grows with the child" and can one day sync across
 * devices / friends. To keep the product working TODAY and ready
 * for the cloud tomorrow, this is an interface with:
 *   - LocalProgressStore (localStorage, works now, offline-first)
 *   - (future) CloudProgressStore (Turso/Supabase via env config)
 *
 * Secrets are NEVER hardcoded; a cloud store reads import.meta.env.
 *
 * UNLOCK ENGINE: zones unlock along the path defined in data/garden.ts.
 * Finishing a zone's game enough times opens the next gate. This is the
 * logic that makes all 10 zones reachable (previously only 2 were).
 * ============================================================ */

import { ZONES as GARDEN_ZONES } from '../../data/garden';

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
  return { firstSeen: Date.now(), lights: 0, zones: {}, finished: {} };
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

/* How many times a zone's game has been completed. Reads both shapes
   (finished map + zones map) so old saves still work. */
export function finishedCount(data: GardenData, zone: string): number {
  const fromMap = (data.finished && data.finished[zone]) || 0;
  const fromZones = (data.zones[zone] && data.zones[zone].finished) || 0;
  return Math.max(fromMap, fromZones);
}

/* ============================================================
 * isUnlocked — evaluates the real unlock chain from data/garden.ts.
 * A zone is open when:
 *   - its rule kind is 'open', OR
 *   - its prerequisite zone (unlock.from) has been finished
 *     at least unlock.gamesNeeded times.
 * ============================================================ */
export function isUnlocked(data: GardenData, zone: string): boolean {
  if (DEFAULT_UNLOCKED.includes(zone)) return true;
  const def = GARDEN_ZONES.find((z) => z.id === zone);
  if (!def) return false;
  if (def.unlock.kind === 'open') return true;
  const from = def.unlock.from;
  if (!from) return false;
  const needed = def.unlock.gamesNeeded ?? 1;
  return finishedCount(data, from) >= needed;
}

/* Which zone must be finished (and how many times) to open this one. */
export function unlockRequirement(zone: string): { from: string; needed: number } | null {
  const def = GARDEN_ZONES.find((z) => z.id === zone);
  if (!def || def.unlock.kind === 'open' || !def.unlock.from) return null;
  return { from: def.unlock.from, needed: def.unlock.gamesNeeded ?? 1 };
}

/* Zone display name, for unlock-hint copy. */
export function zoneName(zone: string): string {
  const def = GARDEN_ZONES.find((z) => z.id === zone);
  return def ? def.name : zone;
}

/* Bloom level = how much the garden has grown (drives hero + map). */
export function bloomLevel(data: GardenData): number {
  let fromZones = 0;
  for (const k in data.zones) fromZones += data.zones[k].finished;
  const fromMap = data.finished ? Object.values(data.finished).reduce((a, b) => a + b, 0) : 0;
  const total = Math.max(fromZones, fromMap);
  return Math.floor(total / 2) + Math.floor((data.lights || 0) / 4);
}

/* Record a finished game in a zone; returns updated data. */
export function recordFinish(data: GardenData, zone: string): GardenData {
  const z = data.zones[zone] || { finished: 0, unlocked: true };
  z.finished += 1;
  z.unlocked = true;
  data.zones[zone] = z;
  data.finished = data.finished || {};
  data.finished[zone] = (data.finished[zone] || 0) + 1;
  data.lights = (data.lights || 0) + 1;
  return data;
}

/* ============================================================
 * recordZoneFinish — THE single safe entry point every game scene
 * calls when a round is completed. It loads (or creates) the garden,
 * records the finish in BOTH saved shapes, adds a light, unlocks any
 * newly-reachable zone, and saves. Returns newly-unlocked zone ids
 * so callers can celebrate.
 * ============================================================ */
export function recordZoneFinish(zone: string): string[] {
  const store = new LocalProgressStore();
  const before = store.load();

  const unlockedBefore = new Set<string>();
  for (const def of GARDEN_ZONES) {
    if (isUnlocked(before, def.id)) unlockedBefore.add(def.id);
  }

  const data = recordFinish(before, zone);

  const newlyUnlocked: string[] = [];
  for (const def of GARDEN_ZONES) {
    if (!unlockedBefore.has(def.id) && isUnlocked(data, def.id)) {
      newlyUnlocked.push(def.id);
      const z = data.zones[def.id] || { finished: 0, unlocked: false };
      z.unlocked = true;
      data.zones[def.id] = z;
    }
  }
  store.save(data);
  return newlyUnlocked;
}
