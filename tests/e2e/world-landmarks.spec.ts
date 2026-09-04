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
    /* the minutes-long walkers hold the world open on perf distress
       (CI's software GL is the fallback's own intended target) */
    localStorage.setItem('lenny-world-hold', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await page.waitForTimeout(400);
}


/** Keyboard steering: the fox walks camera-relative, so the walker
    steers by the target's SCREEN X (left/right keys + forward) — no
    canvas taps, no pick rays, no overlay races. This is how a child
    with arrows walks, and it survives CI's slow software GL. */
async function releaseWalkKeys(page: Page): Promise<void> {
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.up(k).catch(() => undefined);
  }
}

async function walkToWorld(page: Page, wx: number, wz: number, nearDist: number): Promise<void> {
  let lastTurn: 'left' | 'right' = 'right';
  try {
    for (let i = 0; i < 300; i++) {
      const p = await page.evaluate(() => window.__lennyWorld?.presencePos());
      if (p && Math.hypot(p.x - wx, p.z - wz) <= nearDist) return;
      const steer = await page.evaluate(([x, z]) => {
        const w = window.__lennyWorld!;
        const s = w.screenOf(x!, z!);
        if (!s) return null;
        if (!s.on) return { turn: 'spin' as const, fx: s.x };
        return { turn: s.x > 0.6 ? ('right' as const) : s.x < 0.4 ? ('left' as const) : ('none' as const), fx: s.x };
      }, [wx, wz]);
      if (!steer) throw new Error('world bridge gone (screenOf null — the world closed?)');
      if (steer.turn === 'spin') {
        /* the place is behind the camera — keep spinning one way until
           it re-enters the frame (persisted so we never dither) */
        await page.keyboard.down(lastTurn === 'right' ? 'ArrowRight' : 'ArrowLeft');
        await page.keyboard.up('ArrowUp');
        await page.waitForTimeout(320);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.up('ArrowRight');
        continue;
      }
      if (steer.turn !== 'none') lastTurn = steer.turn;
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
      if (steer.turn === 'left') await page.keyboard.down('ArrowLeft');
      if (steer.turn === 'right') await page.keyboard.down('ArrowRight');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(340);
      await page.keyboard.up('ArrowUp');
    }
    const end = await page.evaluate(() => {
        const w = window.__lennyWorld;
        return w ? { me: w.presencePos(), fps: Math.round(w.fps()), phase: w.phase?.() } : 'bridge-gone';
      });
      throw new Error(`never arrived near (${wx}, ${wz}) — fox at ${JSON.stringify(end)} after ${i} rounds`);
  } finally {
    await releaseWalkKeys(page);
  }
}


test('fifty landmarks exist and a fresh garden has found none', async ({ page }) => {
  await openWorld(page);
  const landmarks = await page.evaluate(() => window.__lennyWorld?.landmarks());
  expect(landmarks!.length).toBe(50);
  expect(landmarks!.every((l) => !l.found)).toBe(true);
  expect(await page.evaluate(() => window.__lennyWorld?.foundCount())).toBe(0);
});

test('walking to a landmark discovers it — narration, plate, persistence', async ({ page }) => {
  /* stage 14: the continent is vast and CI's software-GL rounds are
     slow — the walk is still short (big-tree is near the spawn), the
     CLOCK is what needed honest room */
  test.setTimeout(180_000);
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
