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
import { REGION_ROADS } from './WorldRegions';

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

/** All thirty clearings, hub first (journey order = WORLD_ISLANDS order). */
export const STATIONS: StationSpot[] = WORLD_ISLANDS.flatMap((p) => BY_ZONE[p.zone]);

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
  for (const s of STATIONS) {
    if (!zoneUnlocked(s.zone)) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d <= maxDist && (best === null || d < best.dist)) best = { station: s, dist: d };
  }
  return best;
}

/** The pad radius — step on it and the games offer themselves. */
export const STATION_PAD_RADIUS = 0.95;

/** Standing on the pad counts as "on station" (the pad reads from afar, enters from near). */
export const STATION_NEAR_RADIUS = 1.15;

/* ---------- clearance invariants (unit-pinned) ---------- */

/** min distance from any road/hub-path centerline (the pad never blocks the walk) */
export const STATION_ROAD_CLEARANCE = 1.9;
/** min distance beyond a landmark's keep-out */
export const STATION_LANDMARK_CLEARANCE = 1.0;
/** min distance to another zone island's rim */
export const STATION_ISLAND_CLEARANCE = 2.2;
/** min distance between two clearings */
export const STATION_SPACING = 2.4;

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

/** A station's own id (stable, e2e + storage). */
export function stationId(s: StationSpot): string {
  return `${s.zone}:${s.band}`;
}

/** True when the point respects every static clearance (tests + build-time sanity). */
export function stationClearancesHold(list: readonly StationSpot[] = STATIONS): boolean {
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
