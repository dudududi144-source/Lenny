import { expect, test, type Page } from '@playwright/test';

/* SequenceEcho e2e — DOM/state based: real taps via window.__lenny. */

interface EchoState {
  kind: string;
  round: number;
  totalRounds: number;
  phase: 'idle' | 'showing' | 'input' | 'done';
  sequence: Array<{ shape: string; tone: string }>;
  echoCount: number;
  hint: string;
  done: boolean;
  cells: Array<{ x: number; y: number; shape: string; tone: string }>;
}

const ADVANCED_HILL = {
  firstSeen: Date.now(),
  lights: 2,
  finished: { 'memory-hill': 2 },
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 2, unlocked: true },
  },
};

async function openSequenceEcho(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: ADVANCED_HILL, dda: JSON.stringify({ 'memory-hill': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  /* the scene bridge must be live before the first tap */
  await expect.poll(async () => (await state(page))?.kind ?? '', { timeout: 10_000 }).toBe('sequence-echo');
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('sequence-echo');
}

async function state(page: Page): Promise<EchoState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as EchoState | null);
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

test('level-0: three echoes completed; the DDA counts three clean rounds', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openSequenceEcho(page, 0.05);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    if (s.phase !== 'input') {
      await page.waitForTimeout(160);
      continue;
    }
    const step = s.sequence[s.echoCount];
    const cell = s.cells.find((c) => c.shape === step.shape && c.tone === step.tone);
    if (!cell) {
      await page.waitForTimeout(160);
      continue;
    }
    await tapDesign(page, cell.x, cell.y);
    await page.waitForTimeout(220);
  }

  expect((await state(page))?.done ?? true).toBe(true);
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['memory-hill']);
  expect(dda.rounds).toBe(3);

  const garden = await page.evaluate(() => window.__lenny!.garden());
  expect(garden.finished?.['memory-hill']).toBe(3);
  /* the ceremony holds ~5.2s (dt-clamped under load) + exit wipe — load-tolerant window */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 22000 });
  expect(errors).toEqual([]);
});

test('wrong echoes escalate the visible hint ladder', async ({ page }) => {
  test.setTimeout(150_000);
  await openSequenceEcho(page, 0.5);

  /* wait for the first input phase, then echo wrongly three times */
  const expectations = ['gentle', 'clear', 'show'];
  for (let miss = 0; miss < 3; miss++) {
    await expect
      .poll(async () => (await state(page))?.phase, { timeout: 30_000 })
      .toBe('input');
    const s = (await state(page))!;
    const wrongCell = s.cells.find(
      (c) => !(c.shape === s.sequence[0].shape && c.tone === s.sequence[0].tone),
    );
    expect(wrongCell).toBeTruthy();
    await tapDesign(page, wrongCell!.x, wrongCell!.y);
    await page.waitForTimeout(300);
    const after = (await state(page))!;
    expect(after.hint).toBe(expectations[miss]);
  }
});

test('Arena: echoes score points and the concert closes the session', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openSequenceEcho(page, 0.3);

  let sawScore = false;
  const deadline = Date.now() + 130_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s) break;
    if ((s.arenaScore ?? 0) > 0) sawScore = true;
    if (s.done) break;
    if (s.phase !== 'input') {
      await page.waitForTimeout(160);
      continue;
    }
    const step = s.sequence[s.echoCount];
    const cell = s.cells.find((c) => c.shape === step.shape && c.tone === step.tone);
    if (!cell) {
      await page.waitForTimeout(160);
      continue;
    }
    await tapDesign(page, cell.x, cell.y);
    await page.waitForTimeout(220);
  }

  expect(sawScore).toBe(true);
  const finalState = await state(page);
  expect(finalState?.done ?? true).toBe(true);
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
