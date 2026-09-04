/* ============================================================
 * worldCollect — the sparkles of the endless meadow (stage 11).
 *
 * A sparkle is a small golden polyhedron the walking child gathers
 * by touching it. This is the meadow's own honest memory:
 *   - localStorage only, key `lenny-world-sparkles-v1`
 *   - the schema is ONLY an array of deterministic sparkle ids
 *     (`cx:cz:i`), length-capped — no counters to lie, no timestamps
 *   - a collected sparkle never respawns: the meadow remembers
 *
 * stage 15-C adds the SECOND set — the snow region's ice crystals
 * (same discipline, own key, own id shape) below.
 *
 * Pure + storage-injectable (the worldFound pattern).
 * ============================================================ */

export const WORLD_SPARKLES_KEY = 'lenny-world-sparkles-v1';

/** the id ledger never outgrows this (a lifetime of wandering) */
export const SPARKLE_LEDGER_CAP = 600;

/** true when `id` has the exact `cx:cz:i` shape (three ints; chunk coords may be negative) */
export function isValidSparkleId(id: string): boolean {
  const parts = id.split(':');
  if (parts.length !== 3) return false;
  for (const p of parts) {
    if (!/^-?\d+$/.test(p)) return false;
  }
  return true;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The collected sparkle ids, oldest first. */
export function loadSparkles(storage: StorageLike = localStorage): string[] {
  try {
    const raw = storage.getItem(WORLD_SPARKLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of parsed) {
      if (typeof id === 'string' && isValidSparkleId(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out.slice(-SPARKLE_LEDGER_CAP);
  } catch {
    return []; /* private mode / corrupt — the meadow starts golden */
  }
}

/** Remember one more sparkle (idempotent, best effort). Returns the ledger. */
export function markSparkle(id: string, storage: StorageLike = localStorage): string[] {
  if (!isValidSparkleId(id)) return loadSparkles(storage);
  const found = loadSparkles(storage);
  if (found.includes(id)) return found;
  const next = [...found, id].slice(-SPARKLE_LEDGER_CAP);
  try {
    storage.setItem(WORLD_SPARKLES_KEY, JSON.stringify(next));
  } catch {
    /* private mode — this sparkle still celebrates, nothing persists */
  }
  return next;
}

/* ============================================================
 * stage 15-C: the SECOND collectible set — the ice crystals of
 * אֶרֶץ הַשֶּׁלֶג (the snow region's own theme).
 *
 * Same honest memory as the sparkles, in the region's voice:
 *   - localStorage only, key `lenny-world-crystals-v1`
 *   - the schema is ONLY an array of deterministic ids
 *     (`crystal:<region>:<i>`, region from the six REGIONS),
 *     length-capped — a gathered crystal never melts
 *   - the spots are pure rejection sampling over a fixed seed,
 *     clear of roads / landmarks / islands (the worldAcorns
 *     discipline) — renderer wiring lands with the world owner
 * ============================================================ */

export const WORLD_CRYSTALS_KEY = 'lenny-world-crystals-v1';

/** the crystal ledger never outgrows this (a lifetime of winters) */
export const CRYSTAL_LEDGER_CAP = 300;

/** how many ice crystals the snow region hides */
export const CRYSTAL_SPOT_COUNT = 12;

/** the six regions' ids (kept literal — this module stays Babylon-free) */
const REGION_IDS = new Set(['forest', 'snow', 'river', 'flower', 'dunes', 'rocky']);

/** true when `id` has the exact `crystal:<region>:<int>` shape */
export function isValidCrystalId(id: string): boolean {
  const m = /^crystal:([a-z]+):(-?\d+)$/.exec(id);
  return m !== null && REGION_IDS.has(m[1]);
}

/** The gathered crystal ids, oldest first. */
export function loadCrystals(storage: StorageLike = localStorage): string[] {
  try {
    const raw = storage.getItem(WORLD_CRYSTALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of parsed) {
      if (typeof id === 'string' && isValidCrystalId(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out.slice(-CRYSTAL_LEDGER_CAP);
  } catch {
    return []; /* private mode / corrupt — the snow starts clear */
  }
}

/** Remember one more crystal (idempotent, best effort). Returns the ledger. */
export function markCrystal(id: string, storage: StorageLike = localStorage): string[] {
  if (!isValidCrystalId(id)) return loadCrystals(storage);
  const found = loadCrystals(storage);
  if (found.includes(id)) return found;
  const next = [...found, id].slice(-CRYSTAL_LEDGER_CAP);
  try {
    storage.setItem(WORLD_CRYSTALS_KEY, JSON.stringify(next));
  } catch {
    /* private mode — this crystal still glitters, nothing persists */
  }
  return next;
}

/* ---------- the curated crystal spots (pure, deterministic) ---------- */

export interface CrystalSpot {
  id: string;
  x: number;
  z: number;
}

/* injected at module init — the same one-way dependency worldAcorns
   uses (the geometry is data, Babylon is never touched here) */
import { LANDMARKS, WORLD_ISLANDS } from './WorldLayout';
import { REGIONS, REGION_ROADS } from './WorldRegions';

function landmarkMinDist(x: number, z: number): number {
  let best = Infinity;
  for (const l of LANDMARKS) {
    const d = Math.hypot(x - l.x, z - l.z) - l.keep;
    if (d < best) best = d;
  }
  return best;
}

function islandRimDist(x: number, z: number): number {
  let best = Infinity;
  for (const p of WORLD_ISLANDS) {
    const d = Math.hypot(x - p.x, z - p.z) - p.radius;
    if (d < best) best = d;
  }
  return best;
}

function roadMinDist(x: number, z: number): number {
  let best = Infinity;
  for (const road of REGION_ROADS) {
    for (const p of road.points) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < best) best = d;
    }
  }
  return best;
}

/** tiny deterministic PRNG (the ground's own) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One crystal table, computed once — the snow region's hidden lights,
 * deep enough to reward the journey, clear of everything built.
 * Deterministic: every device walks the same glitter.
 */
function buildCrystalSpots(): CrystalSpot[] {
  const snow = REGIONS.find((r) => r.id === 'snow');
  if (!snow) return [];
  const rng = mulberry32(0x5e0ec12);
  const out: CrystalSpot[] = [];
  const taken: Array<{ x: number; z: number }> = [];
  let guard = 0;
  while (out.length < CRYSTAL_SPOT_COUNT && guard < 8000) {
    guard++;
    const a = rng() * Math.PI * 2;
    const r = snow.radius * (0.18 + rng() * 0.6);
    const x = snow.x + Math.cos(a) * r;
    const z = snow.z + Math.sin(a) * r;
    if (roadMinDist(x, z) < 1.2) continue;
    if (landmarkMinDist(x, z) < 0.9) continue;
    if (islandRimDist(x, z) < 1.6) continue;
    let free = true;
    for (const t of taken) {
      if (Math.hypot(x - t.x, z - t.z) < 3.2) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    taken.push({ x, z });
    out.push({ id: `crystal:snow:${out.length}`, x, z });
  }
  return out;
}

/** The world's crystal table — deterministic, shared by renderer + tests. */
export const CRYSTAL_SPOTS: CrystalSpot[] = buildCrystalSpots();
