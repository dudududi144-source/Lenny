import { expect, test } from '@playwright/test';

/* Stage 7, commit 2 — the ten zone islands, verified through the
   read-only bridge (never pixels):
     - ids and order come straight from data/garden.ts
     - unlock flags come straight from the untouched ProgressStore
     - the fog islands (locked) + soft unlock lifts happen on refresh */

const WORLD_MODE = { 'lenny-garden-mode': 'world' };

async function openWorld(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((mode) => {
    for (const [k, v] of Object.entries(mode)) localStorage.setItem(k, v as string);
  }, WORLD_MODE);
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
}

test('the world reports all 10 zones in path order with honest unlock flags', async ({ page }) => {
  await openWorld(page);

  const zones = await page.evaluate(() => window.__lennyWorld?.zones() ?? []);
  expect(zones.map((z) => z.id)).toEqual([
    'light-path',
    'memory-hill',
    'attention-stream',
    'thinking-forest',
    'space-sky',
    'words-valley',
    'feelings-garden',
    'creativity-meadow',
    'rhythm-square',
    'breath-pool',
  ]);

  /* fresh garden: the two always-open gates are open, the rest is fog */
  for (const z of zones) {
    if (z.id === 'light-path' || z.id === 'breath-pool') expect(z.unlocked).toBe(true);
    else expect(z.unlocked).toBe(false);
    expect(z.bloom).toBe(0);
  }
});

test('unlock flags follow the saved ProgressStore chain', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 2,
        zones: { 'light-path': { finished: 1, unlocked: true } },
        finished: { 'light-path': 1 },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });

  const zones = await page.evaluate(() => window.__lennyWorld?.zones() ?? []);
  const byId = new Map(zones.map((z) => [z.id, z]));
  expect(byId.get('memory-hill')!.unlocked).toBe(true); /* light-path ×1 opens the gate */
  expect(byId.get('attention-stream')!.unlocked).toBe(false);
  expect(byId.get('light-path')!.bloom).toBe(1);
});

test('the world keeps rendering without errors while islands live', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openWorld(page);
  await page.waitForTimeout(2500); /* let the bobbers + shimmer loop run */

  const state = await page.evaluate(() => ({
    fps: window.__lennyWorld?.fps() ?? 0,
    zones: window.__lennyWorld?.zones().length ?? 0,
  }));
  expect(state.zones).toBe(10);
  expect(state.fps).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
