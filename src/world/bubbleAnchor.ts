/* ============================================================
 * bubbleAnchor — where Lenny's speech bubble may live (pure math).
 *
 * Stage 18 — the owner's verdict, third round: NO message parks at
 * the bottom-center of the play space. The bubble used to chase
 * Lenny and park at 60% of the screen height — right above the
 * joystick lane, dead-center — and on top of that a landscape
 * phone still showed the WASD pill in the same slot. The owner
 * read the pile as "the central bubble that never left".
 *
 * A bubble is a message: messages live in the TOP band, under the
 * HUD, where thumbs never reach. The bubble may still follow
 * Lenny when she is high on screen — it just may never drop low.
 * ============================================================ */

/** The bubble's bottom edge never drops below this fraction of the
 *  screen height — the upper third is message country, the lower
 *  two thirds are the child's. */
export const BUBBLE_MAX_TOP = 0.34;

/** …and it never climbs into the status chips — the ceiling for the
 *  bubble's bottom edge while it follows Lenny upward. */
export const BUBBLE_MIN_TOP = 0.04;

/** Lenny's projected anchor sits this fraction of screen height
 *  below her visual head — the bubble floats above the head. */
export const BUBBLE_HEADROOM = 0.075;

/** Pure: Lenny's projected y → the bubble's bottom edge (as a
 *  fraction of screen height). Same inputs, same bubble home. */
export function bubbleAnchorY(lennyY: number): number {
  return Math.min(BUBBLE_MAX_TOP, Math.max(BUBBLE_MIN_TOP, lennyY - BUBBLE_HEADROOM));
}
