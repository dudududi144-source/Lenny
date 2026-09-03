/* ============================================================
 * WorldLayout — the pure geometry of the 3D garden (unit-tested).
 *
 * Ten zone islands along one golden-angle spiral path:
 *   light-path near the center (the journey starts here),
 *   breath-pool at the calm far end (always open — a place to
 *   return to), everything in path order between.
 *
 * Pure math only: positions, distances, proximity. No Babylon,
 * no DOM — the unit tests pin every number the world depends on.
 * ============================================================ */

import { ZONES, type ZoneId } from '../data/garden';

export interface IslandPlacement {
  zone: ZoneId;
  index: number;
  x: number;
  z: number;
  /** island platform radius (world units) */
  radius: number;
  /** distance from the world center */
  dist: number;
}

const GOLDEN_ANGLE = 2.39996;
const START_RADIUS = 3.4;
const RADIUS_STEP = 0.92;
const ISLAND_RADIUS = 2.15;

/** The spiral path that connects the islands (thin ribbon on the grass). */
export const PATH_WIDTH = 0.72;

export function layoutIslands(): IslandPlacement[] {
  return ZONES.map((zone, i) => {
    const angle = -Math.PI / 2 + i * GOLDEN_ANGLE; /* first island "north" */
    const dist = START_RADIUS + i * RADIUS_STEP;
    return {
      zone: zone.id,
      index: i,
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      radius: ISLAND_RADIUS,
      dist,
    };
  });
}

export const WORLD_ISLANDS: IslandPlacement[] = layoutIslands();

export function islandCenter(zone: ZoneId): { x: number; z: number } {
  const p = WORLD_ISLANDS.find((i) => i.zone === zone);
  if (!p) return { x: 0, z: 0 };
  return { x: p.x, z: p.z };
}

/** Where the child may walk: anywhere on the grass, a soft ring. */
export const WORLD_WALK_RADIUS = 15.5;

/** Clamp a target point into the walkable world (keeps kids in the garden). */
export function clampToWalkArea(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= WORLD_WALK_RADIUS) return { x, z };
  const k = WORLD_WALK_RADIUS / d;
  return { x: x * k, z: z * k };
}

/* ---------- calm walking (critic round B, W4) ---------- */

/** Peak walk speed — calm enough to watch the garden, brisk enough to keep a 5yo engaged. */
export const MAX_WALK_SPEED = 3.4;

/** Distance at which a walk target counts as reached. */
export const WALK_ARRIVE_EPS = 0.09;

/**
 * One frame of a walk: the exponential ease is kept (it gives the soft
 * landing) but the peak speed is CLAMPED — the old inline formula hit
 * ~65 u/s on the first frame of a cross-world walk (one giant lurch).
 * Pure so the lurch stays dead by unit test, never by screenshot.
 */
export function walkStepToward(
  from: { x: number; z: number },
  to: { x: number; z: number },
  dt: number,
  rate = 2.1,
): { x: number; z: number; arrived: boolean } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d <= WALK_ARRIVE_EPS) return { x: to.x, z: to.z, arrived: true };
  const safeDt = Math.max(0, Math.min(dt, 0.1));
  const k = Math.min(1, safeDt * rate * (0.55 + Math.min(1, d / 2.5)));
  const step = Math.min(d * k, MAX_WALK_SPEED * safeDt);
  if (d - step <= WALK_ARRIVE_EPS) return { x: to.x, z: to.z, arrived: true };
  return { x: from.x + (dx * step) / d, z: from.z + (dz * step) / d, arrived: false };
}

/**
 * True when the point sits inside an island platform — used to lift
 * walk markers onto platform height instead of sinking into them.
 */
export function isInsideIsland(x: number, z: number): boolean {
  for (const p of WORLD_ISLANDS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius) return true;
  }
  return false;
}

/**
 * The zone whose island contains (or is closest within `maxDist` to)
 * the given point — the "near zone" the child is visiting right now.
 */
export function nearestZone(
  x: number,
  z: number,
  maxDist: number,
): { zone: ZoneId; dist: number } | null {
  let best: { zone: ZoneId; dist: number } | null = null;
  for (const p of WORLD_ISLANDS) {
    const dist = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.radius);
    if (dist <= maxDist && (best === null || dist < best.dist)) {
      best = { zone: p.zone, dist };
    }
  }
  return best;
}

export interface WalkResolution {
  x: number;
  z: number;
  /** true when the tap landed on a locked (fog) island — the child is
      gently held at the rim instead of walking into the fog */
  blocked: boolean;
  /** the locked zone that caused the block (when blocked) */
  blockedZone: ZoneId | null;
}

/**
 * Resolve a walk target against the locked gates: unlocked islands
 * and open grass accept the point as-is; a locked fog island holds
 * the child at its rim (never inside the fog — nothing to do there
 * but feel locked out).
 */
export function resolveWalkTarget(
  x: number,
  z: number,
  isZoneLocked: (zone: ZoneId) => boolean,
): WalkResolution {
  const clamped = clampToWalkArea(x, z);
  for (const p of WORLD_ISLANDS) {
    const d = Math.hypot(clamped.x - p.x, clamped.z - p.z);
    if (d < p.radius + 0.15 && isZoneLocked(p.zone)) {
      /* push the target out to the island's rim (a dead-center tap
         still gets a real direction: back toward the world center) */
      const ang =
        d < 0.01
          ? Math.atan2(-p.z, -p.x)
          : Math.atan2(clamped.z - p.z, clamped.x - p.x);
      const rr = p.radius + 0.45;
      const rim = clampToWalkArea(p.x + Math.cos(ang) * rr, p.z + Math.sin(ang) * rr);
      return { x: rim.x, z: rim.z, blocked: true, blockedZone: p.zone };
    }
  }
  return { x: clamped.x, z: clamped.z, blocked: false, blockedZone: null };
}

/**
 * Control points for the path: the world center, then every island,
 * with arc midpoints between consecutive islands so the ribbon
 * follows the spiral instead of cutting straight chords.
 */
export function pathControlPoints(): Array<{ x: number; z: number }> {
  const pts: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];
  for (let i = 0; i < WORLD_ISLANDS.length; i++) {
    const p = WORLD_ISLANDS[i];
    if (i > 0) {
      /* arc midpoint between island i-1 and i (golden-angle step) */
      const prev = WORLD_ISLANDS[i - 1];
      const a0 = Math.atan2(prev.z, prev.x);
      const a1 = Math.atan2(p.z, p.x);
      const mid = a0 + (a1 - a0) / 2;
      const rm = (prev.dist + p.dist) / 2;
      pts.push({ x: Math.cos(mid) * rm, z: Math.sin(mid) * rm });
    }
    pts.push({ x: p.x, z: p.z });
  }
  return pts;
}

/** Smooth polyline through the islands (Catmull-Rom, world XZ). */
export function pathPoints(): Array<{ x: number; z: number }> {
  return catmullRom2(pathControlPoints(), 12);
}

/** Classic Catmull-Rom over XZ points (closed=false). */
export function catmullRom2(points: Array<{ x: number; z: number }>, perSeg: number): Array<{ x: number; z: number }> {
  if (points.length < 2) return [...points];
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        z:
          0.5 *
          (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
