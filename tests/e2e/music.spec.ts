import { expect, test } from '@playwright/test';

/* Stage 6, commit 5 — the soundtrack contract, heard through the bridge:
 *   - NO audio before a user gesture (autoplay policy)
 *   - the mood follows the zone (attention-stream = calm,
 *     memory-hill = happy, breath-pool = night)
 *   - DDA level flows into musical intensity
 *   - zero console errors while all of this runs
 */

const baseGarden = (extra: Record<string, { finished: number; unlocked: boolean }> = {}) => ({
  firstSeen: Date.now(),
  lights: 4,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    ...extra,
  },
});

test('no soundtrack before the first interaction (autoplay policy)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  const music = await page.evaluate(() => window.__lenny?.music());
  expect(music).toMatchObject({ hasContext: false, running: false });
  expect(errors).toEqual([]);
});

test("after real gestures the soundtrack runs, in the zone's mood", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, baseGarden());

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  /* attention-stream: calm water plucks */
  await page.locator('.zone-card[data-zone="attention-stream"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();

  /* the first shell tap WAS a gesture — the context exists now */
  await expect
    .poll(async () => (await page.evaluate(() => window.__lenny?.music()))?.hasContext, { timeout: 10_000 })
    .toBe(true);
  await expect
    .poll(async () => (await page.evaluate(() => window.__lenny?.music()))?.running, { timeout: 10_000 })
    .toBe(true);
  expect((await page.evaluate(() => window.__lenny?.music()))?.mood).toBe('calm');

  /* memory-hill: happy bells */
  await page.locator('#game-back').click();
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 10_000 });
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect
    .poll(async () => (await page.evaluate(() => window.__lenny?.music()))?.mood, { timeout: 10_000 })
    .toBe('happy');

  /* breath-pool: night, pad-only */
  await page.locator('#game-back').click();
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 10_000 });
  await page.locator('.zone-card[data-zone="breath-pool"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect
    .poll(async () => (await page.evaluate(() => window.__lenny?.music()))?.mood, { timeout: 10_000 })
    .toBe('night');

  expect(errors).toEqual([]);
});

test('DDA level flows into musical intensity', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(({ garden, dda }) => {
    localStorage.setItem('lenny-garden', JSON.stringify(garden));
    localStorage.setItem('lenny-dda-v1', dda);
  }, {
    garden: baseGarden(),
    dda: JSON.stringify({ 'attention-stream': { skill: 0.9, streak: 0, rounds: 5, frustration: 0 } }),
  });

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="attention-stream"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();

  await expect
    .poll(
      async () => {
        const m = await page.evaluate(() => window.__lenny?.music());
        return m ? m.intensity > 0.5 : false;
      },
      { timeout: 10_000 },
    )
    .toBe(true); /* a hard game sounds busier than a calm one */
  expect(errors).toEqual([]);
});
