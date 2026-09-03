import { expect, test, type Page } from '@playwright/test';

/* Stage 7, commit 3 — the child moves through the world:
 *   - a short tap walks the presence point there
 *   - a drag only orbits (the presence stays put)
 *   - proximity lights up nearZone through the bridge
 *   - a locked fog island repels the walk and whispers a toast
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
  /* the engine is ready when the bridge says so — never a fixed sleep */
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(500);
}

async function tapAt(page: Page, fx: number, fy: number): Promise<void> {
  const box = await page.locator('.world-canvas').boundingBox();
  const x = box!.x + box!.width * fx;
  const y = box!.y + box!.height * fy;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

test('a short tap walks the presence point to the grass', async ({ page }) => {
  await openWorld(page);

  const start = await page.evaluate(() => window.__lennyWorld?.presencePos());
  /* the journey starts ON light-path */
  const home = await page.evaluate(() => window.__lennyWorld?.zones());
  expect(home!.length).toBe(10);

  /* tap below the center — open grass toward the world center */
  await tapAt(page, 0.5, 0.72);

  await expect
    .poll(
      async () => {
        const p = await page.evaluate(() => window.__lennyWorld?.presencePos());
        return Math.hypot(p!.x - start!.x, p!.z - start!.z);
      },
      { timeout: 8000, intervals: [250] },
    )
    .toBeGreaterThan(0.35);
});

test('a drag only orbits — the presence never moves', async ({ page }) => {
  await openWorld(page);
  const start = await page.evaluate(() => window.__lennyWorld?.presencePos());

  const box = await page.locator('.world-canvas').boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 150, cy, { steps: 14 });
  await page.mouse.up();

  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__lennyWorld?.presencePos());
  expect(Math.hypot(after!.x - start!.x, after!.z - start!.z)).toBeLessThan(0.05);
});

test('standing at an island lights its nearZone; open grass clears it', async ({ page }) => {
  await openWorld(page);

  /* the journey starts at light-path — nearZone is already lit */
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.nearZone() ?? null)).toBe('light-path');

  /* tap far grass (top area of the screen maps away from the island) */
  await tapAt(page, 0.5, 0.06);
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.nearZone() ?? 'pending'), {
      timeout: 9000,
      intervals: [300],
    })
    .not.toBe('light-path');
});

test('a locked fog island repels the walk with a gentle toast', async ({ page }) => {
  await openWorld(page);

  test.setTimeout(90_000);
  /* stage 11: the garden is journey-scale — no fog island is visible
     from spawn. The child WALKS toward the nearest locked gate (the
     bridge's screenOf clamps off-screen targets, so the clamped
     fraction is the honest direction), then taps the island itself. */
  let toastSeen = false;
  for (let step = 0; step < 24 && !toastSeen; step++) {
    const target = await page.evaluate(() => {
      const w = window.__lennyWorld!;
      let best: { fx: number; fy: number; onScreen: boolean } | null = null;
      let bestD = Infinity;
      for (const z of w.zones().filter((q) => !q.unlocked)) {
        const s = w.screenOf(z.x, z.z)!;
        if (s.on && s.x > 0.06 && s.x < 0.94 && s.y > 0.14 && s.y < 0.78) {
          return { fx: s.x, fy: s.y, onScreen: true };
        }
        const d = Math.hypot(s.x - 0.5, s.y - 0.55);
        if (d < bestD) {
          bestD = d;
          best = {
            fx: Math.min(0.9, Math.max(0.1, s.x)),
            fy: Math.min(0.72, Math.max(0.3, s.y)),
            onScreen: false,
          };
        }
      }
      return best;
    });
    if (!target) break;
    await tapAt(page, target.fx, target.fy);
    await page.waitForTimeout(2400);
    if (target.onScreen) {
      toastSeen = await page.evaluate(() => {
        const el = document.getElementById('toast');
        return !!el && el.textContent.length > 0 && !el.classList.contains('hidden');
      });
    }
  }
  expect(toastSeen).toBe(true);
  /* the never-inside-the-fog invariant is pinned by the pure
     resolveWalkTarget unit tests — the bridge stays display-only */
});
