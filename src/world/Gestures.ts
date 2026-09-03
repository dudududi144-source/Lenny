/* ============================================================
 * Gestures — the physical contract of the world (pure, tested).
 *
 * Stage 7 spec, amended by critic round B (W5):
 *   - single-finger drag = orbit (the camera's own input)
 *   - a tap = walk there
 *   - pinch = zoom (the camera's own input)
 *   - tap = total movement ≤ 12px, ANY duration
 *
 * The old 250ms budget silently ate slow presses: a 4-year-old
 * presses a spot, holds a beat, releases — and NOTHING happened.
 * Distance is the only honest tap/drag boundary for this age;
 * a still press of any length is a walk request.
 *
 * The classifier never touches the DOM — WorldApp feeds it
 * pointer lifecycle events and acts on the verdicts.
 * ============================================================ */

export const TAP_MAX_PIXELS = 12;

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
 * Classify a pointer release. Distance decides: inside the budget
 * is a tap however long the child took; beyond it is a drag.
 */
export function pressEnd(start: PointerSnapshot, x: number, y: number, _t: number): GestureVerdict {
  const dist = Math.hypot(x - start.x, y - start.y);
  return dist <= TAP_MAX_PIXELS ? 'tap' : 'drag';
}

/**
 * True once a live press has already turned into a drag (used to
 * ignore intermediate move noise and multi-touch chaos).
 */
export function isDragDistance(start: PointerSnapshot, x: number, y: number): boolean {
  return Math.hypot(x - start.x, y - start.y) > TAP_MAX_PIXELS;
}
