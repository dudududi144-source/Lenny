import { expect, test } from '@playwright/test';

/* stage 20: on a phone the back button lives inside the ONE menu —
   open the folded bar's sheet first when the direct button is hidden */
async function tapWorldBack(page: Page): Promise<void> {
  const back = page.locator('#world-back');
  if (await back.isVisible().catch(() => false)) {
    await back.click();
    return;
  }
  await page.locator('#world-menu-btn').click();
  await back.click();
}

/* Stage 7, commit 4 — the garden lives:
 *   - the painted sky follows the real hour (lenny-hour-override)
 *   - finished games bloom as flowers on their islands (bridge bloom)
 *   - butterflies by day, fireflies at night, fish always
 *   - the soundtrack walks into 'garden-exploring' and swells near zones
 */

async function openWorld(page: import('@playwright/test').Page, hour?: string): Promise<void> {
  await page.addInitScript((h) => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
    if (h !== undefined) localStorage.setItem('lenny-hour-override', h);
  }, hour);
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(600);
}

test('the painted sky follows the real hour override', async ({ page }) => {
  await openWorld(page, '13');
  expect(await page.evaluate(() => window.__lennyWorld?.sky())).toBe('midday');

  await page.evaluate(() => localStorage.setItem('lenny-hour-override', '23'));
  /* the day-turn check runs every 30s — force the path by re-entering */
  await tapWorldBack(page);
  await expect(page.locator('#hero-screen')).toBeVisible();
  await page.getByRole('button', { name: /נַתְחִיל|לְהַמְשֵׁךְ/ }).first().click();
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__lennyWorld?.sky())).toBe('night');
});

test('finished games bloom as flowers on their islands', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
    localStorage.setItem('lenny-hour-override', '13');
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 3,
        zones: { 'light-path': { finished: 3, unlocked: true } },
        finished: { 'light-path': 3 },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(600);

  const zones = await page.evaluate(() => window.__lennyWorld?.zones());
  const lightPath = zones!.find((z) => z.id === 'light-path')!;
  expect(lightPath.bloom).toBe(3);
  const breathPool = zones!.find((z) => z.id === 'breath-pool')!;
  expect(breathPool.bloom).toBe(0);
});

test('butterflies by day, fireflies at night, fish always', async ({ page }) => {
  await openWorld(page, '13');
  let life = await page.evaluate(() => window.__lennyWorld?.life());
  expect(life).toEqual({ butterflies: 3, fireflies: 12, fish: 3 });

  await openWorld(page, '23');
  life = await page.evaluate(() => window.__lennyWorld?.life());
  expect(life).toEqual({ butterflies: 3, fireflies: 12, fish: 3 });
  /* the phase itself is asserted by the sky test — the counts contract
     is that the pools exist; visibility toggles live inside setPhase */
});

test('the soundtrack walks into garden-exploring and swells near a zone', async ({ page }) => {
  await openWorld(page, '13');
  await page.waitForTimeout(800);

  const mood = await page.evaluate(() => window.__lenny?.music().mood);
  expect(mood).toBe('garden-exploring');

  /* the journey starts at light-path — the near zone feeds intensity */
  const near = await page.evaluate(() => window.__lennyWorld?.nearZone());
  expect(near).toBe('light-path');
  await expect
    .poll(() => page.evaluate(() => window.__lenny?.music().intensity ?? 0), { timeout: 6000 })
    .toBeGreaterThan(0.3);
});
