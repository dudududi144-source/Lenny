import { expect, test } from '@playwright/test';

test('garden map: 10 zones in path order, ribbon draws, icons inline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('.zone-card')).toHaveCount(10);
  await expect(page.locator('.zone-card[data-zone="light-path"]')).not.toHaveClass(/locked/);
  await expect(page.locator('.zone-card[data-zone="breath-pool"]')).not.toHaveClass(/locked/);
  await expect(page.locator('.zone-card[data-zone="memory-hill"]')).toHaveClass(/locked/);
  await expect(page.locator('.path-ribbon path')).toHaveCount(2);
  await expect(page.locator('.zone-card[data-zone="light-path"] .zone-icon svg')).toBeVisible();

  /* fresh garden: light-path holds no registry games yet → ring reads 0/1 */
  await expect(page.locator('.zone-card[data-zone="light-path"] .ring-value')).toHaveText('0/1');
  expect(errors).toEqual([]);
});

test('unlock chain: finishing light-path once opens memory-hill', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 1,
        zones: { 'light-path': { finished: 1, unlocked: true } },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('.zone-card[data-zone="memory-hill"]')).not.toHaveClass(/locked/);
  /* memory-hill holds 3 registry games: memory-pairs-1/2 + sequence-echo-1 */
  await expect(page.locator('.zone-card[data-zone="memory-hill"] .ring-value')).toHaveText('0/3');
  await expect(page.locator('.zone-card[data-zone="attention-stream"]')).toHaveClass(/locked/);
});

test('locked zone tap gives gentle feedback, never a crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#toast')).toContainText('עוֹד קְצָת');
  expect(errors).toEqual([]);
});

test('garden shows the light counter from the cognitive core', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 7,
        zones: { 'light-path': { finished: 1, unlocked: true } },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('#light-count')).toHaveText('7');
  expect(errors).toEqual([]);
});
