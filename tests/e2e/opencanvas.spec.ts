import { expect, test, type Page } from '@playwright/test';

/* OpenCanvas e2e — DOM/state based; strokes drawn with real mouse drags. */

interface CanvasState {
  kind: string;
  strokes: number;
  color: number;
  brushSize: number;
  done: boolean;
}

async function openOpenCanvas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now(),
        lights: 7,
        finished: { 'creativity-meadow': 1 },
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
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="creativity-meadow"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
}

async function state(page: Page): Promise<CanvasState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as CanvasState | null);
}

async function designToPage(page: Page, dx: number, dy: number): Promise<{ x: number; y: number }> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  return {
    x: rect!.x + (dx / 420) * rect!.width,
    y: rect!.y + (dy / 720) * rect!.height,
  };
}

async function dragStroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test('select a color, draw real strokes, finish to the garden', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openOpenCanvas(page);

  const s = (await state(page))!;

  /* tap the gold color disc (bottom palette row) */
  const colorY = 720 * 0.9;
  const goldX = 420 * (0.1 + 1 * 0.133);
  await page.touchscreen.tap(
    ...(await (async () => {
      const p = await designToPage(page, goldX, colorY);
      return [p.x, p.y] as const;
    })()),
  );
  await page.waitForTimeout(200);
  expect((await state(page))!.color).not.toBe(s.color);

  /* two real strokes */
  await dragStroke(page, await designToPage(page, 120, 300), await designToPage(page, 260, 380));
  await page.waitForTimeout(150);
  await dragStroke(page, await designToPage(page, 200, 420), await designToPage(page, 330, 470));
  await page.waitForTimeout(150);
  expect((await state(page))!.strokes).toBe(2);

  /* done button (top center) */
  const done = await designToPage(page, 210, 720 * 0.045);
  await page.touchscreen.tap(done.x, done.y);
  await expect
    .poll(async () => (await state(page))?.done, { timeout: 8000 })
    .toBe(true);

  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['creativity-meadow'] ?? garden.zones['creativity-meadow']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(errors).toEqual([]);
});
