import { expect, test, type Page } from '@playwright/test';

/* KiteMatch e2e — DOM/state based: real taps via window.__lenny. */

interface KiteState {
  kind: string;
  kites: Array<{ x: number; y: number; color: number; matched: boolean }>;
  shadows: Array<{ x: number; y: number; color: number; matched: boolean }>;
  selectedKind: number | null;
  wrongSinceLastMatch: number;
  wrongTotal: number;
  hint: string;
  done: boolean;
}

const UNLOCK_SKY = {
  firstSeen: Date.now(),
  lights: 4,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
    'thinking-forest': { finished: 1, unlocked: true },
  },
};

async function openKiteMatch(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: UNLOCK_SKY, dda: JSON.stringify({ 'space-sky': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="space-sky"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  /* the scene bridge must be live before the first tap */
  await expect.poll(async () => (await state(page))?.kind ?? '', { timeout: 10_000 }).toBe('kite-match');
  await page.waitForTimeout(350);
  await expect(page.locator('#hud-zone')).toHaveText(/שְׁמֵי הַמֶּרְחָב/);
}

async function state(page: Page): Promise<KiteState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as KiteState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(rect!.x + (dx / 420) * rect!.width, rect!.y + (dy / 720) * rect!.height);
}

test('level-0 completes by matching every kite to its color shadow', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openKiteMatch(page, 0.05);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    if (s.selectedKind === null) {
      const kite = s.kites.find((k) => !k.matched);
      if (kite) {
        await tapDesign(page, kite.x, kite.y);
        await page.waitForTimeout(260);
      }
    } else {
      const shadow = s.shadows.find((sh) => !sh.matched && sh.color === s.selectedKind);
      if (shadow) {
        await tapDesign(page, shadow.x, shadow.y);
        await page.waitForTimeout(420);
      } else {
        await page.waitForTimeout(200);
      }
    }
  }

  expect((await state(page))?.done ?? true).toBe(true);
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['space-sky']);
  expect(dda.rounds).toBe(1);
  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['space-sky'] ?? garden.zones['space-sky']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(errors).toEqual([]);
});

test('wrong shadow taps escalate the hint ladder', async ({ page }) => {
  test.setTimeout(120_000);
  await openKiteMatch(page, 0.05);

  /* two deliberate wrong pairings */
  for (let wrong = 1; wrong <= 2; wrong++) {
    const s = (await state(page))!;
    const kite = s.kites.find((k) => !k.matched)!;
    await tapDesign(page, kite.x, kite.y);
    await page.waitForTimeout(260);
    const shadow = s.shadows.find((sh) => !sh.matched && sh.color !== kite.color)!;
    await tapDesign(page, shadow.x, shadow.y);
    await page.waitForTimeout(500);
    const after = (await state(page))!;
    expect(after.wrongSinceLastMatch).toBe(wrong);
  }
  expect((await state(page))!.hint).toBe('clear');

  /* finish the board cleanly */
  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    if (s.selectedKind === null) {
      const kite = s.kites.find((k) => !k.matched);
      if (kite) {
        await tapDesign(page, kite.x, kite.y);
        await page.waitForTimeout(260);
      }
    } else {
      const shadow = s.shadows.find((sh) => !sh.matched && sh.color === s.selectedKind);
      if (shadow) {
        await tapDesign(page, shadow.x, shadow.y);
        await page.waitForTimeout(420);
      } else {
        await page.waitForTimeout(200);
      }
    }
  }
  expect((await state(page))?.done ?? true).toBe(true);
});
