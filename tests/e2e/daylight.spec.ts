import { expect, test } from '@playwright/test';

/* Stage 6, commit 7 — the garden's real-time atmosphere:
 *   - four phases, chosen by the local hour (mockable via
 *     lenny-hour-override for deterministic e2e)
 *   - two different hours LOOK different (moon/stars vs butterflies)
 *   - the first hello of the day is hour-aware (בֹּקֶר טוֹב / עֶרֶב טוֹב)
 */

test('morning hour: golden veil + butterflies in the garden', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem('lenny-hour-override', '9');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('#garden-screen')).toHaveAttribute('data-daylight', 'morning');
  await expect(page.locator('#daylight-ambient .day-butterfly')).toHaveCount(4);
  await expect(page.locator('#daylight-ambient .day-moon')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('night hour: moon, stars and fireflies replace the butterflies', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem('lenny-hour-override', '22');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('#garden-screen')).toHaveAttribute('data-daylight', 'night');
  await expect(page.locator('#daylight-ambient .day-moon')).toHaveCount(1);
  await expect(page.locator('#daylight-ambient .day-star')).toHaveCount(6);
  await expect(page.locator('#daylight-ambient .day-firefly')).toHaveCount(4);
  await expect(page.locator('#daylight-ambient .day-butterfly')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the first hello of the day names the hour (and only the first)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  /* morning hour; the greet-mark is cleared exactly ONCE (init scripts
     re-run on every reload, so a plain removeItem would resurrect it) */
  await page.addInitScript(() => {
    localStorage.setItem('lenny-hour-override', '9');
    if (!localStorage.getItem('lenny-init-done')) {
      localStorage.removeItem('lenny-last-greet-day');
      localStorage.setItem('lenny-init-done', '1');
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('#garden-greeting')).toContainText('בֹּקֶר טוֹב');

  /* a reload on the same day: the hello happened, the plain greeting returns */
  await page.reload();
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('#garden-greeting')).not.toContainText('בֹּקֶר טוֹב');

  /* a fresh day at an evening hour greets differently */
  await page.addInitScript(() => {
    localStorage.setItem('lenny-hour-override', '18');
    if (localStorage.getItem('lenny-init-done') === '1') {
      localStorage.removeItem('lenny-last-greet-day');
      localStorage.setItem('lenny-init-done', '2');
    }
  });
  await page.reload();
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('#garden-greeting')).toContainText('עֶרֶב טוֹב');
  expect(errors).toEqual([]);
});
