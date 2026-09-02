import { expect, test } from '@playwright/test';

/* Stage 7, commit 1 — the world's render foundation:
 *   - classic stays the untouched default (lazy: no Babylon bytes)
 *   - mode=world boots the engine, the bridge reports honestly
 *   - the canvas follows resizes
 *   - open → hero → open again (clean dispose + re-boot)
 */

test('classic is the default garden and never loads the world', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('#garden-screen')).toBeVisible();
  await expect(page.locator('#world-screen')).toBeHidden();
  await expect(page.locator('.world-canvas')).toHaveCount(0);
  /* the bridge exists but tells the truth: nothing is running */
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.phase() ?? 'missing'))
    .toBe('closed');
  expect(errors).toEqual([]);
});

test('mode=world boots the 3D garden with a live renderer and a clean bridge', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();

  await expect(page.locator('#world-screen')).toBeVisible();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });

  const state = await page.evaluate(() => ({
    phase: window.__lennyWorld?.phase(),
    renderer: window.__lennyWorld?.renderer(),
    fps: window.__lennyWorld?.fps(),
    zones: window.__lennyWorld?.zones().length,
  }));
  expect(state.phase).toBe('exploring');
  expect(['webgl2', 'webgpu']).toContain(state.renderer);
  expect(state.fps).toBeGreaterThan(0);
  expect(state.zones).toBe(10); /* the ten zone islands (commit 2) */

  /* the loading veil is gone */
  await expect(page.locator('#world-loading')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the world canvas follows viewport resizes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });

  const before = await page.evaluate(() => {
    const c = document.querySelector('.world-canvas') as HTMLCanvasElement;
    return { w: c.clientWidth, h: c.clientHeight };
  });
  await page.setViewportSize({ width: 620, height: 860 });
  await page.waitForTimeout(350); /* resize observer + engine.resize */
  const after = await page.evaluate(() => {
    const c = document.querySelector('.world-canvas') as HTMLCanvasElement;
    return { w: c.clientWidth, h: c.clientHeight };
  });
  expect(after.w).toBeGreaterThan(before.w);
  expect(after.h).toBeGreaterThan(before.h);
});

test('open → hero → open again re-boots the world cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });

  await page.locator('#world-back').click();
  await expect(page.locator('#hero-screen')).toBeVisible();
  /* leaving disposes the engine — the canvas is gone */
  await expect(page.locator('.world-canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.phase() ?? 'missing')).toBe('closed');

  /* second open boots a fresh engine */
  await page.getByRole('button', { name: /נַתְחִיל|לְהַמְשֵׁךְ/ }).first().click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.phase() ?? 'missing')).toBe('exploring');
  expect(errors).toEqual([]);
});
