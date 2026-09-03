import { expect, test } from '@playwright/test';

const UNLOCK_STREAM = {
  firstSeen: Date.now(),
  lights: 2,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
  },
};

test('zone click boots the Pixi canvas with HUD, dialogue and no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="attention-stream"]').click();

  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect(page.locator('#hud-zone')).toHaveText(/נַחַל הַקֶּשֶׁב/);

  const info = await page.evaluate(() => ({
    renderer: window.__lenny?.renderer(),
    scene: window.__lenny?.scene(),
    screen: window.__lenny?.screen(),
    design: window.__lenny?.design,
  }));
  expect(info.scene).toBe('glow-fish');
  expect(['webgl', 'webgpu']).toContain(info.renderer);
  expect(info.screen).toBe('game');
  /* Arena world space: always covers the canvas; width matches the
     420 reference when the viewport is portrait (CI is 375x667). */
  expect(info.design!.w).toBeGreaterThanOrEqual(420);
  expect(info.design!.h).toBeGreaterThanOrEqual(720);

  await expect(page.locator('#hud-dialogue .dialogue-text')).not.toBeEmpty();

  /* back returns to the garden, canvas is torn down */
  await page.locator('#game-back').click();
  await expect(page.locator('#garden-screen')).toBeVisible();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBeNull();
  expect(errors).toEqual([]);
});

test('pointer input lands in design space (breath-pool lantern)', async ({ page }) => {
  /* every zone now boots a real scene; a real mouse click on a lantern's
     design-space position must light it — end-to-end pointer remap proof */
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="breath-pool"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('lenny-story');

  const lantern = (await page.evaluate(
    () => (window.__lenny?.sceneState() as { lanterns: Array<{ x: number; y: number }> } | null),
  ))!.lanterns[0];

  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  const design = await page.evaluate(() => window.__lenny?.design);
  await page.mouse.click(
    rect!.x + (lantern.x / design!.w) * rect!.width,
    rect!.y + (lantern.y / design!.h) * rect!.height,
  );
  await page.waitForTimeout(400);

  const after = await page.evaluate(
    () => (window.__lenny?.sceneState() as { lit: number } | null),
  );
  expect(after?.lit).toBe(1);
  expect(errors).toEqual([]);
});

test('locked zone never opens a canvas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#toast')).toContainText('עוֹד קְצָת');
  await expect(page.locator('#game-screen')).toBeHidden();
  expect(await page.locator('#game-screen canvas').count()).toBe(0);
});

test('Arena HUD: pause freezes the scene, mute persists, session state flows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, UNLOCK_STREAM);

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="attention-stream"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => window.__lenny?.sceneState()))?.fishCount ?? 0, { timeout: 10_000 }).toBeGreaterThan(0);

  /* pause button is Arena-enabled by default */
  await expect(page.locator('#hud-pause')).toBeVisible();
  const fishBefore = (await page.evaluate(() => window.__lenny?.sceneState()))!.fishCount;
  await page.locator('#hud-pause').click();
  await expect(page.locator('#hud-pause-overlay')).toBeVisible();
  await page.waitForTimeout(700);
  const fishPaused = (await page.evaluate(() => window.__lenny?.sceneState()))!.fishCount;
  expect(fishPaused).toBe(fishBefore); /* frozen: no spawns/despawns while paused */

  await page.locator('#pause-resume').click();
  await expect(page.locator('#hud-pause-overlay')).toBeHidden();

  /* mute toggles + persists (ETHICS §9: the app starts SILENT — first
     explicit tap turns sound ON, the next turns it back off) */
  await page.locator('#hud-mute').click();
  expect(await page.evaluate(() => localStorage.getItem('lenny-muted'))).toBe('0');
  await page.locator('#hud-mute').click();
  expect(await page.evaluate(() => localStorage.getItem('lenny-muted'))).toBe('1');

  /* session debug flows through the bridge (arena-prefixed keys) */
  const session = await page.evaluate(() => window.__lenny?.sceneState());
  expect(session).toHaveProperty('arenaScore');
  expect(session).toHaveProperty('ceremonyOpen');
  expect(errors).toEqual([]);
});
