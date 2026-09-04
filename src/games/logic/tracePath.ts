/* ============================================================
 * tracePath — "שְׁבִיל הַכּוֹכָבִים" (tracing the star trail).
 *
 * A dotted trail hangs between the stars. The child presses the
 * glowing first star and DRAGS along the dots: every dot the
 * finger passes lights up, until the trail ends and the
 * constellation closes. Falling off the trail is free — the
 * light just waits where the finger left it (no fail state).
 * Pre-writing tracing: the exact hand skill a pencil demands.
 * ============================================================ */

import { clampTier, hash2, mulberry32 } from './rng';

/** Waypoints per tier — a trace is slow; fewer stops than star-connect. */
export function nodesFor(tier: number): number {
  const t = clampTier(tier);
  return [3, 4, 5, 6][t];
}

export interface StarTrail {
  n: number;
  /** waypoint positions in the 0..1 layout square, in tracing order */
  nodes: Array<{ x: number; y: number }>;
  /** the trail resampled into small steps (the dots) */
  points: Array<{ x: number; y: number }>;
}

const NODE_SEPARATION = 0.3; /* long segments = confident strokes */
const SAMPLE_STEP = 0.035;   /* ~one dot every 0.035 of the unit square */

/**
 * A deterministic trail: rejection-sampled waypoints with a minimum
 * separation, connected in generation order, resampled into dots.
 */
export function trailFor(tier: number, seed: number): StarTrail {
  const n = nodesFor(tier);
  const rnd = mulberry32(hash2(seed, 91));
  const nodes: Array<{ x: number; y: number }> = [];
  let guard = 0;
  while (nodes.length < n && guard < 4000) {
    guard++;
    const x = 0.1 + rnd() * 0.8;
    const y = 0.1 + rnd() * 0.8;
    let ok = true;
    for (const p of nodes) {
      if (Math.hypot(x - p.x, y - p.y) < NODE_SEPARATION) {
        ok = false;
        break;
      }
    }
    if (ok) nodes.push({ x, y });
  }
  /* fallback (never expected): a wide zig-zag so n nodes ALWAYS land */
  while (nodes.length < n) {
    const i = nodes.length;
    nodes.push({ x: i % 2 === 0 ? 0.16 : 0.84, y: 0.14 + (i / Math.max(1, n - 1)) * 0.72 });
  }
  return { n, nodes, points: samplePath(nodes) };
}

/** Resample the polyline through `nodes` into small, evenly spaced dots. */
export function samplePath(nodes: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / SAMPLE_STEP));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  points.push({ x: nodes[nodes.length - 1].x, y: nodes[nodes.length - 1].y });
  return points;
}

/** How far (dot index) a layout-space finger point reaches, monotonically. */
export function advanceAlong(
  points: Array<{ x: number; y: number }>,
  progress: number,
  pt: { x: number; y: number },
  radius: number,
): number {
  let best = progress;
  let k = Math.max(0, Math.floor(progress));
  /* the finger may skip a dot or two — scan a small window forward */
  while (k < points.length && k <= best + 3) {
    if (Math.hypot(pt.x - points[k].x, pt.y - points[k].y) <= radius) best = Math.max(best, k);
    k++;
  }
  return best;
}

/** True when the drag has reached the final dot. */
export function trailComplete(points: Array<{ x: number; y: number }>, progress: number): boolean {
  return points.length > 0 && progress >= points.length - 1;
}
