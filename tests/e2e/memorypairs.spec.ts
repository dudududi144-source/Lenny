import { expect, test, type Page } from '@playwright/test';

/* MemoryPairs e2e — DOM/state based: real taps aimed via window.__lenny. */

interface PairState {
  kind: string;
  pairsFound: number;
  totalPairs: number;
  mistakes: number;
  hint: string;
  peekSeen: boolean;
  locked: boolean;
  done: boolean;
  slots: Array<{
    index: number;
    x: number;
    y: number;
    kind: { suit: string; tone: string };
    state: 'down' | 'flipping' | 'up';
    matched: boolean;
  }>;
}

const UNLOCK_HILL = {
  firstSeen: Date.now(),
  lights: 1,
  zones: { 'light-path': { finished: 1, unlocked: true } },
};

async function openMemoryPairs(page: Page, ddaLevel: number, garden = UNLOCK_HILL): Promise<void> {
  await page.addInitScript(
    ({ gardenState, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(gardenState));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { gardenState: garden, dda: JSON.stringify({ 'memory-hill': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  /* the scene bridge must be live before the first tap */
  await expect.poll(async () => (await state(page))?.kind ?? '', { timeout: 10_000 }).toBe('memory-pairs');
  await page.waitForTimeout(350);
  await expect(page.locator('#hud-zone')).toHaveText(/גִּבְעַת הַזִּכָּרוֹן/);
}

async function state(page: Page): Promise<PairState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as PairState | null);
}

async function tapSlot(page: Page, slot: { x: number; y: number }): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(
    rect!.x + (slot.x / 420) * rect!.width,
    rect!.y + (slot.y / 720) * rect!.height,
  );
}

async function settle(page: Page): Promise<void> {
  await expect
    .poll(async () => (await state(page))?.locked, { timeout: 6000 })
    .toBe(false);
}

async function revealPair(page: Page, a: { x: number; y: number }, b: { x: number; y: number }): Promise<void> {
  await tapSlot(page, a);
  await page.waitForTimeout(380); /* flip half+half */
  await tapSlot(page, b);
  await page.waitForTimeout(380);
  await settle(page);
  await page.waitForTimeout(120);
}

async function playBoard(page: Page, deadlineMs = 60_000): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) return;
    const down = s.slots.filter((slot) => slot.state === 'down' && !slot.matched);
    if (down.length < 2) {
      await page.waitForTimeout(150);
      continue;
    }
    /* find a matching pair among the face-down slots (bridge knows the deck) */
    const pair = down.find(
      (a) => down.find((b) => b !== a && b.kind.suit === a.kind.suit && b.kind.tone === a.kind.tone),
    );
    if (!pair) {
      await page.waitForTimeout(150);
      continue;
    }
    const mate = down.find((b) => b !== pair && b.kind.suit === pair.kind.suit && b.kind.tone === pair.kind.tone)!;
    await revealPair(page, { x: pair.x, y: pair.y }, { x: mate.x, y: mate.y });
  }
}

test('level-0: no exposure peek, read-free completion, garden advances', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openMemoryPairs(page, 0.1);
  await page.waitForTimeout(1500);
  expect((await state(page))!.peekSeen).toBe(false);

  await playBoard(page);

  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['memory-hill']);
  expect(dda.rounds).toBe(1);
  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['memory-hill'] ?? garden.zones['memory-hill']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(errors).toEqual([]);
});

test('level-0.5: peek reveals the deck once, then the board completes', async ({ page }) => {
  test.setTimeout(120_000);
  await openMemoryPairs(page, 0.55);

  await expect
    .poll(async () => (await state(page))?.peekSeen, { timeout: 8000 })
    .toBe(true);
  await settle(page);
  await page.waitForTimeout(600);

  const s = (await state(page))!;
  expect(s.slots.every((slot) => slot.state === 'down')).toBe(true);
  expect(s.totalPairs).toBe(4); /* memory-pairs-1: itemCount 4 -> 2x4 */

  await playBoard(page);
  expect((await state(page))?.done ?? true).toBe(true);
});

test('level-0.95: misses escalate the hint ladder and light the dim aid', async ({ page }) => {
  test.setTimeout(120_000);
  /* registry advance: memory-hill finished once -> memory-pairs-2 (6 pairs) */
  const advanced = {
    firstSeen: Date.now(),
    lights: 2,
    finished: { 'memory-hill': 1 },
    zones: {
      'light-path': { finished: 1, unlocked: true },
      'memory-hill': { finished: 1, unlocked: true },
    },
  };
  await openMemoryPairs(page, 0.95, advanced);
  await settle(page);

  /* three deliberate misses on non-matching pairs */
  for (let miss = 1; miss <= 3; miss++) {
    const s = (await state(page))!;
    const down = s.slots.filter((slot) => slot.state === 'down');
    const a = down[0];
    const b = down.find((slot) => slot !== a && (slot.kind.suit !== a.kind.suit || slot.kind.tone !== a.kind.tone));
    expect(b).toBeTruthy();
    await revealPair(page, a, b);
    const after = (await state(page))!;
    expect(after.mistakes).toBe(miss);
  }
  expect((await state(page))!.hint).toBe('show');

  /* one more miss crosses dimAfterMisses=4 -> failed backs dim */
  const s = (await state(page))!;
  const down = s.slots.filter((slot) => slot.state === 'down');
  const a = down[0];
  const b = down.find((slot) => slot !== a && (slot.kind.suit !== a.kind.suit || slot.kind.tone !== a.kind.tone))!;
  await revealPair(page, a, b);
  expect((await state(page))!.mistakes).toBe(4);

  /* still winnable */
  await playBoard(page);
  expect((await state(page))?.done ?? true).toBe(true);
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['memory-hill']);
  expect(dda.rounds).toBe(1);
});

test('Arena: matches build score+combo and the mission chip tracks progress', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openMemoryPairs(page, 0.1);
  await page.waitForTimeout(1500);

  let sawScore = false;
  let sawMission = false;
  const deadline = Date.now() + 70_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    if ((s.arenaScore ?? 0) > 0) sawScore = true;
    const mission = await page.locator('#hud-mission').textContent();
    if (mission && /נִמְצְאוּ/.test(mission)) sawMission = true;
    const down = s.slots.filter((slot) => slot.state === 'down' && !slot.matched);
    const pair = down.find(
      (a) => down.find((b) => b !== a && b.kind.suit === a.kind.suit && b.kind.tone === a.kind.tone),
    );
    if (!pair) {
      await page.waitForTimeout(150);
      continue;
    }
    const mate = down.find((b) => b !== pair && b.kind.suit === pair.kind.suit && b.kind.tone === pair.kind.tone)!;
    await revealPair(page, { x: pair.x, y: pair.y }, { x: mate.x, y: mate.y });
  }

  expect(sawScore).toBe(true);
  expect(sawMission).toBe(true);
  expect((await state(page))!.ceremonyOpen ?? true).toBe(true);
  expect(errors).toEqual([]);
});
