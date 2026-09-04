import { expect, test, type Page } from '@playwright/test';

/* RainbowOrder e2e — DOM/state based: real taps via window.__lenny.
   Stage 15-C: the first of the five new scenes under CI contract. */

interface StoneState {
  slot: number;
  name: string;
  placed: boolean;
  x: number;
  y: number;
}

interface RainbowState {
  kind: string;
  round: number;
  totalRounds: number;
  nextSlot: number;
  done: boolean;
  stones: StoneState[];
}

/* finished['thinking-forest'] = 2 → GameHost.open picks zoneCatalog[2]:
   GAME_REGISTRY order for the zone is sort-acorns-1, sort-acorns-2,
   rainbow-bridge-1, … — so the rainbow itself opens. */
const FOREST = {
  firstSeen: Date.now(),
  lights: 2,
  /* attention-stream finished once → the forest's gate is open;
     thinking-forest finished twice → GameHost picks zoneCatalog[2]:
     GAME_REGISTRY order is sort-acorns-1, sort-acorns-2, rainbow-bridge-1 */
  finished: { 'attention-stream': 1, 'thinking-forest': 2 },
  zones: {
    'attention-stream': { finished: 1, unlocked: true },
    'thinking-forest': { finished: 2, unlocked: true },
  },
};

async function state(page: Page): Promise<RainbowState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as RainbowState | null);
}

async function openRainbow(page: Page): Promise<void> {
  await page.addInitScript((garden) => {
    localStorage.setItem('lenny-garden', JSON.stringify(garden));
  }, FOREST);
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="thinking-forest"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  /* the scene bridge must be live before the first tap */
  await expect.poll(async () => (await state(page))?.kind ?? '', { timeout: 10_000 }).toBe('rainbow-order');
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('rainbow-order');
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

test('rainbow-order: three rounds sorted; the garden + DDA record honestly', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openRainbow(page);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const stone = s.stones.find((st) => st.slot === s.nextSlot && !st.placed);
    if (!stone) {
      await page.waitForTimeout(160);
      continue;
    }
    await tapDesign(page, stone.x, stone.y);
    await page.waitForTimeout(240);
  }

  expect((await state(page))?.done ?? true).toBe(true);

  /* the ceremony holds ~5.2s (dt-clamped under load) + exit wipe — load-tolerant window */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 22000 });

  /* the finish records inside finishWithCeremony (a 900ms beat after
     the last round) — read the garden only after the exit landed */
  const garden = await page.evaluate(() => window.__lenny!.garden());
  expect(garden.finished?.['thinking-forest']).toBe(3);
  expect(errors).toEqual([]);
});
