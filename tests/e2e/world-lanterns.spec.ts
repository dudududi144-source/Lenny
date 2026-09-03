import { expect, test, type Page } from '@playwright/test';

/* The journey made visible: earned lights light the path lanterns.
 *   - a fresh garden starts with zero lanterns
 *   - seeded lights light exactly that many lanterns
 *   - the count caps at the lantern line (no endless counters)
 *
 * All reads go through window.__lennyWorld — never pixels.
 */

async function openWorldWithLights(page: Page, lights: number): Promise<void> {
  await page.addInitScript((n: number) => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({ firstSeen: Date.now(), lights: n, zones: {}, finished: {} }),
    );
  }, lights);
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(400);
}

test('a fresh garden starts with an unlit path', async ({ page }) => {
  await openWorldWithLights(page, 0);
  expect(await page.evaluate(() => window.__lennyWorld?.lanterns())).toBe(0);
});

test('earned lights light exactly that many lanterns', async ({ page }) => {
  await openWorldWithLights(page, 3);
  expect(await page.evaluate(() => window.__lennyWorld?.lanterns())).toBe(3);
});

test('the lantern line caps — the garden never shows an endless counter', async ({ page }) => {
  await openWorldWithLights(page, 40);
  expect(await page.evaluate(() => window.__lennyWorld?.lanterns())).toBe(12);
});
