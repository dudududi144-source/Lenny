/* ============================================================
 * WorldStations — the games leave the island (stage 14).
 *
 * The owner's verdict on stage 12: "המשחקים מרוכזים" — the games
 * still lived ONLY on the ten islands, one shelf each, so a whole
 * continent of walking led to ten tiny doorways. Stage 14 scatters
 * THIRTY game clearings across the map: every zone hosts THREE
 * clearing pads around its island, one per tier band —
 *
 *   band 0  הַמִּשְׂחָקִים הָרִאשׁוֹנִים  (baseTier 0)
 *   band 1  הַמִּשְׂחָקִים הַבָּאִים     (baseTier 1)
 *   band 2  מִשְׂחָקֵי הָאָמִיץ       (baseTier 2 + 3)
 *
 * A pad is a place, not a popup: a glowing disc, a pennant that
 * carries the zone color and the band's dots, and a light pillar
 * tall enough to find from the next hill. Walking ONTO a pad (or
 * tapping it) offers exactly that band's games — the island itself
 * keeps its full shelf. The unlock fog owns the clearings too: a
 * locked zone's pads never show.
 *
 * Pure math only — the unit tests pin every clearance the world
 * depends on (roads, landmarks, islands, each other).
 * ============================================================ */

import { type ZoneId } from '../data/garden';
import { HUB_JOURNEY, LANDMARKS, WORLD_ISLANDS, pathPoints } from './WorldLayout';
import { REGION_ROADS, type RegionId } from './WorldRegions';

export type StationBand = 0 | 1 | 2;

export const BAND_COUNT = 3;

/** The journey's bands, in Hebrew a four-year-old can read. */
export const BAND_NAMES: Record<StationBand, string> = {
  0: 'הַמִּשְׂחָקִים הָרִאשׁוֹנִים',
  1: 'הַמִּשְׂחָקִים הַבָּאִים',
  2: 'מִשְׂחָקֵי הָאָמִיץ',
};

/** Which shelf band owns a catalog spec (spec.baseTier is 0..3). */
export function tierBandOf(baseTier: number): StationBand {
  if (baseTier <= 0) return 0;
  if (baseTier === 1) return 1;
  return 2;
}

/** Filter a zone catalog down to one clearing's games (island shelf = no band). */
export function specsForBand<T extends { baseTier: number }>(specs: readonly T[], band: StationBand): T[] {
  return specs.filter((s) => tierBandOf(s.baseTier) === band);
}

export interface StationSpot {
  zone: ZoneId;
  band: StationBand;
  x: number;
  z: number;
  /** distance from the zone's island center */
  dist: number;
  /** the pennant's world bearing (faces the island) */
  facing: number;
  /** stage 16-a: set on FAR clearings — the region that hosts the pad
   *  (the pad's mesh name keys on it, so far pads never collide with
   *  the zone pads; `zone` stays the shelf's catalog + unlock fog). */
  region?: RegionId;
  /** stage 16-a: stable unique id for far pads (`far:<region|place>:<band>`). */
  key?: string;
}

/** Deterministic per-zone fan base (golden-angle spread across zones). */
function zoneBaseAngle(zone: ZoneId, index: number): number {
  /* the hub islands fan OUTWARD (away from the world center) so the
     clearings never crowd the spiral; the far zones spread evenly. */
  void zone;
  return index * 2.39996 + 0.7;
}

const HUB_FAN: Array<[number, number]> = [
  [-0.66, 4.6],
  [0.0, 6.4],
  [1.15, 10.5],
]; /* [bearing offset from outward, extra distance] per band */

const FAR_FAN: Array<[number, number]> = [
  [0.0, 3.6],
  [2.0944, 5.6],
  [4.6, 7.8],
];

function stationsFor(zone: ZoneId, index: number): StationSpot[] {
  const island = WORLD_ISLANDS.find((i) => i.zone === zone)!;
  const isHub = HUB_JOURNEY.includes(zone);
  const out: StationSpot[] = [];
  for (let band = 0 as StationBand; band < BAND_COUNT; band = (band + 1) as StationBand) {
    const [offset, extra] = isHub ? HUB_FAN[band] : FAR_FAN[band];
    const base = isHub ? Math.atan2(island.z, island.x) : zoneBaseAngle(zone, index);
    const bearing = base + offset;
    const dist = island.radius + extra;
    const sx = island.x + Math.cos(bearing) * dist;
    const sz = island.z + Math.sin(bearing) * dist;
    out.push({
      zone,
      band: band as StationBand,
      x: sx,
      z: sz,
      dist,
      /* the pennant turns to face its island (the pad reads from the road) */
      facing: Math.atan2(island.z - sz, island.x - sx),
    });
  }
  return out;
}

const BY_ZONE: Record<string, StationSpot[]> = {};
WORLD_ISLANDS.forEach((p, i) => {
  BY_ZONE[p.zone] = stationsFor(p.zone, i);
});

/** All thirty zone clearings, hub first (journey order = WORLD_ISLANDS order). */
export const STATIONS: StationSpot[] = WORLD_ISLANDS.flatMap((p) => BY_ZONE[p.zone]);

/* ---------- stage 16-a: the FAR clearings ----------
 *
 * The owner's verdict again: playable content clustered at spawn.
 * The thirty zone clearings all hug their islands (all ≤ ~930 out);
 * the far reaches and the two new far lands had NO games at all.
 * Twelve far clearings now carry the three band tiers outward:
 *
 *   - the cloud isles + the star desert: a full 3-band family each
 *     (the pad's shelf borrows the thematically-nearest zone's
 *     catalog — sky games on the clouds, rhythm games in the
 *     desert — and the unlock fog follows that same zone);
 *   - six single pads beside the far-reach somewhere-places
 *     (honey tree, snow friend, moon pond, reed hut, sun clock,
 *     star stone), banded 0/2/1/0/2/1 so all three tiers wait out
 *     there too.
 *
 * Every far spot passes the SAME clearances (roads, landmarks,
 * islands, pads) — pinned by unit test.
 */
const farSpot = (
  key: string,
  zone: ZoneId,
  band: StationBand,
  x: number,
  z: number,
  region?: RegionId,
): StationSpot => ({
  key,
  zone,
  band,
  x,
  z,
  dist: Math.hypot(x, z),
  /* the pennant turns toward the world center (the pad reads from the road) */
  facing: Math.atan2(-z, -x),
  region,
});

export const FAR_STATIONS: StationSpot[] = [
  /* the cloud isles — sky games over the clouds (space-sky fog owns them) */
  farSpot('far:cloud:0', 'space-sky', 0, 268, -1108, 'cloud'),
  farSpot('far:cloud:1', 'space-sky', 1, 396, -1122, 'cloud'),
  farSpot('far:cloud:2', 'space-sky', 2, 318, -1222, 'cloud'),
  /* the star desert — rhythm games in the glitter (rhythm-square fog owns them) */
  farSpot('far:star:0', 'rhythm-square', 0, 272, 1148, 'star'),
  farSpot('far:star:1', 'rhythm-square', 1, 398, 1162, 'star'),
  farSpot('far:star:2', 'rhythm-square', 2, 320, 1256, 'star'),
  /* the far reaches — one pad each, every band waits out there */
  farSpot('far:honey-tree', 'space-sky', 0, -1015, -126),
  farSpot('far:snow-friend', 'space-sky', 2, -940, 552),
  farSpot('far:moon-pond', 'words-valley', 1, 92, 1040),
  farSpot('far:reed-hut', 'creativity-meadow', 0, 982, 572),
  farSpot('far:sun-clock', 'rhythm-square', 2, 838, -728),
  farSpot('far:star-stone', 'attention-stream', 1, 312, -938),
];

/* ---------- stage 17: the MID-RING outposts ----------
 *
 * The distribution audit's verdict: between the home clearings
 * (≤ ~27u) and the far ring (≥ ~730u) there was NOTHING — a child
 * walking outward crossed a silent desert before the first far pad.
 * Ten outposts now bridge the gap (radius ~100–540), one per
 * octant, borrowing existing zone catalogs (the same shelf a pad
 * of that zone+band opens anywhere) so the unlock fog and the
 * shelves stay honest. Same clearances, pinned by the unit gate.
 */
const MID_STATIONS: StationSpot[] = [
  farSpot('far:mid:word-e', 'words-valley', 1, 338, 86),
  farSpot('far:mid:memory-ne', 'memory-hill', 0, 250, 360),
  farSpot('far:mid:breath-n', 'breath-pool', 2, -80, 460),
  farSpot('far:mid:attention-nw', 'attention-stream', 0, -400, 230),
  farSpot('far:mid:creativity-w', 'creativity-meadow', 1, -440, -120),
  farSpot('far:mid:thinking-sw', 'thinking-forest', 2, -230, -400),
  farSpot('far:mid:rhythm-s', 'rhythm-square', 0, 120, -450),
  farSpot('far:mid:feelings-se', 'feelings-garden', 1, 420, -240),
  farSpot('far:mid:light-inner', 'light-path', 2, 110, 60),
  farSpot('far:mid:memory-inner', 'memory-hill', 1, -90, -90),
];

/** All clearings (zone pads first, then the far ring), for every consumer. */
export const ALL_STATIONS: StationSpot[] = [...STATIONS, ...MID_STATIONS, ...FAR_STATIONS];

export function stationsOfZone(zone: ZoneId): StationSpot[] {
  return BY_ZONE[zone] ?? [];
}

/** The clearing whose pad contains (or is nearest within maxDist to) the point. */
export function nearestStation(
  x: number,
  z: number,
  maxDist: number,
  zoneUnlocked: (zone: ZoneId) => boolean,
): { station: StationSpot; dist: number } | null {
  let best: { station: StationSpot; dist: number } | null = null;
  for (const s of ALL_STATIONS) {
    if (!zoneUnlocked(s.zone)) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d <= maxDist && (best === null || d < best.dist)) best = { station: s, dist: d };
  }
  return best;
}

/** The pad radius — step on it and the games offer themselves
 *  (14-C ladder: a ~2.3u disc a fox-sized child reads as a place). */
export const STATION_PAD_RADIUS = 1.15;

/** Standing on the pad counts as "on station" (the pad reads from afar, enters from near). */
export const STATION_NEAR_RADIUS = 1.5;

/** A plain-grass tap within this distance of an open pad pulls to the
 *  pad's rim (stage 14: small hands + grazing rays deserve fat targets). */
export const STATION_TAP_SNAP = 3.4;

/* ---------- clearance invariants (unit-pinned) ---------- */

/** min distance from any road/hub-path centerline (the pad never blocks the walk) */
export const STATION_ROAD_CLEARANCE = 1.9;
/** min distance beyond a landmark's keep-out */
export const STATION_LANDMARK_CLEARANCE = 1.0;
/** min distance to another zone island's rim */
export const STATION_ISLAND_CLEARANCE = 2.2;
/** min distance between two clearings (14-C: grown pads need grown gaps) */
export const STATION_SPACING = 3.0;

function minDistToPath(pts: Array<{ x: number; z: number }>, x: number, z: number): number {
  let best = Infinity;
  for (const p of pts) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < best) best = d;
  }
  return best;
}

const HUB_PATH = pathPoints();

/** All road polylines the clearings must respect (hub spiral + region roads). */
export function stationPathClearance(x: number, z: number): number {
  let best = minDistToPath(HUB_PATH, x, z);
  for (const road of REGION_ROADS) {
    const d = minDistToPath(road.points, x, z);
    if (d < best) best = d;
  }
  return best;
}

export { minDistToPath };

/** A station's own id (stable, e2e + storage). Far pads carry their own key. */
export function stationId(s: StationSpot): string {
  return s.key ?? `${s.zone}:${s.band}`;
}

/** The pad's mesh-name identity: zone pads key on zone, far pads on region
 *  (WorldInput parses BOTH — region ids never collide with zone ids). */
export function stationPadKey(s: StationSpot): string {
  return s.region ?? s.zone;
}

/** True when the point respects every static clearance (tests + build-time sanity). */
export function stationClearancesHold(list: readonly StationSpot[] = ALL_STATIONS): boolean {
  for (const s of list) {
    /* roads */
    if (stationPathClearance(s.x, s.z) < STATION_ROAD_CLEARANCE) return false;
    /* landmarks */
    for (const l of LANDMARKS) {
      if (Math.hypot(s.x - l.x, s.z - l.z) < l.keep + STATION_LANDMARK_CLEARANCE) return false;
    }
    /* OTHER islands (own island rim is fine — the pad sits beside it) */
    for (const p of WORLD_ISLANDS) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (p.zone !== s.zone && d < p.radius + STATION_ISLAND_CLEARANCE) return false;
    }
    /* each other */
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z) < STATION_SPACING) return false;
    }
  }
  return true;
}
