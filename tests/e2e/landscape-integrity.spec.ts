import { test, expect } from '@playwright/test';

/* stage 18 verification — the landscape pile-up is dead:
   1. a scrolled hero (the child dragged to reach the CTA) may no
      longer drag the world half off-screen — the frame lands at 0
      and the world screen fills the viewport EXACTLY;
   2. on a touch device the WASD pill is gone in EVERY viewport
      (a landscape phone used to miss the ≤640px hide rule and the
      pill sat bottom-center over the joystick). */

test.describe('stage 18 landscape integrity', () => {
  test.use({
    viewport: { width: 844, height: 390 }, /* landscape phone — the case that broke */
    hasTouch: true,
    isMobile: true,
  });

  test('scrolled hero cannot drag the world off-screen; no keyboard pill on touch', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    /* world mode from the first paint — the 3D garden is the screen
       under test (classic stays the default otherwise) */
    await page.addInitScript(() => {
      localStorage.setItem('lenny-garden-mode', 'world');
      localStorage.setItem('lenny-world-onboarded', '1');
    });
    await page.goto('/');
    await page.waitForTimeout(2500);

    /* the child drags down to reach the CTA — exactly what a
       landscape phone does when the hero is taller than the
       viewport. Legacy engines (no overflow:clip) would park this
       on the frame; the fix forbids it at the CSS level and zeroes
       the frame on every screen switch. */
    await page.evaluate(() => {
      const frame = document.querySelector('.frame') as HTMLElement | null;
      if (frame) {
        frame.scrollTop = 200;
        frame.scrollLeft = 0;
      }
      const hero = document.querySelector('.screen--hero') as HTMLElement | null;
      if (hero) hero.scrollTop = 200;
    });

    await page.locator('#start-btn').click();
    /* the world must actually OPEN — no measuring of hidden DOM */
    await page.locator('#world-screen').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('canvas').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(4000); /* engine settles, first frame paints */

    const state = await page.evaluate(() => {
      const frame = document.querySelector('.frame') as HTMLElement | null;
      const screen = document.querySelector('.screen--world') as HTMLElement | null;
      const canvas = document.querySelector('canvas');
      const sr = screen?.getBoundingClientRect();
      const cr = canvas?.getBoundingClientRect();
      const hint = document.querySelector('.world-controls-hint') as HTMLElement | null;
      return {
        frameScrollTop: frame ? frame.scrollTop : null,
        frameScrollHeight: frame ? frame.scrollHeight : null,
        screenTop: sr ? Math.round(sr.top) : null,
        screenLeft: sr ? Math.round(sr.left) : null,
        screenW: sr ? Math.round(sr.width) : null,
        screenH: sr ? Math.round(sr.height) : null,
        canvasTop: cr ? Math.round(cr.top) : null,
        canvasW: cr ? Math.round(cr.width) : null,
        canvasH: cr ? Math.round(cr.height) : null,
        vw: innerWidth,
        vh: innerHeight,
        hintDisplay: hint ? getComputedStyle(hint).display : null,
        touchCtl: document
          .querySelector('.world-controls')
          ?.classList.contains('world-touch'),
        worldOpen: !screen?.classList.contains('hidden'),
      };
    });

    /* honesty first: the 3D garden is genuinely on screen */
    expect(state.worldOpen).toBe(true);

    /* the frame carries NO scroll between screens */
    expect(state.frameScrollTop).toBe(0);
    /* the frame's content stays essentially contained (decorative
       shadows may poke a few px, but nothing scroll-shaped may
       pool there — and overflow:clip makes even that unscrollable) */
    expect(state.frameScrollHeight ?? 9999).toBeLessThanOrEqual(state.vh + 32);
    /* the world screen fills the viewport EXACTLY — the -203px
       half-off-screen paint is structurally impossible now */
    expect(state.screenTop).toBe(0);
    expect(state.screenLeft).toBe(0);
    expect(state.screenW).toBe(state.vw);
    expect(state.screenH).toBe(state.vh);
    /* the canvas too — the child sees the whole garden, not its top half */
    expect(state.canvasTop).toBe(0);
    expect(state.canvasW).toBe(state.vw);
    expect(state.canvasH).toBe(state.vh);
    /* the keyboard pill is a desktop instrument — no touch device
       sees it, at no width, in no orientation */
    expect(state.touchCtl).toBe(true);
    expect(state.hintDisplay).toBe('none');
  });
});
