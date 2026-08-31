import { expect, test, type Page } from '@playwright/test';

/* BeePaint e2e — DOM/state based: real taps via window.__lenny. */

interface BeeState {
  kind: string;
  petalsFilled: number;
  petalsTotal: number;
  lastMixed: string | null;
  primarySpots: Array<{ x: number; y: number; color: number }>;
  done: boolean;
}

async function openBeePaint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
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
        },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="creativity-meadow"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect(page.locator('#hud-zone')).toHaveText(/אֲחוּ הַיְּצִירָה/);
}

async function state(page: Page): Promise<BeeState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as BeeState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(rect!.x + (dx / 420) * rect!.width, rect!.y + (dy / 720) * rect!.height);
}

test('five mixes fill the flower; completion records the outcome', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openBeePaint(page);

  const s = (await state(page))!;
  expect(s.petalsTotal).toBe(5);
  const a = s.primarySpots[0];
  const b = s.primarySpots[1];

  /* every different-primary pair mixes and auto-fills the next petal */
  for (let i = 0; i < 5; i++) {
    await tapDesign(page, a.x, a.y);
    await page.waitForTimeout(200);
    await tapDesign(page, b.x, b.y);
    await page.waitForTimeout(450);
    const after = (await state(page))!;
    expect(after.petalsFilled).toBe(i + 1);
  }

  await expect
    .poll(async () => (await state(page))?.done, { timeout: 10000 })
    .toBe(true);

  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['creativity-meadow'] ?? garden.zones['creativity-meadow']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(errors).toEqual([]);
});
