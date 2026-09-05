import { describe, expect, it } from 'vitest';
import {
  BUBBLE_HEADROOM,
  BUBBLE_MAX_TOP,
  BUBBLE_MIN_TOP,
  bubbleAnchorY,
} from '../world/bubbleAnchor';

describe('bubbleAnchor — the bubble never parks over the thumbs (stage 18)', () => {
  it('caps the bubble in the upper third, no matter how low Lenny sinks', () => {
    /* Lenny at the bottom of the screen (walking toward the camera,
       the exact pose that produced the 60% park over the joystick) */
    expect(bubbleAnchorY(0.9)).toBe(BUBBLE_MAX_TOP);
    expect(bubbleAnchorY(0.6)).toBe(BUBBLE_MAX_TOP);
    /* the cap engages from Lenny-y = cap + headroom (0.415) upward */
    expect(bubbleAnchorY(BUBBLE_MAX_TOP + BUBBLE_HEADROOM)).toBe(BUBBLE_MAX_TOP);
  });

  it('still follows Lenny when she is high on screen', () => {
    /* below the cap threshold the bubble chases her head faithfully
       (0.4 - headroom 0.075 = 0.325, just under the 0.34 cap) */
    expect(bubbleAnchorY(0.4)).toBeCloseTo(0.4 - BUBBLE_HEADROOM, 10);
    expect(bubbleAnchorY(0.2)).toBeCloseTo(0.2 - BUBBLE_HEADROOM, 10);
  });

  it('never climbs into the status chips', () => {
    expect(bubbleAnchorY(0)).toBe(BUBBLE_MIN_TOP);
    expect(bubbleAnchorY(-0.5)).toBe(BUBBLE_MIN_TOP);
  });

  it('keeps the safe band sane on every phone aspect', () => {
    /* the whole playground: the bubble's bottom edge stays inside
       [4%, 34%] of screen height — the top band, never the thumb lane */
    for (let y = -2; y <= 2; y += 0.05) {
      const a = bubbleAnchorY(y);
      expect(a).toBeGreaterThanOrEqual(BUBBLE_MIN_TOP);
      expect(a).toBeLessThanOrEqual(BUBBLE_MAX_TOP);
    }
  });

  it('is pure — same Lenny, same bubble home', () => {
    expect(bubbleAnchorY(0.7)).toBe(bubbleAnchorY(0.7));
  });
});
