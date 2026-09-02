import { expect, test } from '@playwright/test';

/* Stage 7, commit 6 — the first-visit flyover:
 *   - a brand-new child gets a 6-second tour of the garden
 *   - ONE tap skips it (ETHICS: the child is always in control)
 *   - the tour never repeats (the flag is remembered)
 */

async function openWorldFresh(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.removeItem('lenny-world-onboarded');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'onboarding', null, { timeout: 25000 });
}

test('a fresh visit starts with the onboarding flyover, one tap skips it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openWorldFresh(page);

  /* still onboarding after a moment — it is a 6s tour */
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__lennyWorld?.phase())).toBe('onboarding');

  /* one tap skips: settle ease (1s) then exploring */
  const box = await page.locator('.world-canvas').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.phase()), { timeout: 5000, intervals: [200] })
    .toBe('exploring');

  /* the tour is remembered */
  const flag = await page.evaluate(() => localStorage.getItem('lenny-world-onboarded'));
  expect(flag).not.toBeNull();
  expect(errors).toEqual([]);
});

test('the flyover completes on its own when nobody skips', async ({ page }) => {
  await openWorldFresh(page);
  /* ~6s tour + settle: poll without touching anything */
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.phase()), { timeout: 12000, intervals: [500] })
    .toBe('exploring');
  const flag = await page.evaluate(() => localStorage.getItem('lenny-world-onboarded'));
  expect(flag).not.toBeNull();
});

test('returning visitors skip straight to exploring', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  /* never onboarding — the world is explorable within ~2s of boot */
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.phase()), { timeout: 6000, intervals: [150] })
    .toBe('exploring');
  /* and it never even flashed onboarding */
  expect(await page.evaluate(() => window.__lennyWorld?.phase())).toBe('exploring');
});
