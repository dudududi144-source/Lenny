/* ============================================================
 * GardenLife tests (Stage 6, commit 6) — the pure parts.
 * The DOM builders (SVG flowers/life layer) are exercised by the
 * garden-growth e2e; here we pin the bloom LADDER math.
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { bloomStageFor, BLOOM_STAGES } from '../ui/components/gardenLife';

describe('bloom ladder — 0..5, clamped, monotonic', () => {
  it('maps progress onto the six named stages in order', () => {
    expect(BLOOM_STAGES).toEqual(['soil', 'sprouts', 'flowers', 'butterflies', 'trees', 'full']);
    expect(bloomStageFor(0)).toBe('soil');
    expect(bloomStageFor(1)).toBe('sprouts');
    expect(bloomStageFor(2)).toBe('flowers');
    expect(bloomStageFor(3)).toBe('butterflies');
    expect(bloomStageFor(4)).toBe('trees');
    expect(bloomStageFor(5)).toBe('full');
  });

  it('clamps wild progress to "full" and never goes below soil', () => {
    expect(bloomStageFor(99)).toBe('full');
    expect(bloomStageFor(-3)).toBe('soil');
    expect(bloomStageFor(5.7)).toBe('full');
  });

  it('is monotonic: more progress never downgrades the garden', () => {
    let prev = 0;
    for (let level = 0; level <= 12; level++) {
      const order = BLOOM_STAGES.indexOf(bloomStageFor(level));
      expect(order).toBeGreaterThanOrEqual(prev);
      prev = order;
    }
  });
});
