/* TEMP design validation for stage 16-a — deleted before commit. */
import { describe, it } from 'vitest';
import { LANDMARKS, WORLD_ISLANDS, WORLD_WALK_RADIUS, pathPoints, landmarkVisitPoint } from '../world/WorldLayout';
import { REGION_ROADS, RIVER_CONTROL, regionAt, regionById } from '../world/WorldRegions';
import { STATIONS, stationPathClearance } from '../world/WorldStations';

interface P {
  x: number;
  z: number;
}
const path = pathPoints();

const NEW: Array<{ id: string; x: number; z: number; keep: number; in: string | null }> = [
  /* cloud isles interior */
  { id: 'cloud-pier', x: 300, z: -1220, keep: 5.0, in: 'cloud' },
  { id: 'puff-ring', x: 398, z: -1140, keep: 3.4, in: 'cloud' },
  { id: 'mist-bell', x: 262, z: -1108, keep: 3.0, in: 'cloud' },
  { id: 'sky-lantern', x: 420, z: -1236, keep: 2.8, in: 'cloud' },
  { id: 'cloud-ladder', x: 348, z: -1290, keep: 3.2, in: 'cloud' },
  /* star desert interior */
  { id: 'star-well', x: 368, z: 1256, keep: 4.6, in: 'star' },
  { id: 'meteor-rock', x: 262, z: 1148, keep: 3.6, in: 'star' },
  { id: 'star-mounds', x: 428, z: 1180, keep: 3.8, in: 'star' },
  { id: 'sparkle-brush', x: 240, z: 1252, keep: 3.0, in: 'star' },
  { id: 'dawn-stone', x: 418, z: 1300, keep: 3.0, in: 'star' },
  /* ring-4 outposts */
  { id: 'wind-chime', x: 994, z: 777, keep: 2.8, in: null },
  { id: 'feather-hill', x: -1029, z: 721, keep: 3.4, in: null },
  { id: 'moongate', x: -1212, z: -325, keep: 4.2, in: null },
  { id: 'prairie-pond', x: 1031, z: -722, keep: 3.4, in: null },
  /* old-road somewheres */
  { id: 'moss-arch', x: -239, z: -343, keep: 3.0, in: null },
  { id: 'drift-den', x: -381, z: 152, keep: 3.0, in: null },
  { id: 'tide-line', x: -431, z: 506, keep: 2.6, in: null },
  { id: 'reed-whistle', x: 8, z: 430, keep: 2.6, in: null },
  { id: 'butterfly-bush', x: 380, z: 510, keep: 2.6, in: null },
  { id: 'wind-harp', x: 341, z: 117, keep: 2.8, in: null },
  { id: 'color-steps', x: 668, z: -145, keep: 3.0, in: null },
  { id: 'echo-post', x: 285, z: -344, keep: 2.6, in: null },
  { id: 'ember-log', x: -40, z: -598, keep: 2.8, in: null },
  { id: 'prism-gate', x: -697, z: -144, keep: 3.0, in: null },
  /* far-road chains */
  { id: 'hollow-oak', x: 82, z: -363, keep: 3.2, in: null },
  { id: 'pebble-circle', x: 86, z: -502, keep: 2.8, in: null },
  { id: 'dusk-lantern', x: 228, z: -776, keep: 2.6, in: null },
  { id: 'cloud-post', x: 272, z: -928, keep: 2.6, in: null },
  { id: 'mist-meadow', x: 318, z: -1020, keep: 3.0, in: 'cloud' },
  { id: 'clover-stone', x: 50, z: 185, keep: 2.6, in: null },
  { id: 'bee-post', x: 45, z: 329, keep: 2.6, in: null },
  { id: 'willow-spring', x: 100, z: 470, keep: 2.8, in: null },
  { id: 'field-bell', x: 154, z: 614, keep: 2.6, in: null },
  { id: 'star-sand', x: 250, z: 958, keep: 2.8, in: null },
];

const FAR_STATIONS: Array<{ key: string; x: number; z: number }> = [
  { key: 'cloud:0', x: 268, z: -1108 },
  { key: 'cloud:1', x: 396, z: -1122 },
  { key: 'cloud:2', x: 318, z: -1222 },
  { key: 'star:0', x: 272, z: 1148 },
  { key: 'star:1', x: 398, z: 1162 },
  { key: 'star:2', x: 320, z: 1256 },
  { key: 'far:honey', x: -1015, z: -126 },
  { key: 'far:snowfriend', x: -940, z: 552 },
  { key: 'far:moonpond', x: 92, z: 1040 },
  { key: 'far:reedhut', x: 982, z: 572 },
  { key: 'far:sunclock', x: 838, z: -728 },
  { key: 'far:starstone', x: 312, z: -938 },
];

const roadMin = (x: number, z: number): number => {
  let m = Infinity;
  for (const r of REGION_ROADS) for (const p of r.points) m = Math.min(m, Math.hypot(p.x - x, p.z - z));
  return m;
};
const hubDist = (x: number, z: number): number => {
  let m = Infinity;
  for (const p of path) m = Math.min(m, Math.hypot(p.x - x, p.z - z));
  return m;
};
const islandD = (x: number, z: number): number => {
  let m = Infinity;
  for (const i of WORLD_ISLANDS) m = Math.min(m, Math.hypot(x - i.x, z - i.z) - i.radius);
  return m;
};
const riverD = (x: number, z: number): number => {
  let m = Infinity;
  for (const p of RIVER_CONTROL) m = Math.min(m, Math.hypot(x - p.x, z - p.z));
  return m;
};
const allStations = [...STATIONS, ...FAR_STATIONS.map((f) => ({ x: f.x, z: f.z }))];

describe('validate 34 new landmarks', () => {
  it('invariants', () => {
    let fails = 0;
    for (const n of NEW) {
      const d = Math.hypot(n.x, n.z);
      const problems: string[] = [];
      if (d > WORLD_WALK_RADIUS - 0.7) problems.push(`walk ${d.toFixed(0)}`);
      if (n.keep < 0.8 || n.keep > 5.2) problems.push('keep');
      if (islandD(n.x, n.z) < 1.5) problems.push(`island ${islandD(n.x, n.z).toFixed(1)}`);
      if (hubDist(n.x, n.z) < 1.2) problems.push(`path ${hubDist(n.x, n.z).toFixed(1)}`);
      if (roadMin(n.x, n.z) < 6) problems.push(`road ${roadMin(n.x, n.z).toFixed(1)}`);
      if (riverD(n.x, n.z) < 10) problems.push(`river ${riverD(n.x, n.z).toFixed(1)}`);
      for (const l of LANDMARKS) {
        const dd = Math.hypot(n.x - l.x, n.z - l.z);
        if (dd < 4.5 || dd < l.keep + n.keep) problems.push(`vs ${l.id} ${dd.toFixed(1)}`);
      }
      for (const o of NEW) {
        if (o.id === n.id) continue;
        const dd = Math.hypot(n.x - o.x, n.z - o.z);
        if (dd < 4.5 || dd < o.keep + n.keep) problems.push(`vs new ${o.id} ${dd.toFixed(1)}`);
      }
      for (const s of allStations) {
        const dd = Math.hypot(n.x - s.x, n.z - s.z);
        if (dd < n.keep + 1.0) problems.push(`vs station ${dd.toFixed(1)}`);
      }
      if (n.in) {
        const reg = regionAt(n.x, n.z);
        if (reg?.id !== n.in) problems.push(`region ${reg?.id ?? 'wilds'}`);
      }
      /* visit point sanity */
      const v = landmarkVisitPoint({ id: n.id as never, name: '', line: '', x: n.x, z: n.z, keep: n.keep });
      if (islandD(v.x, v.z) < 0.3) problems.push(`visit island ${islandD(v.x, v.z).toFixed(1)}`);
      if (hubDist(v.x, v.z) < 0.35) problems.push(`visit path ${hubDist(v.x, v.z).toFixed(1)}`);
      if (problems.length) {
        fails++;
        console.log(`FAIL ${n.id} (${n.x},${n.z}): ${problems.join('; ')}`);
      }
    }
    console.log(`new landmarks: ${NEW.length}, failures: ${fails}`);
    /* region interior placement inside patch */
    for (const rid of ['cloud', 'star']) {
      const reg = regionById(rid as never);
      const inside = NEW.filter((n) => n.in === rid && Math.hypot(n.x - reg.x, n.z - reg.z) <= reg.radius);
      console.log(`${rid}: ${inside.length}/5 interiors inside patch`);
    }
  });

  it('far station clearances', () => {
    let fails = 0;
    for (const f of FAR_STATIONS) {
      const problems: string[] = [];
      if (stationPathClearance(f.x, f.z) < 1.9) problems.push(`road ${stationPathClearance(f.x, f.z).toFixed(1)}`);
      for (const l of [...LANDMARKS, ...NEW.map((n) => ({ id: n.id, x: n.x, z: n.z, keep: n.keep }))]) {
        const dd = Math.hypot(f.x - l.x, f.z - l.z);
        if (dd < l.keep + 1.0) problems.push(`lm ${l.id} ${dd.toFixed(1)}`);
      }
      for (const p of WORLD_ISLANDS) {
        const dd = Math.hypot(f.x - p.x, f.z - p.z);
        if (dd < p.radius + 2.2) problems.push(`island ${p.zone} ${dd.toFixed(1)}`);
      }
      for (const s of STATIONS) {
        const dd = Math.hypot(f.x - s.x, f.z - s.z);
        if (dd < 3.0) problems.push(`pad ${dd.toFixed(1)}`);
      }
      for (const o of FAR_STATIONS) {
        if (o.key === f.key) continue;
        const dd = Math.hypot(f.x - o.x, f.z - o.z);
        if (dd < 3.0) problems.push(`far ${o.key} ${dd.toFixed(1)}`);
      }
      if (problems.length) {
        fails++;
        console.log(`FAIL station ${f.key} (${f.x},${f.z}): ${problems.join('; ')}`);
      }
    }
    console.log(`far stations: ${FAR_STATIONS.length}, failures: ${fails}`);
  });

  it('final sector x ring (6x5, 300u rings) with the new set', () => {
    const rings = [0, 300, 600, 900, 1200, WORLD_WALK_RADIUS + 1];
    const cells = new Map<string, number>();
    for (const l of [...LANDMARKS, ...NEW]) {
      const d = Math.hypot(l.x, l.z);
      let ring = -1;
      for (let i = 0; i < 5; i++) if (d >= rings[i] && d < rings[i + 1]) ring = i;
      if (ring < 0) continue;
      const ang = (Math.atan2(l.z, l.x) + Math.PI * 2) % (Math.PI * 2);
      const k = `${Math.floor(ang / (Math.PI / 3))}:${ring}`;
      cells.set(k, (cells.get(k) ?? 0) + 1);
    }
    let missing = 0;
    for (let s = 0; s < 6; s++) {
      const row: string[] = [];
      for (let r = 0; r < 5; r++) {
        const v = cells.get(`${s}:${r}`) ?? 0;
        if (!v) missing++;
        row.push(String(v).padStart(3));
      }
      console.log(`sector ${s}: ${row.join(' ')}`);
    }
    console.log('empty cells:', missing);
  });

  it('road service gaps after placement (perp<=50)', () => {
    const arcLen = (pts: P[]): number[] => {
      const acc = [0];
      for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
      return acc;
    };
    for (const road of REGION_ROADS) {
      const acc = arcLen(road.points);
      const total = acc[acc.length - 1];
      const marks: number[] = [];
      for (const l of [...LANDMARKS, ...NEW]) {
        let best = Infinity;
        let bestT = 0;
        for (let i = 0; i < road.points.length; i++) {
          const dd = Math.hypot(road.points[i].x - l.x, road.points[i].z - l.z);
          if (dd < best) {
            best = dd;
            bestT = acc[i];
          }
        }
        if (best <= 50) marks.push(bestT);
      }
      marks.sort((a, b) => a - b);
      let maxGap = marks.length ? Math.max(marks[0], total - marks[marks.length - 1]) : total;
      for (let i = 1; i < marks.length; i++) maxGap = Math.max(maxGap, marks[i] - marks[i - 1]);
      console.log(`${road.region}: len=${total.toFixed(0)} n=${marks.length} maxGap=${maxGap.toFixed(0)}`);
    }
  });
});
