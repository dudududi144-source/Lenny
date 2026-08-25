import { test, expect } from '@playwright/test';

test('hero loads with title and CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/לֶנִי/);
  await expect(page.locator('#startBtn')).toBeVisible();
});

test('tapping start boots the game canvas', async ({ page }) => {
  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('canvas', { timeout: 10000 });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});

test('hero hides after start', async ({ page }) => {
  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('canvas', { timeout: 10000 });
  const hero = page.locator('#hero');
  await expect(hero).toHaveClass(/hidden/);
});
