import { test, expect } from '@playwright/test';

test('game loads with title screen', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the game canvas to appear
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  // Verify the page title
  await expect(page).toHaveTitle(/לֶנִי/);
});

test('game canvas is visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});

test('clicking starts the game', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 10000 });
  
  // Click to start the game
  await page.click('canvas');
  
  // Wait a bit for the game to start
  await page.waitForTimeout(500);
});
