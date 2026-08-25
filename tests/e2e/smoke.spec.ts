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
  // zones rendered
  const zones = page.locator('.zone');
  await expect(zones.first()).toBeVisible();
});

test('tapping an open zone boots a Phaser game', async ({ page }) => {
  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  // first zone (light-path) is unlocked by default
  await page.locator('.zone').first().click();
  await page.waitForSelector('canvas', { timeout: 10000 });
  await expect(page.locator('canvas')).toBeVisible();
});

test('locked zone does not boot a game', async ({ page }) => {
  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  // memory-hill is 2nd and locked by default
  await page.locator('.zone').nth(1).click();
  // canvas should NOT appear
  const canvasCount = await page.locator('canvas').count();
  expect(canvasCount).toBe(0);
});
