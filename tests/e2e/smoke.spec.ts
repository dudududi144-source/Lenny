import { test, expect } from '@playwright/test';

test('portal loads with canvas', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 10000 });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});

test('page title is Garden of Lights', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/\u05d2\u05b7\u05bc\u05df|\u05dc\u05b6\u05e0\u05b4\u05d9/);
});

test('portal advances past void without crash', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(4000);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});
