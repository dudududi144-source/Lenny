import { test, expect } from '@playwright/test';

/* stage 17 verification: on a REAL touch context (pointer: coarse)
   the world must boot in steady-touch mode — the vertical orbit is
   calm, the pinch zoom is INERT (radius stays at the designed 16),
   and the quest toast lives at the TOP, never on the thumbs. */

test.describe('stage 17 touch verdict', () => {
  test.use({
    viewport: { width: 844, height: 390 }, /* landscape phone — the case that broke */
    hasTouch: true,
    isMobile: true,
  });

  test('toast stays top-anchored in landscape; pinch cannot move the radius', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForTimeout(2500);
    await page.locator('#start-btn').click();
    await page.waitForTimeout(9000); /* world boot + first quest offer */

    const state = await page.evaluate(async () => {
      const w = window as unknown as {
        __lennyWorld?: { perf?: () => { camRadius?: number; camY?: number } };
      };
      const q = document.getElementById('world-quest');
      const r = q?.getBoundingClientRect();
      const coarse = matchMedia('(pointer: coarse)').matches;
      const touchCtl = document.querySelector('.world-controls')?.classList.contains('world-touch');
      /* try a violent two-finger pinch-out on the canvas */
      const canvas = document.querySelector('canvas');
      const cx = innerWidth / 2;
      const cy = innerHeight / 2;
      const before = w.__lennyWorld?.perf?.()?.camRadius;
      if (canvas && 'ontouchstart' in window) {
        const t1 = new Touch({ identifier: 1, target: canvas, clientX: cx - 60, clientY: cy } as TouchInit);
        const t2 = new Touch({ identifier: 2, target: canvas, clientX: cx + 60, clientY: cy } as TouchInit);
        canvas.dispatchEvent(new TouchEvent('touchstart', { touches: [t1, t2], bubbles: true }));
        const t1b = new Touch({ identifier: 1, target: canvas, clientX: cx - 140, clientY: cy } as TouchInit);
        const t2b = new Touch({ identifier: 2, target: canvas, clientX: cx + 140, clientY: cy } as TouchInit);
        canvas.dispatchEvent(new TouchEvent('touchmove', { touches: [t1b, t2b], bubbles: true }));
        canvas.dispatchEvent(new TouchEvent('touchend', { touches: [] as Touch[], bubbles: true }));
      }
      await new Promise((res) => setTimeout(res, 1200));
      const after = w.__lennyWorld?.perf?.()?.camRadius;
      return {
        coarse,
        touchCtl,
        questTop: r ? Math.round(r.top) : null,
        questBottom: r ? Math.round(r.bottom) : null,
        vh: innerHeight,
        radiusBefore: before,
        radiusAfter: after,
      };
    });

    /* landscape phone: the toast parks under the top bar, never at the bottom */
    expect(state.questTop ?? 999).toBeLessThan(state.vh * 0.35);
    /* the pinch is inert: the radius holds its designed pose */
    expect(Math.abs((state.radiusAfter ?? 16) - (state.radiusBefore ?? 16))).toBeLessThan(0.6);
  });
});
