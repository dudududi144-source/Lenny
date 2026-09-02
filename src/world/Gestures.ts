/* ============================================================
 * Gestures — the physical contract of the world (pure, tested).
 *
 * Stage 7 spec, verbatim:
 *   - single-finger drag = orbit (the camera's own input)
 *   - a SHORT tap = walk there
 *   - pinch = zoom (the camera's own input)
 *   - tap = total movement < 12px AND duration < 250ms
 *
 * The classifier never touches the DOM — WorldApp feeds it
 * pointer lifecycle events and acts on the verdicts.
 * ============================================================ */

export const TAP_MAX_PIXELS = 12;
export const TAP_MAX_MS = 250;

export interface PointerSnapshot {
  x: number;
  y: number;
  t: number;
}

export type GestureVerdict = 'tap' | 'drag' | null;

/** Begin tracking a pointer press. */
export function pressStart(x: number, y: number, t: number): PointerSnapshot {
  return { x, y, t };
}

/**
 * Classify a pointer release. Returns 'tap' only when the whole
 * gesture stayed inside both budgets (distance + duration); 'drag'
 * once it exceeded the distance budget; null otherwise.
 */
export function pressEnd(start: PointerSnapshot, x: number, y: number, t: number): GestureVerdict {
  const dist = Math.hypot(x - start.x, y - start.y);
  if (dist > TAP_MAX_PIXELS) return 'drag';
  if (t - start.t <= TAP_MAX_MS && dist <= TAP_MAX_PIXELS) return 'tap';
  return null;
}

/**
 * True once a live press has already turned into a drag (used to
 * ignore intermediate move noise and multi-touch chaos).
 */
export function isDragDistance(start: PointerSnapshot, x: number, y: number): boolean {
  return Math.hypot(x - start.x, y - start.y) > TAP_MAX_PIXELS;
}
