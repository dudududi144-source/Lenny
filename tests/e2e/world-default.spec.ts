import { expect, test } from '@playwright/test';

/* Stage 7, commit 7 — the default flip, the fallback chain, and the
   world→shelf→arena→world loop:

   - real visitors (navigator.webdriver === false) open the 3D world
     as the garden's default
   - automation stays pinned to the classic map — every legacy
     contract keeps running against the UI it was written for
   - no WebGL2 → silent fallback to the classic garden + ONE gentle
     note for the grown-ups, ever
   - arriving at an open zone slides in the shelf; a pick hands the
     exact game to the untouched arena; exiting returns to the world
   - the classic garden keeps its little bridge chip to the world
 */

async function clickStart(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('#hero-screen')).toBeVisible({ timeout: 15000 });
  await page.locator('#start-btn, #continue-btn').first().click();
}

test('real visitors open the world by default; automation stays classic', async ({ page }) => {
  // real visitor: pretend webdriver is off
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto('/');
  await clickStart(page);
  await expect(page.locator('#world-screen')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });

  // automation (the plain Playwright context): classic map, no canvas
  const page2 = await page.context().newPage();
  await page2.goto('/');
  await expect(page2.locator('#hero-screen')).toBeVisible({ timeout: 15000 });
  await page2.locator('#start-btn').click();
  await expect(page2.locator('#garden-screen')).toBeVisible({ timeout: 15000 });
  await expect(page2.locator('.world-canvas')).toHaveCount(0);
  await page2.close();
});

test('no WebGL2 falls back silently to the classic garden with one grown-up note', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
    // strip the GPU: WebGPU absent, WebGL2/webgl contexts refused
    delete (navigator as { gpu?: unknown }).gpu;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...rest: unknown[]) {
      if (kind === 'webgl2' || kind === 'webgl' || kind === 'experimental-webgl') return null;
      return original.call(this, kind, ...(rest as []));
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await clickStart(page);

  // the classic garden greets instead — no crash, no broken screen
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.zone-card')).toHaveCount(10);
  // the one gentle note for the grown-ups
  await expect(page.locator('#toast')).toContainText('גַן קְלָאסִי', { timeout: 5000 });
  // the fallback sticks
  expect(await page.evaluate(() => localStorage.getItem('lenny-garden-mode'))).toBe('classic');
  expect(errors).toEqual([]);
});

test('the world shelf loop: arrive → pick → arena → back to the garden', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await clickStart(page);
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(400);

  // the child already stands on light-path — a tap there arrives at once
  const box = await page.locator('.world-canvas').boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.45);
  await page.mouse.down();
  await page.mouse.up();

  // the shelf slides in over the world
  await expect(page.locator('#world-shelf')).toBeVisible({ timeout: 8000 });
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.phase())).toBe('shelf-open');
  await expect(page.locator('#world-shelf-row .shelf-card:not(.locked)').first()).toBeVisible();

  // closing it returns to exploring; arriving again re-opens it
  await page.locator('#world-shelf-close').click();
  await expect(page.locator('#world-shelf')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.phase())).toBe('exploring');
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.6);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(900);
  await expect(page.locator('#world-shelf')).toBeVisible({ timeout: 8000 });

  // picking the first open game hands it to the untouched arena
  await page.locator('#world-shelf-row .shelf-card:not(.locked)').first().click();
  await expect(page.locator('#game-screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#game-screen canvas')).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => window.__lenny?.scene())).not.toBeNull();

  // leaving the arena returns to the world, still alive
  await page.locator('#game-back').click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  expect(await page.evaluate(() => window.__lennyWorld?.zones()?.length ?? 0)).toBe(10);
});

test('the classic garden keeps its bridge chip to the world (round trip)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await clickStart(page);
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });

  // world → classic via the parent corner
  await page.locator('#world-classic-link').click();
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.zone-card')).toHaveCount(10);

  // classic → world via the floating chip
  await expect(page.locator('#world-chip')).toBeVisible();
  await page.locator('#world-chip').click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
});
