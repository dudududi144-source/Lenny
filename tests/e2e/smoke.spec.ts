import { expect, test } from '@playwright/test';

/* Stage 3 e2e — DOM-based only. The canvas games are driven through
   real touch events + the window.__lenny state bridge (no pixel scanning). */

test('hero renders with gradient design system, animated Lenny SVG and RTL title', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');

  await expect(page.locator('#hero-screen h1')).toHaveText(/לֶנִי/);
  await expect(page.locator('#hero-screen .lenny-figure svg')).toBeVisible();
  await expect(page.locator('#hero-screen .stars-layer')).toHaveCount(3);

  /* design tokens applied: layered gradient background, never a flat color */
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(bodyBg).toContain('gradient');

  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  expect(errors).toEqual([]);
});

test('CTA transitions to the garden screen and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('#garden-screen')).toBeVisible();
  await expect(page.locator('#garden-screen .garden-greeting')).not.toBeEmpty();
  await page.getByRole('button', { name: /חזרה/ }).click();
  await expect(page.locator('#hero-screen')).toBeVisible();
});

test('returning player sees the continue path and a lit bloom badge', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 4,
        zones: { 'light-path': { finished: 2, unlocked: true } },
      }),
    );
  });
  await page.goto('/');
  await expect(page.locator('#continue-btn')).toBeVisible();
  await expect(page.locator('#hero-screen .badge.is-lit')).toBeVisible();
});
