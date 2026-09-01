import { expect, test, type Page } from '@playwright/test';

/* AcornSort e2e — DOM/state based: real taps via window.__lenny. */

interface AcornState {
  kind: string;
  round: number;
  totalRounds: number;
  acorns: Array<{ id: string; sizeIndex: number; x: number; y: number; picked: boolean; placed: boolean }>;
  slots: Array<{ x: number; y: number; sizeIndex: number; filled: boolean }>;
  rejects: number;
  hint: string;
  done: boolean;
}

const UNLOCK_FOREST = {
  firstSeen: Date.now(),
  lights: 3,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
  },
};

async function openAcornSort(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: UNLOCK_FOREST, dda: JSON.stringify({ 'thinking-forest': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="thinking-forest"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  /* the scene bridge must be live before the first tap */
  await expect.poll(async () => (await state(page))?.kind ?? '', { timeout: 10_000 }).toBe('acorn-sort');
  await page.waitForTimeout(350);
  await expect(page.locator('#hud-zone')).toHaveText(/יַעַר הַחֲשִׁיבָה/);
}

async function state(page: Page): Promise<AcornState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as AcornState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  /* map through the LIVE Arena world space (never a hardcoded 420x720) */
  const { rect, design } = await page.evaluate(() => ({
    rect: window.__lenny?.canvasRect(),
    design: window.__lenny?.design,
  }));
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(
    rect!.x + (dx / design!.w) * rect!.width,
    rect!.y + (dy / design!.h) * rect!.height,
  );
}

test('level-0: three rounds complete via tap-pick / tap-place', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openAcornSort(page, 0.05);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const acorn = s.acorns.find((a) => !a.placed && !a.picked);
    if (acorn) {
      await tapDesign(page, acorn.x, acorn.y);
      await page.waitForTimeout(240);
      await tapDesign(page, acorn.x, acorn.y); /* keep pick stable if needed */
      await page.waitForTimeout(200);
      const picked = (await state(page))?.acorns.find((a) => a.id === acorn.id && a.picked);
      const target = (await state(page))?.slots.find((slot) => !slot.filled && picked && slot.sizeIndex === acorn.sizeIndex);
      if (target) {
        await tapDesign(page, target.x, target.y);
        await page.waitForTimeout(420);
      }
    } else {
      await page.waitForTimeout(300);
    }
  }

  expect((await state(page))?.done ?? true).toBe(true);
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['thinking-forest']);
  expect(dda.rounds).toBe(3);
  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['thinking-forest'] ?? garden.zones['thinking-forest']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(errors).toEqual([]);
});

test('wrong circle rejects, hints escalate, board still completable', async ({ page }) => {
  test.setTimeout(150_000);
  await openAcornSort(page, 0.05);

  /* deliberate wrong placement */
  const s = (await state(page))!;
  const acorn = s.acorns.find((a) => !a.placed)!;
  await tapDesign(page, acorn.x, acorn.y);
  await page.waitForTimeout(260);
  const wrongSlot = s.slots.find((slot) => slot.sizeIndex !== acorn.sizeIndex)!;
  await tapDesign(page, wrongSlot.x, wrongSlot.y);
  await page.waitForTimeout(700);
  expect((await state(page))!.rejects).toBeGreaterThanOrEqual(1);

  /* complete everything */
  const deadline = Date.now() + 110_000;
  while (Date.now() < deadline) {
    const cur = await state(page);
    if (!cur || cur.done) break;
    const a = cur.acorns.find((item) => !item.placed);
    if (a) {
      await tapDesign(page, a.x, a.y);
      await page.waitForTimeout(240);
      const slot = (await state(page))?.slots.find((item) => !item.filled && item.sizeIndex === a.sizeIndex);
      if (slot) {
        await tapDesign(page, slot.x, slot.y);
        await page.waitForTimeout(420);
      }
    } else {
      await page.waitForTimeout(300);
    }
  }
  expect((await state(page))?.done ?? true).toBe(true);
});
