import { expect, test, type Page } from '@playwright/test';

/* DrumBeat e2e — DOM/state based: real taps via window.__lenny. */

interface DrumState {
  kind: string;
  bpm: number;
  beats: number;
  hits: number;
  misses: number;
  total: number;
  ratio: number;
  done: boolean;
  nextBeatInMs: number | null;
}

const UNLOCK_SQUARE = {
  firstSeen: Date.now(),
  lights: 7,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
    'thinking-forest': { finished: 1, unlocked: true },
    'space-sky': { finished: 1, unlocked: true },
    'words-valley': { finished: 1, unlocked: true },
    'feelings-garden': { finished: 1, unlocked: true },
    'creativity-meadow': { finished: 1, unlocked: true },
  },
};

async function openDrumBeat(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: UNLOCK_SQUARE, dda: JSON.stringify({ 'rhythm-square': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="rhythm-square"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  /* the scene bridge must be live before the first tap */
  await expect.poll(async () => (await state(page))?.kind ?? '', { timeout: 10_000 }).toBe('drum-beat');
  await page.waitForTimeout(350);
  await expect(page.locator('#hud-zone')).toHaveText(/כִּכַּר הַקֶּצֶב/);
}

async function state(page: Page): Promise<DrumState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as DrumState | null);
}

async function tapCanvasCenter(page: Page): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(rect!.x + rect!.width / 2, rect!.y + rect!.height * 0.75);
}

test('session completes on its own; the sweep marks missed beats', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openDrumBeat(page, 0.05);

  await expect
    .poll(async () => (await state(page))?.done, { timeout: 45_000 })
    .toBe(true);

  const s = (await state(page))!;
  expect(s.total).toBeGreaterThanOrEqual(8);
  expect(s.misses).toBeGreaterThan(0);
  expect(s.done).toBe(true);

  /* Gate B exception ported: ratio < 0.5 -> outcome(false) is allowed */
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['rhythm-square']);
  expect(dda.rounds).toBe(1);
  /* ceremony hold + exit wipe — load-tolerant window */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 22000 });
  expect(errors).toEqual([]);
});

test('tapping on the beat collects hits', async ({ page }) => {
  test.setTimeout(120_000);
  await openDrumBeat(page, 0.05);

  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const next = s.nextBeatInMs;
    if (next !== null && next <= 170) {
      await tapCanvasCenter(page);
      await page.waitForTimeout(90);
    } else {
      await page.waitForTimeout(40);
    }
  }

  const s = (await state(page))!;
  expect(s.done).toBe(true);
  expect(s.hits).toBeGreaterThanOrEqual(3);
});
