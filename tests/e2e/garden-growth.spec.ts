import { expect, test } from '@playwright/test';

/* Stage 6, commit 6 — the garden that GROWS:
 *   - one open flower per finished game in its zone card
 *   - the global bloom ladder 0..5 changes what the garden shows
 *   - returning from a game opens the newest flower (bloom-in payoff)
 */

test('fresh garden: soil only, every zone shows closed buds', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.garden-life')).toBeVisible();
  await expect(page.locator('.garden-life')).toHaveAttribute('data-stage', 'soil');
  await expect(page.locator('.garden-life .life-item')).toHaveCount(0);
  /* light-path (unlocked, 0 finishes): buds only, nothing open */
  await expect(page.locator('.zone-card[data-zone="light-path"] .growth-flower.is-open')).toHaveCount(0);
  await expect(page.locator('.zone-card[data-zone="light-path"] .growth-flower')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('finished games bloom as flowers in their zones', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  /* 3 finishes in light-path → 3 open flowers there, 0 in breath-pool;
     global bloomLevel = floor(3/2) = 1 → sprouts stage */
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 3,
        zones: { 'light-path': { finished: 3, unlocked: true } },
        finished: { 'light-path': 3 },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('.zone-card[data-zone="light-path"] .growth-flower.is-open')).toHaveCount(3);
  await expect(page.locator('.zone-card[data-zone="breath-pool"] .growth-flower.is-open')).toHaveCount(0);
  await expect(page.locator('.garden-life')).toHaveAttribute('data-stage', 'sprouts');
  await expect(page.locator('.garden-life .life-sprout')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('the bloom ladder shows butterflies, trees and fireflies', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  /* enough progress for stage 5: 14 finishes → floor(14/2)=7 + lights 2 → 7+0 → clamp 5 */
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 2,
        zones: {
          'light-path': { finished: 7, unlocked: true },
          'memory-hill': { finished: 7, unlocked: true },
        },
        finished: { 'light-path': 7, 'memory-hill': 7 },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('.garden-life')).toHaveAttribute('data-stage', 'full');
  await expect(page.locator('.garden-life .life-butterfly')).toHaveCount(3);
  await expect(page.locator('.garden-life .life-tree')).toHaveCount(3);
  await expect(page.locator('.garden-life .life-firefly')).toHaveCount(7);
  /* the growth row caps at 6 slots and shows the overflow honestly */
  await expect(page.locator('.zone-card[data-zone="light-path"] .growth-flower.is-open')).toHaveCount(6);
  await expect(page.locator('.zone-card[data-zone="light-path"] .growth-more')).toHaveText('+1');
  expect(errors).toEqual([]);
});

test('returning from a game opens the newest flower (the payoff)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  /* breath-pool already finished once; the next finish must open flower #2
     with the bloom-in animation when the garden takes over */
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 1,
        zones: { 'breath-pool': { finished: 1, unlocked: true } },
        finished: { 'breath-pool': 1 },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.zone-card[data-zone="breath-pool"] .growth-flower.is-open')).toHaveCount(1);

  await page.locator('.zone-card[data-zone="breath-pool"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();

  /* light every lantern (slow taps through the live bridge, exactly
     like game-host.spec's pointer proof) */
  const deadline = Date.now() + 60_000;
  for (;;) {
    const st = await page.evaluate(
      () => window.__lenny?.sceneState() as { lanterns?: Array<{ x: number; y: number; lit: boolean }>; done?: boolean } | null,
    );
    if (!st || st.done || Date.now() > deadline) break;
    const lantern = st.lanterns?.find((l) => !l.lit) ?? null;
    if (!lantern) {
      await page.waitForTimeout(240);
      continue;
    }
    const rect = await page.evaluate(() => window.__lenny?.canvasRect());
    const design = await page.evaluate(() => window.__lenny?.design);
    await page.mouse.click(
      rect!.x + (lantern.x / design!.w) * rect!.width,
      rect!.y + (lantern.y / design!.h) * rect!.height,
    );
    await page.waitForTimeout(320);
  }

  /* the ceremony hands back to the garden — the second flower opens */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('.zone-card[data-zone="breath-pool"] .growth-flower.is-open')).toHaveCount(2);
  await expect(page.locator('.zone-card[data-zone="breath-pool"] .growth-flower.bloom-in')).toHaveCount(1);
  expect(errors).toEqual([]);
});
