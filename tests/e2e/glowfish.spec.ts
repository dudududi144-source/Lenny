import { expect, test, type Page } from '@playwright/test';

/* GlowFish e2e — DOM/state based: real touchscreen taps aimed via the
   read-only window.__lenny bridge (no pixel scanning anywhere). */

interface GlowState {
  kind: string;
  round: number;
  found: number;
  toFind: number;
  hint: string;
  done: boolean;
  leader: { x: number; y: number } | null;
  fishCount: number;
  fishes: Array<{ x: number; y: number; target: boolean }>;
}

const UNLOCK_STREAM = {
  firstSeen: Date.now(),
  lights: 2,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
  },
};

function seedDda(level: number): string {
  return JSON.stringify({
    'attention-stream': { skill: level, streak: 0, rounds: 0, frustration: 0 },
  });
}

async function openGlowFish(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: UNLOCK_STREAM, dda: seedDda(ddaLevel) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="attention-stream"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
}

async function state(page: Page): Promise<GlowState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as GlowState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(
    rect!.x + (dx / 420) * rect!.width,
    rect!.y + (dy / 720) * rect!.height,
  );
}

test('level-0 session completes through real taps; DDA and garden advance', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openGlowFish(page, 0.05);

  /* play the real session: 3 rounds, following the live leader */
  const deadline = Date.now() + 60_000;
  let sawRound3 = false;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    if (s.round === 3) sawRound3 = true;
    if (s.leader) {
      await tapDesign(page, s.leader.x, s.leader.y);
      await page.waitForTimeout(280);
    } else {
      await page.waitForTimeout(180);
    }
  }
  expect(sawRound3).toBe(true);

  /* progress recorded through the untouched cognitive core */
  const dda = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-dda-v1') ?? '{}')['attention-stream']);
  expect(dda.rounds).toBe(3);
  expect(dda.skill).toBeGreaterThan(0.05);

  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['attention-stream'] ?? garden.zones['attention-stream']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);

  /* automatic return to the garden after the celebration gap */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 9000 });
  expect(await page.evaluate(() => window.__lenny?.scene())).toBeNull();
  expect(errors).toEqual([]);
});

test('wrong taps escalate the visible hint ladder', async ({ page }) => {
  test.setTimeout(60_000);
  await openGlowFish(page, 0.05);

  /* wait for a decoy, then tap the same non-target fish 3 times */
  await expect
    .poll(async () => {
      const s = await state(page);
      return s ? s.fishes.filter((f) => !f.target).length : 0;
    }, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);

  for (let miss = 1; miss <= 3; miss++) {
    const s = (await state(page))!;
    const decoy = s.fishes.find((f) => !f.target);
    expect(decoy, 'decoy fish present').toBeTruthy();
    await tapDesign(page, decoy!.x, decoy!.y);
    await page.waitForTimeout(160);
    const after = (await state(page))!;
    expect(after.hint).toBe(miss === 1 ? 'gentle' : miss === 2 ? 'clear' : 'show');
  }

  /* misses were reported to LearningSignals (untouched core) */
  const signals = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-signals-v1') ?? '{"events":[]}'));
  const misses = (signals.events as Array<{ kind: string; skill: string }>).filter(
    (e) => e.kind === 'attempt' && e.skill === 'attention.visual',
  ).length;
  expect(misses).toBeGreaterThanOrEqual(3);
});

test('high DDA level builds a bigger, moving pond with 3 targets', async ({ page }) => {
  test.setTimeout(60_000);
  /* registry advance: 3 finished sessions -> find-fish-4 (itemCount 9) */
  const advanced = {
    firstSeen: Date.now(),
    lights: 3,
    finished: { 'attention-stream': 3 },
    zones: {
      'light-path': { finished: 1, unlocked: true },
      'memory-hill': { finished: 1, unlocked: true },
      'attention-stream': { finished: 3, unlocked: true },
    },
  };
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: advanced, dda: seedDda(0.9) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="attention-stream"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();

  const s = (await state(page))!;
  expect(s.toFind).toBe(3);
  expect(s.fishCount).toBeGreaterThanOrEqual(6);

  /* active pond: fish actually move between polls */
  const before = (await state(page))!.fishes;
  await page.waitForTimeout(700);
  const after = (await state(page))!.fishes;
  const moved = after.some((f) => {
    const other = before.find((b) => b.target === f.target && Math.hypot(b.x - f.x, b.y - f.y) < 90);
    return !other || Math.hypot(other.x - f.x, other.y - f.y) > 2;
  });
  expect(moved).toBe(true);
});
