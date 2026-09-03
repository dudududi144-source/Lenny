import { expect, test, type Page } from '@playwright/test';

/* Stage 8 — the world records an honest diary, and the parent's lens
 * reads it. All reads go through localStorage / the real dashboard —
 * never pixels, never invented history.
 *
 * Diary contract: local day buckets with whitelisted keys only
 * (ms / opens / arrivals / shelfOpens / picks / per-zone counts).
 */

async function openWorld(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  /* the engine is ready when the bridge says so — never a fixed sleep */
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(500);
}

/* the child already stands on light-path — a tap there arrives at once
   (the world-default.spec.ts recipe) and the shelf slides in */
async function arriveHomeAndOpenShelf(page: Page): Promise<void> {
  const box = await page.locator('.world-canvas').boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.45);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.phase())).toBe('shelf-open');
}

test('a world session writes the diary: open, arrival, shelf — whitelisted keys only', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openWorld(page);
  await arriveHomeAndOpenShelf(page);

  const diary = await page.evaluate(() => {
    const raw = localStorage.getItem('lenny-world-diary-v1');
    return raw ? (JSON.parse(raw) as unknown) : null;
  });
  expect(diary).toBeTruthy();
  const days = (diary as { days: Record<string, Record<string, unknown>> }).days;
  const keys = Object.keys(days);
  expect(keys.length).toBe(1); /* one fresh day bucket — today */

  const today = days[keys[0]];
  expect(today.opens).toBeGreaterThanOrEqual(1);
  expect(today.arrivals).toBeGreaterThanOrEqual(1);
  expect(today.shelfOpens).toBeGreaterThanOrEqual(1);
  const zones = today.zones as Record<string, number>;
  expect(zones['light-path']).toBeGreaterThanOrEqual(1);
  expect(Object.keys(zones)).toEqual(['light-path']); /* no wandering yet — honest counts */

  /* the schema carries ONLY whitelisted keys — no identifiers, ever */
  expect(Object.keys(today).sort()).toEqual(['arrivals', 'ms', 'opens', 'picks', 'shelfOpens', 'zones']);
  expect(Object.keys(diary as Record<string, unknown>).sort()).toEqual(['days', 'v']);
  expect(errors).toEqual([]);
});

test('the parent lens sees the world visit — a new card with the 10 islands', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openWorld(page);
  await arriveHomeAndOpenShelf(page);

  /* the open shelf overlays the footer — close it first, like a child would */
  await page.locator('#world-shelf-close').click();
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.phase())).toBe('exploring');

  /* grown-ups enter from the world footer — same hold-gate as always */
  await page.locator('#world-parent-link').click();
  await expect(page.locator('.parent-hold')).toBeVisible();
  await page.locator('.parent-hold').dispatchEvent('pointerdown');
  await expect(page.locator('.parent-dashboard')).toBeVisible({ timeout: 5000 });

  const card = page.locator('.parent-world-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('הַגַּן הַתְּלַת-מֶמְדִּי');

  /* the spiral map always shows — all 10 islands, even the quiet ones */
  await expect(page.locator('.parent-world-zone-row')).toHaveCount(10);
  const first = page.locator('.parent-world-zone-row').first();
  await expect(first).toContainText('שְׁבִיל הָאוֹר');
  await expect(first.locator('.parent-world-count')).toHaveText('1');

  /* back returns to where we came from: the world */
  await page.locator('#parent-screen').getByRole('button', { name: /חזרה/ }).last().click();
  await expect(page.locator('#world-screen')).toBeVisible();
  expect(errors).toEqual([]);
});
