import { test, expect } from '@playwright/test';

test('hero loads with title and CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/לֶנִי/);
  await expect(page.locator('#startBtn')).toBeVisible();
});

test('start reveals the garden journey map', async ({ page }) => {
  await page.goto('/');
  await page.click('#startBtn');
  await expect(page.locator('#garden')).toBeVisible();
  await expect(page.locator('#garden')).not.toHaveClass(/hidden/);
  const zones = page.locator('.zone');
  await expect(zones.first()).toBeVisible();
});

test('first game (light-path) boots AND actually runs without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  await page.locator('.zone').first().click();
  const canvas = page.locator('canvas');
  await canvas.waitFor({ timeout: 10000 });
  await expect(canvas).toBeVisible();

  /* tap the canvas to start the run (menu -> play), then let it simulate a bit */
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.height / 2);
    await page.waitForTimeout(300);
    /* steer left/right like a player holding a side */
    await page.mouse.move(box.x + box.width * 0.2, box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
  }
  await page.waitForTimeout(300);

  expect(pageErrors, 'game threw a runtime error: ' + pageErrors.join(' | ')).toHaveLength(0);
});

test('locked zone does not boot a game', async ({ page }) => {
  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  await page.locator('.zone').nth(1).click();
  const canvasCount = await page.locator('canvas').count();
  expect(canvasCount).toBe(0);
});
