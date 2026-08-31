import { expect, test, type Page } from '@playwright/test';

/* BreathPool e2e — DOM/state based: real taps via window.__lenny. */

interface PoolState {
  kind: string;
  lanterns: Array<{ x: number; y: number; lit: boolean }>;
  lit: number;
  total: number;
  done: boolean;
}

async function openBreathPool(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden', JSON.stringify({ firstSeen: Date.now(), lights: 0, zones: {} }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="breath-pool"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect(page.locator('#hud-zone')).toHaveText(/בְּרֵכַת הַנְּשִׁימָה/);
}

async function state(page: Page): Promise<PoolState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as PoolState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(rect!.x + (dx / 420) * rect!.width, rect!.y + (dy / 720) * rect!.height);
}

test('slow calm taps light every lantern', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openBreathPool(page);

  const s = (await state(page))!;
  expect(s.total).toBe(3);

  for (const lantern of s.lanterns) {
    await tapDesign(page, lantern.x, lantern.y);
    await page.waitForTimeout(900); /* breathing pace: > 700ms */
  }

  const after = (await state(page))!;
  expect(after.lit).toBe(3);
  await expect
    .poll(async () => (await state(page))?.done, { timeout: 10000 })
    .toBe(true);

  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['breath-pool'] ?? garden.zones['breath-pool']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 12000 });
  expect(errors).toEqual([]);
});

test('fast taps are gently ignored (breathing pace)', async ({ page }) => {
  test.setTimeout(60_000);
  await openBreathPool(page);

  const s = (await state(page))!;
  const lantern = s.lanterns[0];
  await tapDesign(page, lantern.x, lantern.y);
  await page.waitForTimeout(250);
  await tapDesign(page, s.lanterns[1].x, s.lanterns[1].y);
  await page.waitForTimeout(250);

  const after = (await state(page))!;
  expect(after.lit).toBe(1);
});
