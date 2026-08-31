import { expect, test, type Page } from '@playwright/test';

/* PlayPath e2e — DOM/state based. Physics are made deterministic by
   seeding Math.random before the app boots. */

interface PlayState {
  kind: string;
  score: number;
  starCount: number;
  best: number;
  player: { x: number; y: number };
  stars: Array<{ x: number; y: number }>;
  done: boolean;
}

async function openPlayPath(page: Page): Promise<void> {
  await page.addInitScript(() => {
    /* deterministic platform layout for a reproducible no-input run */
    let seed = 20260101;
    Math.random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    localStorage.setItem('lenny-garden', JSON.stringify({ firstSeen: Date.now(), lights: 0, zones: {} }));
    localStorage.removeItem('lenny_best');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="light-path"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect(page.locator('#hud-zone')).toHaveText(/שְׁבִיל הָאוֹר/);
}

async function state(page: Page): Promise<PlayState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as PlayState | null);
}

test('boots with a living board; a no-input run ends and keeps the best score', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openPlayPath(page);

  const first = (await state(page))!;
  expect(first.kind).toBe('play');
  expect(first.stars.length).toBeGreaterThan(0);
  expect(typeof first.best).toBe('number');

  /* steer to the far-left edge (real pointer steering): the player hugs
     the wall where platforms rarely reach, so the run ends by falling —
     deterministically starless, so garden progress must stay untouched */
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  const leftX = rect!.x + (8 / 420) * rect!.width;
  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    await page.mouse.move(leftX, rect!.y + rect!.height * 0.5);
    await page.waitForTimeout(400);
  }

  /* the run ends and the shell returns to the garden on its own */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 40_000 });

  const best = await page.evaluate(() => localStorage.getItem('lenny_best'));
  expect(best).not.toBeNull();
  expect(Number(best)).toBeGreaterThanOrEqual(0);

  /* a starless run must NOT record garden progress for light-path */
  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['light-path'] ?? garden.zones['light-path']?.finished ?? 0;
  expect(finished).toBe(0);
  expect(errors).toEqual([]);
});
