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
  expect(info.design).toEqual({ w: 420, h: 720 });

  await expect(page.locator('#hud-dialogue .dialogue-text')).not.toBeEmpty();

  /* back returns to the garden, canvas is torn down */
  await page.locator('#game-back').click();
  await expect(page.locator('#garden-screen')).toBeVisible();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBeNull();
  expect(errors).toEqual([]);
});

test('tap on the canvas lands in design space and registers', async ({ page }) => {
  /* memory-hill still maps to the placeholder scene — its taps counter
     proves the pointer remapping pipeline end to end */
  await page.addInitScript((state) => {
    localStorage.setItem('lenny-garden', JSON.stringify(state));
  }, {
    firstSeen: Date.now(),
    lights: 1,
    zones: { 'light-path': { finished: 1, unlocked: true } },
  });

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  expect(await page.evaluate(() => window.__lenny?.scene())).toBe('coming-soon');

  const rect = await page.evaluate(() => window.__lenny?.canvasRect());
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.waitForTimeout(150);

  const state = await page.evaluate(() => window.__lenny?.sceneState());
  expect(state && (state as { taps?: number }).taps).toBe(1);
});

test('locked zone never opens a canvas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="memory-hill"]').click();
  await expect(page.locator('#toast')).toContainText('עוֹד קְצָת');
  await expect(page.locator('#game-screen')).toBeHidden();
  expect(await page.locator('#game-screen canvas').count()).toBe(0);
});
