import { expect, test } from '@playwright/test';

/* Stage 6 — the living catalog + the in-zone game shelf.
 * Additive contracts: the zone tap still opens the default game
 * directly (game-host.spec stays the law); the shelf is the extra
 * "which game?" layer inside the game screen. */

const UNLOCK_STREAM = {
  firstSeen: Date.now(),
  lights: 2,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
  },
};

async function enterZone(page: import('@playwright/test').Page, zone = 'attention-stream'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator(`.zone-card[data-zone="${zone}"]`).click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
}

test('zone tap still opens the game; the shelf lists seed + derived catalog', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);
  await enterZone(page);

  /* default progression untouched: done=1 → the second seed spec */
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('find-fish-2');
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('glow-fish');

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();

  /* 4 seed specs + 16 derived = 20 cards, in a scrollable row */
  const cards = page.locator('.shelf-card');
  await expect(cards).toHaveCount(20);
  await expect(page.locator('.shelf-card').first()).toHaveAttribute('data-spec', 'find-fish-1');

  /* tier 0 open, tier 3 locked — visible at a glance for a 4-year-old */
  const tier3 = page.locator('.shelf-card[data-spec="attention-find-target-15"]');
  await expect(tier3).toBeDisabled();
  await expect(tier3).toHaveAttribute('data-tier', '3');
  const tier0 = page.locator('.shelf-card[data-spec="attention-find-target-00"]');
  await expect(tier0).toBeEnabled();
  await expect(tier0.locator('.shelf-dots')).toHaveAttribute('aria-label', /דַּרְגָּה 1/);

  /* every card shows a child-facing Hebrew name — never a raw id */
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-00"] .shelf-name')).toHaveText(/\p{Script=Hebrew}/u);
  await expect(page.locator('.shelf-card[data-spec="find-fish-1"] .shelf-name')).toHaveText('הַדָּג הַזָּהוּב');
  const names = await page.locator('.shelf-card .shelf-name').allTextContents();
  for (const n of names) expect(n).not.toMatch(/^[a-z][a-z-]*\d*$/);
  expect(errors).toEqual([]);
});

test('tier 1 opens after a tier-0 game completes ×3; tier 2+ stay locked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
    /* e2e seed default: the first tier-0 game of attention done ×3 */
    localStorage.setItem('lenny-game-finishes-v1', JSON.stringify({ 'attention-find-target-00': 3 }));
  }, UNLOCK_STREAM);
  await enterZone(page);

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();

  await expect(page.locator('.shelf-card[data-spec="attention-find-target-04"]')).toBeEnabled();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-05"]')).toBeEnabled();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-08"]')).toBeDisabled();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-15"]')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('finishing a tier-0 game three times (live) opens tier 1', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);
  await enterZone(page);

  /* play the tier-0 derived card to completion ×3 through the real
     ceremony → recordGameFinish — picking it from the shelf every run,
     exactly like a child would */
  const fishes = (): Promise<Array<{ x: number; y: number; target: boolean }>> =>
    page.evaluate(
      () => (window.__lenny?.sceneState() as { fishes?: Array<{ x: number; y: number; target: boolean }> } | null)?.fishes ?? [],
    );

  for (let run = 0; run < 3; run++) {
    /* pick the tier-0 game from the shelf */
    await page.locator('#hud-shelf').click();
    await expect(page.locator('#game-shelf')).toBeVisible();
    await page.locator('.shelf-card[data-spec="attention-find-target-00"]').click();
    await expect(page.locator('#game-shelf')).toBeHidden();

    const deadline = Date.now() + 60_000;
    for (;;) {
      const done = await page.evaluate(
        () => (window.__lenny?.sceneState() as { done?: boolean } | null)?.done ?? false,
      );
      if (done || Date.now() > deadline) break;
      const target = (await fishes()).find((f) => f.target);
      if (!target) {
        await page.waitForTimeout(220);
        continue;
      }
      const rect = await page.evaluate(() => window.__lenny?.canvasRect());
      const design = await page.evaluate(() => window.__lenny?.design);
      await page.mouse.click(
        rect!.x + (target.x / design!.w) * rect!.width,
        rect!.y + (target.y / design!.h) * rect!.height,
      );
      await page.waitForTimeout(260);
    }
    /* ceremony auto-advances back to the garden */
    await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 45_000 });
    await page.locator('.zone-card[data-zone="attention-stream"]').click();
    await expect(page.locator('#game-screen canvas')).toBeVisible();
  }

  /* the real payoff: tier 1 is open in the shelf now */
  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();
  await expect(page.locator('.shelf-card[data-spec="attention-find-target-04"]')).toBeEnabled();
  expect(errors).toEqual([]);
});


test('שׁחק שוב replays THE SAME game (never skips ahead)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);
  await enterZone(page);
  const specBefore = await page.evaluate(() => window.__lenny?.spec());

  /* play to completion (the ceremony entrance is armed at done) */
  const deadline = Date.now() + 90_000;
  for (;;) {
    const st = (await page.evaluate(() => (window.__lenny?.sceneState() as { done?: boolean } | null)))!;
    if (st?.done || Date.now() > deadline) break;
    const fish = (await page.evaluate(
      () => (window.__lenny?.sceneState() as { leader?: { x: number; y: number } | null; fishes?: Array<{ x: number; y: number; target: boolean }> | null })?.leader ?? (window.__lenny?.sceneState() as { fishes?: Array<{ x: number; y: number; target: boolean }> } | null)?.fishes?.find((f) => f.target) ?? null,
    ));
    if (!fish) {
      await page.waitForTimeout(200);
      continue;
    }
    const rect = await page.evaluate(() => window.__lenny?.canvasRect());
    const design = await page.evaluate(() => window.__lenny?.design);
    await page.mouse.click(
      rect!.x + (fish.x / design!.w) * rect!.width,
      rect!.y + (fish.y / design!.h) * rect!.height,
    );
    await page.waitForTimeout(230);
  }

  /* tap שחק שוב THE INSTANT the ceremony shows — waitForFunction polls
     INSIDE the page, so the race against the 5.2s auto-advance is won
     within one rendered frame */
  await page.waitForFunction(
    () => ((window.__lenny?.sceneState() as { ceremonyOpen?: boolean } | null)?.ceremonyOpen) === true,
    undefined,
    { timeout: 30_000, polling: 50 },
  );
  const replay = (await page.evaluate(
    () => (window.__lenny?.sceneState() as { ceremonyReplay: { x: number; y: number; w: number; h: number } | null } | null)?.ceremonyReplay ?? null,
  )) ?? null;
  expect(replay).not.toBeNull();
  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  const design = await page.evaluate(() => window.__lenny?.design);
  await page.mouse.click(
    rect!.x + ((replay!.x + replay!.w / 2) / design!.w) * rect!.width,
    rect!.y + ((replay!.y + replay!.h / 2) / design!.h) * rect!.height,
  );
  await page.waitForTimeout(900);

  /* THE CONTRACT: same spec, same scene, ceremony closed, still in game */
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe(specBefore);
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('glow-fish');
  /* the replayed session is FRESH — not finished, playing again */
  const deadline2 = Date.now() + 60_000;
  let fresh = false;
  let lastRaw = '';
  while (Date.now() < deadline2) {
    const raw = await page.evaluate(() => {
      const st = (window.__lenny?.sceneState() ?? null) as { done?: boolean } | null;
      return st === null ? 'null' : JSON.stringify({ done: st.done, round: st.round });
    });
    if (raw !== lastRaw) { console.log('POLL-READ:', raw); lastRaw = raw; }
    if (raw.includes('"done":false')) { fresh = true; break; }
    await page.waitForTimeout(400);
  }
  if (!fresh) {
    const dump = await page.evaluate(() => {
      const st = window.__lenny?.sceneState() as Record<string, unknown> | null;
      return { screen: window.__lenny?.screen(), spec: window.__lenny?.spec(), paused: st?.hostPaused, round: st?.round, done: st?.done, open: st?.ceremonyOpen };
    });
    console.log('REPLAY-FAIL-DUMP:', JSON.stringify(dump));
  }
  expect(fresh, 'replayed session is fresh and playing').toBe(true);
  expect(errors).toEqual([]);
});

test('the shelf freezes the game while choosing, resumes on close', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);
  await enterZone(page);
  await expect
    .poll(async () => (await page.evaluate(() => window.__lenny?.sceneState()))?.fishCount ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(0);

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();

  /* frozen: two reads 700ms apart are identical while the shelf is open
     (reads wait for a live fish — respawn waves may briefly empty the pond) */
  const firstFish = async (): Promise<number | null> =>
    page.evaluate(() => {
      const st = window.__lenny?.sceneState() as { fishes?: Array<{ x: number }> } | null;
      return st?.fishes?.[0]?.x ?? null;
    });
  let a: number | null = null;
  for (let i = 0; i < 20 && a === null; i++) {
    a = await firstFish();
    if (a === null) await page.waitForTimeout(400);
  }
  expect(a).not.toBeNull();
  await page.waitForTimeout(700);
  const b = await firstFish();
  expect(b).toBe(a); /* PAUSED: the exact same fish at the exact same x */

  /* closed: the pond swims again */
  await page.locator('#shelf-close').click();
  await expect(page.locator('#game-shelf')).toBeHidden();
  let moved = false;
  for (let i = 0; i < 12 && !moved; i++) {
    await page.waitForTimeout(500);
    const c = await firstFish();
    moved = c !== null && c !== a;
  }
  expect(moved).toBe(true);
  expect(errors).toEqual([]);
});

test('legacy unique scenes stay reachable through the catalog', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  /* the whole path is open: this test walks three distant zones */
  const allOpen = {
    firstSeen: Date.now(),
    lights: 9,
    zones: Object.fromEntries(
      ['light-path', 'memory-hill', 'attention-stream', 'thinking-forest', 'space-sky', 'words-valley', 'feelings-garden', 'creativity-meadow'].map((z) => [
        z,
        { finished: 1, unlocked: true },
      ]),
    ),
  };
  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, allOpen);

  /* light-path: PlayPath via its own spec pin — scene key unchanged */
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="light-path"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('play');
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('light-path-play-1');
  await page.locator('#game-back').click();
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 10_000 });

  /* creativity: both template families visible; a derived open-create
     card plays the OpenCanvas scene under its own name */
  await page.locator('.zone-card[data-zone="creativity-meadow"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();
  await expect(page.locator('.shelf-card')).toHaveCount(18); /* 2 seed + 16 derived */
  await page.locator('.shelf-card[data-spec="creativity-open-create-02"]').click();
  await expect(page.locator('#game-shelf')).toBeHidden();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('open-create');
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('creativity-open-create-02');
  await page.locator('#game-back').click();
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 10_000 });

  /* breath: a derived breath-guide card plays the LennyStory scene */
  await page.locator('.zone-card[data-zone="breath-pool"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();
  await expect(page.locator('.shelf-card')).toHaveCount(18); /* 2 seed + 16 derived */
  await page.locator('.shelf-card[data-spec="breath-breath-guide-00"]').click();
  await expect(page.locator('#game-shelf')).toBeHidden();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('lenny-story');
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('breath-breath-guide-00');
  expect(errors).toEqual([]);
});

test('picking an open card swaps the game without leaving the zone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
    localStorage.setItem('lenny-game-finishes-v1', JSON.stringify({ 'attention-find-target-00': 3 }));
  }, UNLOCK_STREAM);
  await enterZone(page);

  await page.locator('#hud-shelf').click();
  await expect(page.locator('#game-shelf')).toBeVisible();
  await page.locator('.shelf-card[data-spec="attention-find-target-05"]').click();

  /* shelf closes, scene swaps in place, bridge follows the new spec */
  await expect(page.locator('#game-shelf')).toBeHidden();
  expect(await page.evaluate(() => window.__lenny?.spec())).toBe('attention-find-target-05');
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('glow-fish');
  await expect(page.locator('#hud-zone')).toHaveText(/נַחַל הַקֶּשֶׁב/);
  expect(errors).toEqual([]);
});
