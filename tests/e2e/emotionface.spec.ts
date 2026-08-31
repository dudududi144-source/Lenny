import { expect, test, type Page } from '@playwright/test';

/* EmotionFace e2e — DOM/state based: real taps via window.__lenny. */

interface EmotionState {
  kind: string;
  round: number;
  totalRounds: number;
  emotion: string;
  options: Array<{ x: number; y: number; label: string; emotion: string }>;
  wrongSinceLastCorrect: number;
  hint: string;
  done: boolean;
}

const UNLOCK_GARDEN = {
  firstSeen: Date.now(),
  lights: 6,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
    'thinking-forest': { finished: 1, unlocked: true },
    'space-sky': { finished: 1, unlocked: true },
    'words-valley': { finished: 1, unlocked: true },
  },
};

async function openEmotionFace(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: UNLOCK_GARDEN, dda: JSON.stringify({ 'feelings-garden': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="feelings-garden"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect(page.locator('#hud-zone')).toHaveText(/גַּן הָרְגָשׁוֹת/);
  /* the scene bridge must be live (spawned) before the first tap */
  await expect.poll(async () => (await state(page))?.options.length ?? 0, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(350);
}

async function state(page: Page): Promise<EmotionState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as EmotionState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(rect!.x + (dx / 420) * rect!.width, rect!.y + (dy / 720) * rect!.height);
}

test('level-0: all emotion rounds complete through real taps', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openEmotionFace(page, 0.05);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const match = s.options.find((o) => o.emotion === s.emotion);
    if (match) {
      await tapDesign(page, match.x, match.y);
      await page.waitForTimeout(650);
    } else {
      await page.waitForTimeout(200);
    }
  }

  const finalState = await state(page);
  expect(finalState?.done ?? true).toBe(true);
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['feelings-garden']);
  expect(dda.rounds).toBe(finalState?.totalRounds ?? 5);
  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['feelings-garden'] ?? garden.zones['feelings-garden']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(errors).toEqual([]);
});

test('two wrong answers escalate the hint to clear, then complete', async ({ page }) => {
  test.setTimeout(120_000);
  await openEmotionFace(page, 0.05);

  for (let wrong = 1; wrong <= 2; wrong++) {
    const s = (await state(page))!;
    const wrongOption = s.options.find((o) => o.emotion !== s.emotion)!;
    await tapDesign(page, wrongOption.x, wrongOption.y);
    await page.waitForTimeout(500);
    expect((await state(page))!.wrongSinceLastCorrect).toBe(wrong);
  }
  expect((await state(page))!.hint).toBe('clear');

  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const match = s.options.find((o) => o.emotion === s.emotion);
    if (match) {
      await tapDesign(page, match.x, match.y);
      await page.waitForTimeout(650);
    }
  }
  expect((await state(page))?.done ?? true).toBe(true);
});
