/* ============================================================
 * WorldLayout — the pure geometry of the 3D garden (unit-tested).
 *
 * STAGE 11 — the great journey (Croc-scale, still zero assets):
 *   - The curated garden ring grew ~×10 in area: ten zone islands
 *     along one golden-angle spiral, from שְׁבִיל הָאוֹר near the
 *     center to בְּרֵכַת הַנְּשִׁימָה at the calm far end.
 *   - Beyond the curated ring: the ENDLESS MEADOW — procedural
 *     streamed chunks out to WANDER_RADIUS, seeded and
 *     deterministic (WorldMeadow). "כמעט אין סופי" with a way home.
 *   - SIXTEEN named landmarks off the spiral (the eight beloved
 *     places + eight new ones), FOUR named friends along the road,
 *     and signpost waypoints that make the journey legible.
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
const START_RADIUS = 8.5;
const RADIUS_STEP = 4.35;
const ISLAND_RADIUS = 2.6;

/** The spiral path that connects the islands (the ribbon on the grass). */
export const PATH_WIDTH = 0.85;

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

/* ---------- the two rings of the world ---------- */

/** The curated garden: islands, landmarks, friends, the road. */
export const WORLD_WALK_RADIUS = 51;

/** Beyond the garden — the endless meadow (WorldMeadow chunks). */
export const WANDER_RADIUS = 168;

/** Clamp a target point into the whole wanderable world (the child stays in the world, the world never ends visibly). */
export function clampToWanderArea(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= WANDER_RADIUS) return { x, z };
  const k = WANDER_RADIUS / d;
  return { x: x * k, z: z * k };
}

/** Clamp a target point into the curated garden ring (quest targets, landmarks). */
export function clampToWalkArea(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= WORLD_WALK_RADIUS) return { x, z };
  const k = WORLD_WALK_RADIUS / d;
  return { x: x * k, z: z * k };
}

/* ---------- calm walking (critic round B, W4) ---------- */

/** Peak walk speed — calm enough to watch the garden, brisk enough to keep a 5yo engaged on a big map. */
export const MAX_WALK_SPEED = 4.4;

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

/* ---------- landmarks: the world beyond the path ---------- */

/**
 * SIXTEEN discovery landmarks OFF the spiral — the "מה יש מעבר לפינה?"
 * the garden always promised, now at journey scale. Each is a place
 * with a name (Hebrew, niqqud — environmental print the child can
 * read after finding it) and a one-line narration that teaches one
 * true thing about it.
 *
 * Placement invariants (unit-pinned):
 *   - inside the curated walk radius with a 0.7 margin
 *   - ≥1.5 from every island rim, ≥1.2 from the path centerline
 *   - ≥4.5 apart — landmarks are destinations, not a cluster
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
  | 'turtle-rock'
  | 'orchard'
  | 'hollow-log'
  | 'swing'
  | 'well'
  | 'balloon'
  | 'sunflower'
  | 'crystal-cave'
  | 'campfire';

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
    x: -8.87,
    z: 32.14,
    keep: 1.7,
  },
  {
    id: 'pond',
    name: 'הַבְּרֵכָה הַקְּטַנָּה',
    line: 'הַבְּרֵכָה! רוֹאִים בָּהּ אֶת הַשֶּׁמֶשׁ מְנַצְנֵצֶת עַל הַמַּיִם.',
    x: 4.29,
    z: -29.39,
    keep: 1.3,
  },
  {
    id: 'mushrooms',
    name: 'מַעְגַּל הַפְּטְרִיּוֹת',
    line: 'מַעְגַּל פְּטְרִיּוֹת! הֵן גָּדְלוּ כָּאן בְּמָעוֹל, אַחַת לְיַד הַשְּׁנִיָּה.',
    x: 20.32,
    z: -1.69,
    keep: 1.3,
  },
  {
    id: 'windmill',
    name: 'טַחֲנַת הָרוּחַ',
    line: 'טַחֲנַת הָרוּחַ! הַכַּנְפַיִם שֶׁלָּהּ מִסְתּוֹבְבוֹת לְאַט, לְאַט.',
    x: 28.21,
    z: -20.81,
    keep: 1.5,
  },
  {
    id: 'rainbow',
    name: 'קֶשֶׁת בַּגַּן',
    line: 'קֶשֶׁת! צְבָעִים בָּאִים לְבַקֵּר אֶת הַגַּן.',
    x: 0.65,
    z: 11.74,
    keep: 1.6,
  },
  {
    id: 'fireflies',
    name: 'קְרֵחַת הַנְּצִנְצִים',
    line: 'קְרֵחַת הַנְּצִנְצִים! כָּאן הָאוֹר מְנַצְנֵץ גַּם בַּלַּיְלָה.',
    x: -45.03,
    z: 14.24,
    keep: 1.3,
  },
  {
    id: 'beehive',
    name: 'בֵּית הַדְּבוֹרִים',
    line: 'בֵּית הַדְּבוֹרִים! בּוּם, בּוּם — הַדְּבוֹרִים עוֹבְדוֹת כָּאן.',
    x: 16.83,
    z: 21.53,
    keep: 1.8,
  },
  {
    id: 'turtle-rock',
    name: 'אֶבֶן הַצָּב',
    line: 'אֶבֶן הַצָּב! הִיא נִרְאֵית כְּמוֹ צָב יָשֵׁן וְחָכָם.',
    x: -3.08,
    z: -37.12,
    keep: 1.5,
  },
  {
    id: 'orchard',
    name: 'פַּרְדֵּס הַפֵּרוֹת',
    line: 'הַפַּרְדֵּס! עֵצֵי תַּפּוּחַ טְעוּנִים בְּפֵרוֹת אֲדֻמִּים.',
    x: -25.1,
    z: 31.32,
    keep: 1.4,
  },
  {
    id: 'hollow-log',
    name: 'הַבּוֹל הַחָלוּל',
    line: 'בּוֹל חָלוּל! מִי גָּר בְּפֶנִים? אוּלַי קִפּוּד קָטָן.',
    x: -41.28,
    z: -16.17,
    keep: 1.6,
  },
  {
    id: 'swing',
    name: 'הַנְּדָנְדָּה',
    line: 'נְדָנְדָּה! הַמוֹשָׁב מִתְנַדְנֵד בָּרוּחַ, קָדִימָה וְאָחוֹרָה.',
    x: -35.27,
    z: -24.54,
    keep: 1.3,
  },
  {
    id: 'well',
    name: 'בְּאֵר הַגַּן',
    line: 'הַבְּאֵר! זוֹרְקִים פֶּה לְתוֹךְ הַמַּיִם וְשׁוֹמְעִים בֻּלְבֻּל.',
    x: 34.93,
    z: 28.07,
    keep: 1.4,
  },
  {
    id: 'balloon',
    name: 'הַבָּלוּן הַגָּדוֹל',
    line: 'בָּלוּן עָנָק! הוּא קָשׁוּר לַקַּרְקַע וּמְנַפְנֵף לְמַעְלָה.',
    x: -22.72,
    z: 37.85,
    keep: 1.5,
  },
  {
    id: 'sunflower',
    name: 'חַמָּנִית עָנָקִית',
    line: 'חַמָּנִית עָנָקִית! הִיא מַסְתַּכֶּלֶת אֶל הַשֶּׁמֶשׁ כָּל הַיּוֹם.',
    x: -10.54,
    z: -29.82,
    keep: 1.4,
  },
  {
    id: 'crystal-cave',
    name: 'מְעָרַת הַנְּצִנְצִים',
    line: 'הַמָּעָרָה! הַבִּדּוּלִיּוֹת בְּפֶנִים מְנַצְנְצוֹת כְּמוֹ כּוֹכָבִים.',
    x: -47.47,
    z: 8.26,
    keep: 1.3,
  },
  {
    id: 'campfire',
    name: 'מַדּוּרַת הַגַּן',
    line: 'מַדּוּרָה! סָבִיב הָאוֹר יוֹשְׁבִים וּמְסַפְּרִים סִפּוּרִים.',
    x: -10.58,
    z: -2.47,
    keep: 1.3,
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
 * Slide the presence out of a landmark's keep-out (critic V1).
 *
 * The walk SURVIVES: the child is pushed to the rim with a small
 * tangential bias toward the target's side, so the slide naturally
 * rounds the place and continues. A walk whose DESTINATION is inside
 * the keep-out is the place visit — it ends here. Pure, so the stall
 * case (target dead-behind the place) is unit-pinned.
 */
export function slideAroundLandmark(
  l: LandmarkDef,
  px: number,
  pz: number,
  target: { x: number; z: number } | null,
): { x: number; z: number; arrived: boolean } {
  const dx = px - l.x;
  const dz = pz - l.z;
  const d = Math.hypot(dx, dz);
  const baseAng = d < 1e-6 ? Math.atan2(-l.z, -l.x) : Math.atan2(dz, dx);

  /* the rim radius — clamp the (rare) deep-inside point out to the edge */
  const r = l.keep + 0.02;

  /* bias: rotate 20° toward the side of the target, so a nearly radial
     pass still gains tangential progress and never stalls on the rim */
  let bias = 0;
  if (target) {
    const cross = dx * (target.z - l.z) - dz * (target.x - l.x);
    bias = (cross >= 0 ? 1 : -1) * 0.35;
  }
  const ang = baseAng + bias;

  /* the walk ends here only when the errand itself pointed into the
     keep-out — that was a place visit, and the rim IS the place */
  const arrived = target !== null && Math.hypot(target.x - l.x, target.z - l.z) < l.keep + 0.1;

  return {
    x: l.x + Math.cos(ang) * r,
    z: l.z + Math.sin(ang) * r,
    arrived,
  };
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
 * but feel locked out). Valid across the WHOLE wanderable world —
 * the endless meadow is tap-walkable too.
 */
export function resolveWalkTarget(
  x: number,
  z: number,
  isZoneLocked: (zone: ZoneId) => boolean,
): WalkResolution {
  const clamped = clampToWanderArea(x, z);
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
      const rim = clampToWanderArea(p.x + Math.cos(ang) * rr, p.z + Math.sin(ang) * rr);
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
    const p3 = Math.min(points.length - 1, i + 2);
    const pp = points[p3];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - pp.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + pp.x) * t3),
        z:
          0.5 *
          (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - pp.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + pp.z) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/* ---------- the journey made legible: signposts (stage 11) ---------- */

export interface SignpostDef {
  index: number;
  x: number;
  z: number;
  /** where the arrow points: the next island down the road */
  toZone: ZoneId;
  /** walking distance along the road to that island, rounded to steps */
  steps: number;
  facing: number; /* radians — the plate turns toward the walker */
}

/**
 * Five signposts along the road, at even fractions of the path.
 * Pure and deterministic: computed from the same spiral the islands
 * come from, offset to the side of the road so they never block it.
 */
export function signposts(): SignpostDef[] {
  const pts = pathPoints();
  const total = pts.length;
  const out: SignpostDef[] = [];
  const fractions = [0.14, 0.32, 0.5, 0.68, 0.86];
  for (let s = 0; s < fractions.length; s++) {
    const at = pts[Math.min(total - 1, Math.round(fractions[s] * (total - 1)))];
    const next = pts[Math.min(total - 1, Math.round(fractions[s] * (total - 1)) + 3)];
    /* perpendicular offset — stand beside the road, not on it (and
       far enough that a neighboring arc segment never crowds it) */
    const dx = next.x - at.x;
    const dz = next.z - at.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = s % 2 === 0 ? 1 : -1;
    const px = at.x + (-dz / len) * 1.85 * side;
    const pz = at.z + (dx / len) * 1.85 * side;
    /* the next island center after this fraction of the road */
    const zoneIdx = Math.min(WORLD_ISLANDS.length - 1, Math.ceil(fractions[s] * (WORLD_ISLANDS.length - 1)) + 1);
    const to = WORLD_ISLANDS[zoneIdx];
    /* steps ≈ road distance remaining, at a child's stride */
    let roadLeft = 0;
    for (let i = Math.round(fractions[s] * (total - 1)); i < total - 1; i++) {
      roadLeft += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    }
    out.push({
      index: s,
      x: px,
      z: pz,
      toZone: to.zone,
      steps: Math.max(4, Math.round(roadLeft * 1.2)),
      facing: Math.atan2(dz, dx),
    });
  }
  return out;
}

/** Deterministic signpost placements (consumed by WorldRoad + tests). */
export const WORLD_SIGNPOSTS: SignpostDef[] = signposts();

/* ---------- friends: the named faces of the garden (stage 11) ---------- */

export type FriendKind = 'bee' | 'snail' | 'frog' | 'bunny';

export interface FriendDef {
  id: FriendKind;
  name: string; /* Hebrew with niqqud */
  line: string; /* the bubble when the child comes close */
  x: number;
  z: number;
}

/**
 * Four named friends who live beside the road. They are never a
 * gate and never a task — a friendly face makes a long walk feel
 * populated (and gives the child a reason to leave the path).
 */
export const FRIENDS: FriendDef[] = [
  {
    id: 'bee',
    name: 'בִּזְבַּז הַדְּבוֹרָה',
    line: 'בּוּז, בּוּז! מֵעֵבֶר לַדֶּרֶךְ יֵשׁ עוֹד פְּרָחִים. בוֹא נִרְאֶה!',
    x: 33.9,
    z: 22.7,
  },
  {
    id: 'snail',
    name: 'חִלִּי הַחִלָּזוֹן',
    line: 'אֲנִי מַסְפִּיק לְהַסְתַּכֵּל עַל כָּל פֶּרַח בַּדֶּרֶךְ. גַּם אַתָּה?',
    x: 1.3,
    z: 35.0,
  },
  {
    id: 'frog',
    name: 'צָפִי הַצָּפָרְדֵעַ',
    line: 'קְוָה, קְוָה! אֲנִי קוֹפֵץ גָּבוֹהַּ. רוֹצֶה לְנַסּוֹת?',
    x: 13.2,
    z: 16.9,
  },
  {
    id: 'bunny',
    name: 'צָמֶרֶת הַאַרְנֶבֶת',
    line: 'קִפִּיף, קִפִּיף! הַגַּן גָּדוֹל וּמְלֵא הַפְּתָעוֹת.',
    x: 4.0,
    z: -20.3,
  },
];

/** The friend standing within `maxDist` of the point (or null). */
export function nearestFriend(
  x: number,
  z: number,
  maxDist: number,
): { friend: FriendDef; dist: number } | null {
  let best: { friend: FriendDef; dist: number } | null = null;
  for (const f of FRIENDS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d <= maxDist && (best === null || d < best.dist)) {
      best = { friend: f, dist: d };
    }
  }
  return best;
}

/* ---------- the wayfinding compass (stage 11) ---------- */

export interface ZoneHint {
  zone: ZoneId;
  /** screen-free bearing: the angle to rotate an arrow (radians, 0 = up) */
  bearing: number;
  /** straight-line distance in "child steps" (≈1.2 per world unit) */
  steps: number;
}

/**
 * Where should the compass point? The nearest UNLOCKED zone the
 * child is not standing in — the journey's next honest destination.
 * Pure: bearing = atan2(dx, dz) so 0 means "the arrow points up".
 */
export function zoneHint(
  x: number,
  z: number,
  isUnlockedZone: (zone: ZoneId) => boolean,
): ZoneHint | null {
  let best: { zone: ZoneId; d: number } | null = null;
  for (const p of WORLD_ISLANDS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d <= p.radius + NEAR_HINT_SKIP) continue; /* you are here */
    if (!isUnlockedZone(p.zone)) continue;
    if (best === null || d < best.d) best = { zone: p.zone, d };
  }
  if (best === null) return null;
  const p = WORLD_ISLANDS.find((i) => i.zone === best!.zone)!;
  return {
    zone: best.zone,
    bearing: Math.atan2(p.x - x, p.z - z),
    steps: Math.max(2, Math.round(best.d * 1.2)),
  };
}

/** a point closer than this to an island's center reads as "you are here" */
const NEAR_HINT_SKIP = 3.2;
