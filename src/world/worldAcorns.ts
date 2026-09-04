/* ============================================================
 * worldAcorns — the acorns of the living continent (stage 14).
 *
 * The owner asked for things to gather ON THE WAY that will MEAN
 * something later ("עוד דברים בדרך לאסוף שיהיה להם משמעות
 * בהמשך"). Acorns are that promise:
 *
 *   - ~44 curated acorn spots across the map — beside the roads,
 *     around the clearings, deep in the regions (deterministic,
 *     pure rejection sampling over a fixed seed)
 *   - a gathered acorn never grows back (the map remembers)
 *   - acorns are the coin of the WELL: the fox's scarves are
 *     bought with them (worldWardrobe) — wander pays for wear
 *
 * localStorage only; the schema is a capped array of validated ids.
 * Pure + storage-injectable (the worldCollect pattern).
 * ============================================================ */

export const WORLD_ACORNS_KEY = 'lenny-world-acorns-v1';

/** the id ledger never outgrows this (a lifetime of gathering) */
export const ACORN_LEDGER_CAP = 400;

/** true when `id` has the exact `acorn:<int>` shape */
export function isValidAcornId(id: string): boolean {
  return /^acorn:-?\d+$/.test(id);
}

export interface AcornSave {
  /** gathered (never-respawning) acorn ids */
  ids: string[];
  /** the SPENDABLE wallet — gathering fills it, the well drains it */
  wallet: number;
}

const WALLET_CAP = 9999;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * The acorn save: gathered ids + the spendable wallet.
 * Legacy saves (a bare array of ids) migrate: wallet = ids.length —
 * everything a child gathered before the well existed still spends.
 */
export function loadAcornSave(storage: StorageLike = localStorage): AcornSave {
  try {
    const raw = storage.getItem(WORLD_ACORNS_KEY);
    if (!raw) return { ids: [], wallet: 0 };
    const parsed = JSON.parse(raw) as unknown;
    let rawIds: unknown[] = [];
    let wallet = -1;
    if (Array.isArray(parsed)) {
      rawIds = parsed; /* legacy schema — the wallet IS the ledger */
      wallet = parsed.length;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const p = parsed as { ids?: unknown; wallet?: unknown };
      rawIds = Array.isArray(p.ids) ? p.ids : [];
      wallet = typeof p.wallet === 'number' && Number.isFinite(p.wallet) ? Math.floor(p.wallet) : -1;
    }
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of rawIds) {
      if (typeof id === 'string' && isValidAcornId(id) && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    ids.splice(0, Math.max(0, ids.length - ACORN_LEDGER_CAP));
    if (wallet < 0) wallet = ids.length; /* corrupt wallet — the ledger vouches */
    return { ids, wallet: Math.min(wallet, WALLET_CAP) };
  } catch {
    return { ids: [], wallet: 0 }; /* private mode / corrupt — start golden */
  }
}

/** The gathered ids (compat: the world renderer only needs ids). */
export function loadAcorns(storage: StorageLike = localStorage): string[] {
  return loadAcornSave(storage).ids;
}

/** The spendable wallet. */
export function loadWallet(storage: StorageLike = localStorage): number {
  return loadAcornSave(storage).wallet;
}

function save(next: AcornSave, storage: StorageLike): AcornSave {
  try {
    storage.setItem(WORLD_ACORNS_KEY, JSON.stringify(next));
  } catch {
    /* private mode — this acorn still celebrates, nothing persists */
  }
  return next;
}

/** Remember one more acorn (idempotent on id; wallet only grows once). */
export function markAcorn(id: string, storage: StorageLike = localStorage): AcornSave {
  const current = loadAcornSave(storage);
  if (!isValidAcornId(id)) return current;
  if (current.ids.includes(id)) return current;
  const ids = [...current.ids, id].slice(-ACORN_LEDGER_CAP);
  const wallet = Math.min(WALLET_CAP, current.wallet + 1);
  return save({ ids, wallet }, storage);
}

/** Spend acorns at the well (never below zero — honest arithmetic). */
export function spendAcorns(cost: number, storage: StorageLike = localStorage): number {
  const current = loadAcornSave(storage);
  const wallet = Math.max(0, current.wallet - Math.max(0, Math.floor(cost)));
  save({ ...current, wallet }, storage);
  return wallet;
}

/* ---------- the curated acorn spots (pure, deterministic) ---------- */

export interface AcornSpot {
  id: string;
  x: number;
  z: number;
}

/** tiny deterministic PRNG (the ground's own) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One acorn table, computed once — every device sees the same woods. */
function buildAcornSpots(): AcornSpot[] {
  const rng = mulberry32(0xac0eb4);
  const out: AcornSpot[] = [];
  const taken: Array<{ x: number; z: number }> = [];
  const free = (x: number, z: number, min: number): boolean => {
    for (const t of taken) if (Math.hypot(x - t.x, z - t.z) < min) return false;
    return true;
  };
  const push = (x: number, z: number): void => {
    taken.push({ x, z });
    out.push({ id: `acorn:${out.length}`, x, z });
  };
  const roadD = roadsMinDist;
  const landmarkD = landmarkMinDist;
  const islandD = islandRimDist;

  /* 16 hub acorns: a generous first walk (r 24..47, clear of everything) */
  let guard = 0;
  let placed = 0;
  while (placed < 16 && guard < 4000) {
    guard++;
    const a = rng() * Math.PI * 2;
    const r = 24 + rng() * 23;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (roadD(x, z) < 1.35) continue;
    if (landmarkD(x, z) < 0.9) continue;
    if (islandD(x, z) < 1.3) continue;
    if (!free(x, z, 2.4)) continue;
    push(x, z);
    placed++;
  }

  /* 24 road acorns: the shoulder of every journey (per region road) */
  for (const road of roads) {
    let roadPlaced = 0;
    let roadGuard = 0;
    while (roadPlaced < 4 && roadGuard < 1500) {
      roadGuard++;
      const k = 0.12 + rng() * 0.76;
      const idx = Math.min(road.points.length - 1, Math.floor(k * (road.points.length - 1)));
      const p = road.points[idx];
      /* a perpendicular shoulder step, either side */
      const nxt = road.points[Math.min(road.points.length - 1, idx + 1)];
      const dx = nxt.x - p.x;
      const dz = nxt.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const side = rng() < 0.5 ? 1 : -1;
      const off = 1.15 + rng() * 0.9;
      const x = p.x + (-dz / len) * off * side;
      const z = p.z + (dx / len) * off * side;
      if (roadD(x, z) < 0.9) continue;
      if (landmarkD(x, z) < 0.9) continue;
      if (islandD(x, z) < 1.3) continue;
      if (!free(x, z, 2.2)) continue;
      push(x, z);
      roadPlaced++;
    }
  }

  /* 12 wander acorns: deep in the regions, past the clearings */
  for (const reg of regionPatches) {
    let regPlaced = 0;
    let regGuard = 0;
    while (regPlaced < 2 && regGuard < 1500) {
      regGuard++;
      const a = rng() * Math.PI * 2;
      const r = reg.radius * (0.42 + rng() * 0.44);
      const x = reg.x + Math.cos(a) * r;
      const z = reg.z + Math.sin(a) * r;
      if (roadD(x, z) < 1.2) continue;
      if (landmarkD(x, z) < 0.9) continue;
      if (islandD(x, z) < 1.6) continue;
      if (!free(x, z, 2.4)) continue;
      push(x, z);
      regPlaced++;
    }
  }

  return out;
}

/* ---- injected by worldStations/WorldRegions at module init ---- */
import { LANDMARKS, WORLD_ISLANDS } from './WorldLayout';
import { REGION_ROADS, REGIONS } from './WorldRegions';

const roads = REGION_ROADS;
const regionPatches = REGIONS;

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

function roadsMinDist(x: number, z: number): number {
  let best = Infinity;
  for (const road of roads) {
    for (const p of road.points) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < best) best = d;
    }
  }
  return best;
}

/** The world's acorn table — deterministic, shared by renderer + tests. */
export const ACORN_SPOTS: AcornSpot[] = buildAcornSpots();
