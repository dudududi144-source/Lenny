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

/* ---------- landmarks: the world beyond the path (critic round B, W1) ---------- */

/**
 * Eight discovery landmarks OFF the spiral — the "מה יש מעבר לפינה?"
 * the garden always promised. Each is a place with a name (Hebrew,
 * niqqud — environmental print the child can read after finding it)
 * and a one-line narration that teaches one true thing about it.
 *
 * Placement invariants (unit-pinned):
 *   - inside the walk radius with a 0.7 margin
 *   - ≥1.5 from every island rim, ≥1.2 from the path centerline
 *   - ≥3.0 apart — landmarks are destinations, not a cluster
 *   - each has a walkable rim spot (the visit point) toward the center
 */
export type LandmarkKind =
  | 'big-tree'
  | 'pond'
  | 'mushrooms'
  | 'windmill'
  | 'rainbow'
  | 'fireflies'
  | 'beehive'
  | 'turtle-rock';

export interface LandmarkDef {
  id: LandmarkKind;
  name: string; /* everyday Hebrew with niqqud */
  line: string; /* Lenny's discovery narration — one true thing */
  x: number;
  z: number;
  /** soft keep-out radius — the child walks to the rim, never inside */
  keep: number;
}

export const LANDMARKS: LandmarkDef[] = [
  {
    id: 'big-tree',
    name: 'הָעֵץ הַגָּדוֹל',
    line: 'זֶה הָעֵץ הַגָּדוֹל! הֶעָלִים שֶׁלּוֹ מִתְנַדְנָדִים בָּרוּחַ.',
    x: -12.4,
    z: 6.8,
    keep: 1.6,
  },
  {
    id: 'pond',
    name: 'הַבְּרֵכָה הַקְּטַנָּה',
    line: 'הַבְּרֵכָה! רוֹאִים בָּהּ אֶת הַשֶּׁמֶשׁ מְנַצְנֵצֶת עַל הַמַּיִם.',
    x: 10.4,
    z: -6.4,
    keep: 1.6,
  },
  {
    id: 'mushrooms',
    name: 'מַעְגַּל הַפְּטְרִיּוֹת',
    line: 'מַעְגַּל פְּטְרִיּוֹת! הֵן גָּדְלוּ כָּאן בְּמָעוֹל, אַחַת לְיַד הַשְּׁנִיָּה.',
    x: -13.0,
    z: -2.2,
    keep: 1.3,
  },
  {
    id: 'windmill',
    name: 'טַחֲנַת הָרוּחַ',
    line: 'טַחֲנַת הָרוּחַ! הַכַּנְפַיִם שֶׁלָּהּ מִסְתּוֹבְבוֹת לְאַט, לְאַט.',
    x: 13.1,
    z: 2.4,
    keep: 1.7,
  },
  {
    id: 'rainbow',
    name: 'קֶשֶׁת בַּגַּן',
    line: 'קֶשֶׁת! צְבָעִים בָּאִים לְבַקֵּר אֶת הַגַּן.',
    x: -6.5,
    z: 12.0,
    keep: 1.5,
  },
  {
    id: 'fireflies',
    name: 'קְרֵחַת הַנְּצִנְצִים',
    line: 'קְרֵחַת הַנְּצִנְצִים! כָּאן הָאוֹר מְנַצְנֵץ גַּם בַּלַּיְלָה.',
    x: -2.6,
    z: 12.6,
    keep: 1.4,
  },
  {
    id: 'beehive',
    name: 'בֵּית הַדְּבוֹרִים',
    line: 'בֵּית הַדְּבוֹרִים! בּוּם, בּוּם — הַדְּבוֹרִים עוֹבְדוֹת כָּאן.',
    x: -0.2,
    z: -9.4,
    keep: 1.2,
  },
  {
    id: 'turtle-rock',
    name: 'אֶבֶן הַצָּב',
    line: 'אֶבֶן הַצָּב! הִיא נִרְאֵית כְּמוֹ צָב יָשֵׁן וְחָכָם.',
    x: -10.2,
    z: -8.8,
    keep: 1.4,
  },
];

/** The walkable spot at the landmark's rim, on the world-center side. */
export function landmarkVisitPoint(l: LandmarkDef): { x: number; z: number } {
  const ang = Math.atan2(l.z, l.x);
  return clampToWalkArea(l.x - Math.cos(ang) * l.keep, l.z - Math.sin(ang) * l.keep);
}

/** Rim spot nearest to a given approach point (the child walks around, not through). */
export function landmarkRimPoint(l: LandmarkDef, fromX: number, fromZ: number): { x: number; z: number } {
  const d = Math.hypot(fromX - l.x, fromZ - l.z);
  const ang = d < 0.01 ? Math.atan2(-l.z, -l.x) : Math.atan2(fromZ - l.z, fromX - l.x);
  return clampToWalkArea(l.x + Math.cos(ang) * (l.keep + 0.3), l.z + Math.sin(ang) * (l.keep + 0.3));
}

/**
 * The landmark whose keep-out contains (or is closest within `maxDist`
 * to) the given point — the place the child is discovering right now.
 */
export function nearestLandmark(
  x: number,
  z: number,
  maxDist: number,
): { landmark: LandmarkDef; dist: number } | null {
  let best: { landmark: LandmarkDef; dist: number } | null = null;
  for (const l of LANDMARKS) {
    const dist = Math.max(0, Math.hypot(x - l.x, z - l.z) - l.keep);
    if (dist <= maxDist && (best === null || dist < best.dist)) {
      best = { landmark: l, dist };
    }
  }
  return best;
}

/**
 * True when the point sits inside a landmark's keep-out — used to lift
 * walk markers and to slide the presence out of props.
 */
export function isInsideLandmark(x: number, z: number): LandmarkDef | null {
  for (const l of LANDMARKS) {
    if (Math.hypot(x - l.x, z - l.z) < l.keep) return l;
  }
  return null;
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
  /** set when the target resolved to a landmark's rim — a place visit */
  landmark: LandmarkDef | null;
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
      return { x: rim.x, z: rim.z, blocked: true, blockedZone: p.zone, landmark: null };
    }
  }
  /* landmark keep-out: the child may stand beside the pond, never in it.
     Not a block — the rim IS the destination, tagged so arrival knows
     which place was found. */
  for (const l of LANDMARKS) {
    const d = Math.hypot(clamped.x - l.x, clamped.z - l.z);
    if (d < l.keep + 0.1) {
      const rim = landmarkRimPoint(l, clamped.x, clamped.z);
      return { x: rim.x, z: rim.z, blocked: false, blockedZone: null, landmark: l };
    }
  }
  return { x: clamped.x, z: clamped.z, blocked: false, blockedZone: null, landmark: null };
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
