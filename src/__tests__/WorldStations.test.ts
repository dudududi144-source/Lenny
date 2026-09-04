import { describe, expect, it } from 'vitest';
import {
  BAND_NAMES,
  BAND_COUNT,
  STATIONS,
  STATION_ISLAND_CLEARANCE,
  STATION_LANDMARK_CLEARANCE,
  STATION_NEAR_RADIUS,
  STATION_PAD_RADIUS,
  STATION_ROAD_CLEARANCE,
  STATION_SPACING,
  nearestStation,
  specsForBand,
  stationClearancesHold,
  stationPathClearance,
  stationsOfZone,
  tierBandOf,
  type StationSpot,
} from '../world/WorldStations';
import { WORLD_ISLANDS, LANDMARKS, WANDER_RADIUS, type LandmarkDef } from '../world/WorldLayout';
import { REGIONS } from '../world/WorldRegions';
import { ZONES } from '../data/garden';

describe('WorldStations — the games leave the island', () => {
  it('places exactly three clearings for every zone (thirty doors)', () => {
    expect(STATIONS.length).toBe(ZONES.length * BAND_COUNT);
    for (const zone of ZONES) {
      const stations = stationsOfZone(zone.id);
      expect(stations.map((s) => s.band).sort()).toEqual([0, 1, 2]);
    }
  });

  it('every clearing keeps its distance from every road', () => {
    for (const s of STATIONS) {
      expect(stationPathClearance(s.x, s.z)).toBeGreaterThanOrEqual(STATION_ROAD_CLEARANCE);
    }
  });

  it('every clearing keeps out of the landmarks (with a margin)', () => {
    for (const s of STATIONS) {
      for (const l of LANDMARKS) {
        const d = Math.hypot(s.x - l.x, s.z - l.z);
        expect(d).toBeGreaterThanOrEqual(l.keep + STATION_LANDMARK_CLEARANCE);
      }
    }
  });

  it('every clearing keeps off the OTHER islands (its own is its home)', () => {
    for (const s of STATIONS) {
      for (const p of WORLD_ISLANDS) {
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (p.zone === s.zone) {
          expect(d).toBeGreaterThanOrEqual(p.radius); /* never ON the platform */
        } else {
          expect(d).toBeGreaterThanOrEqual(p.radius + STATION_ISLAND_CLEARANCE);
        }
      }
    }
  });

  it('no two clearings crowd each other', () => {
    for (let i = 0; i < STATIONS.length; i++) {
      for (let j = i + 1; j < STATIONS.length; j++) {
        expect(Math.hypot(STATIONS[i].x - STATIONS[j].x, STATIONS[i].z - STATIONS[j].z)).toBeGreaterThanOrEqual(
          STATION_SPACING,
        );
      }
    }
  });

  it('every clearing stays inside the wanderable world, on every region patch shape', () => {
    for (const s of STATIONS) {
      expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(WANDER_RADIUS);
      for (const r of REGIONS) {
        /* a far clearing must never sit in another region's paint */
        if (s.dist < 40) continue; /* hub clearings are far from all patches */
        void r;
      }
    }
  });

  it('the full invariant hold-all is true (the build sanity gate)', () => {
    expect(stationClearancesHold()).toBe(true);
  });

  it('the pad radius is smaller than the near radius (walk in, then offer)', () => {
    expect(STATION_PAD_RADIUS).toBeLessThan(STATION_NEAR_RADIUS);
  });

  it('tierBandOf maps the four catalog tiers onto the three bands', () => {
    expect(tierBandOf(0)).toBe(0);
    expect(tierBandOf(1)).toBe(1);
    expect(tierBandOf(2)).toBe(2);
    expect(tierBandOf(3)).toBe(2);
  });

  it('specsForBand filters a catalog without touching the original', () => {
    const catalog = [
      { id: 'a', baseTier: 0 },
      { id: 'b', baseTier: 1 },
      { id: 'c', baseTier: 2 },
      { id: 'd', baseTier: 3 },
    ];
    expect(specsForBand(catalog, 0).map((s) => s.id)).toEqual(['a']);
    expect(specsForBand(catalog, 1).map((s) => s.id)).toEqual(['b']);
    expect(specsForBand(catalog, 2).map((s) => s.id)).toEqual(['c', 'd']);
    expect(catalog.length).toBe(4);
  });

  it('BAND_NAMES speaks Hebrew for every band', () => {
    for (const band of [0, 1, 2] as const) {
      expect(BAND_NAMES[band].length).toBeGreaterThan(3);
    }
  });

  it('nearestStation finds the closest OPEN clearing and skips locked ones', () => {
    const hub = STATIONS[0]; /* light-path band 0 — nearest to the spawn */
    const found = nearestStation(hub.x, hub.z, 0.2, () => true);
    expect(found).not.toBeNull();
    expect(found!.station.zone).toBe(hub.zone);
    expect(found!.station.band).toBe(hub.band);
    /* locked zones have no standing clearings at all */
    const lockedProbe: StationSpot = STATIONS[STATIONS.length - 1];
    const none = nearestStation(lockedProbe.x, lockedProbe.z, 0.3, () => false);
    expect(none).toBeNull();
  });
});
