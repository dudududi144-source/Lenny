/* TEMP design script for stage 16-a — deleted before commit. */
import { describe, it } from 'vitest';
import { LANDMARKS, WORLD_ISLANDS, WORLD_WALK_RADIUS, WANDER_RADIUS, pathPoints } from '../world/WorldLayout';
import { REGIONS, REGION_ROADS, RIVER_CONTROL, regionAt } from '../world/WorldRegions';
import { STATIONS, stationPathClearance, STATION_ROAD_CLEARANCE, STATION_LANDMARK_CLEARANCE, STATION_ISLAND_CLEARANCE, STATION_SPACING } from '../world/WorldStations';

const arcLen = (pts: Array<{ x: number; z: number }>): number[] => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return acc;
};

describe('design 16-a', () => {
  it('road braid matrix', () => {
    console.log('=== BRAID (min pairwise road distance) ===');
    let globalMin = Infinity;
    for (let i = 0; i < REGION_ROADS.length; i++) {
      for (let j = i + 1; j < REGION_ROADS.length; j++) {
        let min = Infinity;
        for (const p of REGION_ROADS[i].points) {
          for (const q of REGION_ROADS[j].points) {
            const d = Math.hypot(p.x - q.x, p.z - q.z);
            if (d < min) min = d;
          }
        }
        globalMin = Math.min(globalMin, min);
        console.log(`${REGION_ROADS[i].region} <-> ${REGION_ROADS[j].region}: ${min.toFixed(1)}`);
      }
    }
    console.log('GLOBAL MIN:', globalMin.toFixed(2));
  });

  it('road landmark coverage gaps', () => {
    console.log('=== ROAD SERVICE GAPS (perp<=30 / <=45) ===');
    for (const road of REGION_ROADS) {
      const acc = arcLen(road.points);
      const total = acc[acc.length - 1];
      const marks30: number[] = [];
      for (const l of LANDMARKS) {
        let best = Infinity;
        let bestT = 0;
        for (let i = 0; i < road.points.length; i++) {
          const d = Math.hypot(road.points[i].x - l.x, road.points[i].z - l.z);
          if (d < best) {
            best = d;
            bestT = acc[i];
          }
        }
        if (best <= 30) marks30.push(bestT);
        void bestT;
      }
      marks30.sort((a, b) => a - b);
      let maxGap = marks30.length ? Math.max(marks30[0], total - marks30[marks30.length - 1]) : total;
      for (let i = 1; i < marks30.length; i++) maxGap = Math.max(maxGap, marks30[i] - marks30[i - 1]);
      console.log(`${road.region}: len=${total.toFixed(0)} n30=${marks30.length} maxGap30=${maxGap.toFixed(0)}`);
    }
  });

  it('sector x ring coverage (60deg x 300u)', () => {
    const rings = [0, 300, 600, 900, 1200, WORLD_WALK_RADIUS + 1];
    const cells = new Map<string, number>();
    for (const l of LANDMARKS) {
      const d = Math.hypot(l.x, l.z);
      let ring = -1;
      for (let i = 0; i < 5; i++) if (d >= rings[i] && d < rings[i + 1]) ring = i;
      if (ring < 0) continue;
      const ang = (Math.atan2(l.z, l.x) + Math.PI * 2) % (Math.PI * 2);
      const k = `${Math.floor(ang / (Math.PI / 3))}:${ring}`;
      cells.set(k, (cells.get(k) ?? 0) + 1);
    }
    console.log('=== SECTOR x RING (6x5) ===');
    for (let s = 0; s < 6; s++) {
      const row: string[] = [];
      for (let r = 0; r < 5; r++) row.push(String(cells.get(`${s}:${r}`) ?? 0).padStart(3));
      console.log(`sector ${s}: ${row.join(' ')}`);
    }
  });

  it('river distance of landmarks', () => {
    let worst = Infinity;
    let worstId = '';
    for (const l of LANDMARKS) {
      for (const p of RIVER_CONTROL) {
        const d = Math.hypot(l.x - p.x, l.z - p.z);
        if (d < worst) {
          worst = d;
          worstId = l.id;
        }
      }
    }
    console.log('closest landmark to river controls:', worstId, worst.toFixed(1));
  });

  it('region hearts + bearings', () => {
    for (const r of REGIONS) {
      const d = Math.hypot(r.x, r.z);
      const ang = ((Math.atan2(r.z, r.x) * 180) / Math.PI + 360) % 360;
      console.log(`${r.id}: d=${d.toFixed(0)} bearing=${ang.toFixed(1)} outer=${(d + r.radius).toFixed(0)} inner=${(d - r.radius).toFixed(0)}`);
    }
    console.log('WALK', WORLD_WALK_RADIUS, 'WANDER', WANDER_RADIUS);
  });

  it('station clearance status quo', () => {
    let roadMin = Infinity;
    for (const s of STATIONS) roadMin = Math.min(roadMin, stationPathClearance(s.x, s.z));
    console.log('stations:', STATIONS.length, 'min road clearance:', roadMin.toFixed(2), 'required', STATION_ROAD_CLEARANCE);
  });

  it('far station candidates', () => {
    /* cloud isles pads (theme zone space-sky), star desert pads (rhythm-square),
       six far-reach pads. Verify every clearance the build sanity gate uses. */
    const cands: Array<{ key: string; region: string; zone: string; band: number; x: number; z: number }> = [
      { key: 'cloud:0', region: 'cloud', zone: 'space-sky', band: 0, x: 268, z: -1108 },
      { key: 'cloud:1', region: 'cloud', zone: 'space-sky', band: 1, x: 396, z: -1122 },
      { key: 'cloud:2', region: 'cloud', zone: 'space-sky', band: 2, x: 318, z: -1222 },
      { key: 'star:0', region: 'star', zone: 'rhythm-square', band: 0, x: 272, z: 1148 },
      { key: 'star:1', region: 'star', zone: 'rhythm-square', band: 1, x: 398, z: 1162 },
      { key: 'star:2', region: 'star', zone: 'rhythm-square', band: 2, x: 320, z: 1256 },
      { key: 'far:honey', region: '', zone: 'space-sky', band: 0, x: -1015, z: -126 },
      { key: 'far:snowfriend', region: '', zone: 'space-sky', band: 2, x: -940, z: 552 },
      { key: 'far:moonpond', region: '', zone: 'words-valley', band: 1, x: 92, z: 1040 },
      { key: 'far:reedhut', region: '', zone: 'creativity-meadow', band: 0, x: 982, z: 572 },
      { key: 'far:sunclock', region: '', zone: 'rhythm-square', band: 2, x: 838, z: -728 },
      { key: 'far:starstone', region: '', zone: 'attention-stream', band: 1, x: 312, z: -938 },
    ];
    for (const c of cands) {
      const road = stationPathClearance(c.x, c.z);
      let lm = Infinity;
      for (const l of LANDMARKS) lm = Math.min(lm, Math.hypot(c.x - l.x, c.z - l.z) - l.keep);
      let isl = Infinity;
      for (const p of WORLD_ISLANDS) isl = Math.min(isl, Math.hypot(c.x - p.x, c.z - p.z) - p.radius);
      let pad = Infinity;
      for (const s of STATIONS) pad = Math.min(pad, Math.hypot(c.x - s.x, c.z - s.z));
      const inRegion = regionAt(c.x, c.z)?.id ?? 'wilds';
      const d = Math.hypot(c.x, c.z);
      console.log(
        `${c.key}: d=${d.toFixed(0)} region=${inRegion} road=${road.toFixed(1)}(${road >= STATION_ROAD_CLEARANCE ? 'OK' : 'FAIL'}) landmark+1=${lm.toFixed(1)}(${lm >= STATION_LANDMARK_CLEARANCE ? 'OK' : 'FAIL'}) island+2.2=${isl.toFixed(1)}(${isl >= STATION_ISLAND_CLEARANCE || c.region ? 'OK' : 'FAIL'}) pad=${pad.toFixed(1)}(${pad >= STATION_SPACING ? 'OK' : 'FAIL'})`,
      );
    }
  });

  it('hub path distance sanity for new landmark slots', () => {
    const path = pathPoints();
    console.log('hub path pts:', path.length, 'last:', path[path.length - 1]);
  });
});
