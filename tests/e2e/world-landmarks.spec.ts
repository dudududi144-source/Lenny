import { expect, test, type Page } from '@playwright/test';

/* The places beyond the path (critic round B, W1):
 *   - sixteen landmarks exist, none found on a fresh garden (stage 11)
 *   - walking close to one discovers it: narration + persistent found
 *   - the name plate (environmental print) shows after discovery
 *   - discovery survives a reload (lenny-world-found-v1)
 *
 * All reads go through window.__lennyWorld — never pixels.
 */

async function openWorld(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(400);
}

async function tapAt(page: Page, fx: number, fy: number): Promise<void> {
  const box = await page.locator('.world-canvas').boundingBox();
  const x = box!.x + box!.width * fx;
  const y = box!.y + box!.height * fy;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

async function closeShelfIfOpen(page: Page): Promise<void> {
  const shelf = page.locator('#world-shelf:not(.hidden)');
  if (await shelf.isVisible().catch(() => false)) {
    await page.locator('#world-shelf-close').click();
    await expect(shelf).toBeHidden();
  }
  /* the discovery-quest offer may land mid-walk; deferring it is free
     by design ("אַחֲרֵי כָּךְ") and keeps the tap band clear */
  const later = page.locator('#world-quest-later');
  if (await later.isVisible().catch(() => false)) {
    await later.click();
    await expect(page.locator('#world-quest')).toBeHidden();
  }
}

/** Walk the presence toward a world point using only bridge projections. */
async function walkToWorld(page: Page, wx: number, wz: number, nearDist: number): Promise<void> {
  for (let i = 0; i < 90; i++) {
    await closeShelfIfOpen(page);
    const p = await page.evaluate(() => window.__lennyWorld?.presencePos());
    if (p && Math.hypot(p.x - wx, p.z - wz) <= nearDist) return;
    /* stage 11: a far place is OFF-SCREEN — sample the bearing line
       for the first visible stretch of ground and tap that (the way a
       child walks toward somewhere past the horizon) */
    const spot = await page.evaluate(([x, z]) => {
      const w = window.__lennyWorld!;
      const me = w.presencePos()!;
      const s = w.screenOf(x!, z!)!;
      if (s.on) return { fx: s.x, fy: s.y };
      const dx = x! - me.x;
      const dz = z! - me.z;
      const len = Math.hypot(dx, dz) || 1;
      for (const k of [3, 5, 8, 12, 17, 23, 30]) {
        const probe = w.screenOf(me.x + (dx / len) * k, me.z + (dz / len) * k);
        if (probe && probe.on) return { fx: probe.x, fy: probe.y };
      }
      return null;
    }, [wx, wz]);
    if (!spot) throw new Error('no visible ground toward the place');
    /* clamp into the open middle band — away from header, shelf, quest panel */
    const fx = Math.min(0.78, Math.max(0.22, spot.fx));
    const fy = Math.min(0.72, Math.max(0.32, spot.fy));
    await tapAt(page, fx, fy);
    await page.waitForTimeout(650);
  }
  throw new Error(`never arrived near (${wx}, ${wz})`);
}

test('twenty-four landmarks exist and a fresh garden has found none', async ({ page }) => {
  await openWorld(page);
  const landmarks = await page.evaluate(() => window.__lennyWorld?.landmarks());
  expect(landmarks!.length).toBe(24);
  expect(landmarks!.every((l) => !l.found)).toBe(true);
  expect(await page.evaluate(() => window.__lennyWorld?.foundCount())).toBe(0);
});

test('walking to a landmark discovers it — narration, plate, persistence', async ({ page }) => {
  test.setTimeout(75_000); /* stage 11: places are worth a real walk now */
  await openWorld(page);
  const target = (await page.evaluate(() => window.__lennyWorld?.landmarks()))!.find(
    (l) => l.id === 'big-tree',
  )!;
  expect(target.found).toBe(false);

  await walkToWorld(page, target.x, target.z, 1.9);

  /* the bridge flips, the chip counts, and storage remembers */
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.foundCount()), { timeout: 5000 })
    .toBe(1);
  const stored = await page.evaluate(() => localStorage.getItem('lenny-world-found-v1'));
  expect(stored).toContain('big-tree');

  /* the name plate — environmental print the child can read */
  const plate = page.locator('#landmark-plate-big-tree');
  await expect(plate).toBeVisible();
  await expect(plate).toContainText('הָעֵץ הַגָּדוֹל');
});

test('discovery survives a reload — the world remembers what the child knows', async ({ page }) => {
  await openWorld(page);
  await page.evaluate(() => {
    localStorage.setItem('lenny-world-found-v1', JSON.stringify(['pond', 'beehive']));
  });
  await page.reload();
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.foundCount()), { timeout: 5000 })
    .toBe(2);
  const landmarks = await page.evaluate(() => window.__lennyWorld?.landmarks());
  expect(landmarks!.find((l) => l.id === 'pond')!.found).toBe(true);
  expect(landmarks!.find((l) => l.id === 'beehive')!.found).toBe(true);
  expect(landmarks!.find((l) => l.id === 'big-tree')!.found).toBe(false);
});
