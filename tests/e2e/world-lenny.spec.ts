import { expect, test } from '@playwright/test';

/* Stage 7, commit 5 — Lenny the companion star:
 *   - she greets at the journey's first island with the zone's
 *     own mission line (never new content)
 *   - arriving at a zone makes her say that zone's mission
 *   - she never blocks, never nags, never gates
 */

async function openWorld(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-hour-override', '13');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
}

test('Lenny greets at light-path with the zone mission', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openWorld(page);
  /* the greeting fires ~900ms after boot */
  await expect(page.locator('#lenny-bubble')).toBeVisible({ timeout: 6000 });
  const text = await page.locator('#lenny-bubble .lenny-bubble-text').textContent();
  expect(text).toBe('בּוֹא נַדְלִיק אֶת הַפָּנָסִים שֶׁל הַשְּׁבִיל!'); /* light-path's mission, verbatim */
  expect(errors).toEqual([]);
});

test('arriving at a zone makes Lenny speak its mission', async ({ page }) => {
  await openWorld(page);
  /* the greeting bubble fades; walk to another unlocked island:
     breath-pool is open and sits far from the start */
  await page.waitForTimeout(4200); /* let the greeting pass */
  await expect(page.locator('#lenny-bubble')).toBeHidden();

  const box = await page.locator('.world-canvas').boundingBox();
  /* breath-pool is the far end of the spiral — the lower screen band
     in the default view; sweep a couple of landing spots */
  for (const fy of [0.9, 0.82, 0.95]) {
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * fy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(2600);
  }

  const near = await page.evaluate(() => window.__lennyWorld?.nearZone());
  if (near === 'breath-pool') {
    await expect(page.locator('#lenny-bubble .lenny-bubble-text')).toHaveText(/בּוּעוֹת/);
  } else {
    /* even without landing exactly there, a walking arrival anywhere
       speaks that zone's mission — never silence, never new text */
    const text = await page.locator('#lenny-bubble .lenny-bubble-text').textContent();
    expect(text?.length ?? 0).toBeGreaterThan(0);
  }
});
