import { expect, test } from '@playwright/test';

/* Stage 6 — the living catalog + the in-zone game shelf.
 * Additive contracts: the zone tap still opens the default game
 * directly (game-host.spec stays the law); the shelf is the extra
 * "which game?" layer inside the game screen. */

const UNLOCK_STREAM = {
  firstSeen: Date.now(),
  lights: 2,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
  },
};

async function enterZone(page: import('@playwright/test').Page, zone = 'attention-stream'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator(`.zone-card[data-zone="${zone}"]`).click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
}

test('zone tap still opens the game; the shelf lists seed + derived catalog', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);
  await enterZone(page);

  /* default progression untouched: done=1 → the second seed spec */
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('find-fish-2');
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('glow-fish');

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();

  /* 4 seed specs + 16 derived = 20 cards, in a scrollable row */
  const cards = page.locator('.shelf-card');
  await expect(cards).toHaveCount(20);
  await expect(page.locator('.shelf-card').first()).toHaveAttribute('data-spec', 'find-fish-1');

  /* tier 0 open, tier 3 locked — visible at a glance for a 4-year-old */
  const tier3 = page.locator('.shelf-card[data-spec="attention-find-target-15"]');
  await expect(tier3).toBeDisabled();
  await expect(tier3).toHaveAttribute('data-tier', '3');
  const tier0 = page.locator('.shelf-card[data-spec="attention-find-target-00"]');
  await expect(tier0).toBeEnabled();
  await expect(tier0.locator('.shelf-dots')).toHaveAttribute('aria-label', /דַּרְגָּה 1/);

  /* every card shows the child-facing niqqud name */
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-00"] .shelf-name')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('tier 1 opens after a tier-0 game completes ×3; tier 2+ stay locked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
    /* e2e seed default: the first tier-0 game of attention done ×3 */
    localStorage.setItem('lenny-game-finishes-v1', JSON.stringify({ 'attention-find-target-00': 3 }));
  }, UNLOCK_STREAM);
  await enterZone(page);

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();

  await expect(page.locator('.shelf-card[data-spec="attention-find-target-04"]')).toBeEnabled();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-05"]')).toBeEnabled();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-08"]')).toBeDisabled();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-15"]')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('finishing a tier-0 game three times (live) opens tier 1', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);
  await enterZone(page);

  /* play the tier-0 derived card to completion ×3 through the real
     ceremony → recordGameFinish — picking it from the shelf every run,
     exactly like a child would */
  const fishes = (): Promise<Array<{ x: number; y: number; target: boolean }>> =>
    page.evaluate(
      () => (window.__lenny?.sceneState() as { fishes?: Array<{ x: number; y: number; target: boolean }> } | null)?.fishes ?? [],
    );

  for (let run = 0; run < 3; run++) {
    /* pick the tier-0 game from the shelf */
    await page.locator('#hud-shelf').click();
    await expect(page.locator('#game-shelf')).toBeVisible();
    await page.locator('.shelf-card[data-spec="attention-find-target-00"]').click();
    await expect(page.locator('#game-shelf')).toBeHidden();

    const deadline = Date.now() + 60_000;
    for (;;) {
      const done = await page.evaluate(
        () => (window.__lenny?.sceneState() as { done?: boolean } | null)?.done ?? false,
      );
      if (done || Date.now() > deadline) break;
      const target = (await fishes()).find((f) => f.target);
      if (!target) {
        await page.waitForTimeout(220);
        continue;
      }
      const rect = await page.evaluate(() => window.__lenny?.canvasRect());
      const design = await page.evaluate(() => window.__lenny?.design);
      await page.mouse.click(
        rect!.x + (target.x / design!.w) * rect!.width,
        rect!.y + (target.y / design!.h) * rect!.height,
      );
      await page.waitForTimeout(260);
    }
    /* ceremony auto-advances back to the garden */
    await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 25_000 });
    await page.locator('.zone-card[data-zone="attention-stream"]').click();
    await expect(page.locator('#game-screen canvas')).toBeVisible();
  }

  /* the real payoff: tier 1 is open in the shelf now */
  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-04"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('picking an open card swaps the game without leaving the zone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
    localStorage.setItem('lenny-game-finishes-v1', JSON.stringify({ 'attention-find-target-00': 3 }));
  }, UNLOCK_STREAM);
  await enterZone(page);

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();
  await page.locator('.shelf-card[data-spec="attention-find-target-05"]').click();

  /* shelf closes, scene swaps in place, bridge follows the new spec */
  await expect(page.locator('#game-shelf')).toBeHidden();
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('attention-find-target-05');
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('glow-fish');
  await expect(page.locator('#hud-zone')).toHaveText(/נַחַל הַקֶּשֶׁב/);
  expect(errors).toEqual([]);
});
