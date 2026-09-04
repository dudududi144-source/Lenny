import { expect, test, type Page } from '@playwright/test';

/* The places beyond the path (critic round B, W1):
 *   - ninety-five landmarks exist, none found on a fresh garden (15-B)
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


/** Screen-delta steering: the fox's 8 walk directions ARE the eight
    screen directions (forward = ground below-center, strafe right =
    right of center), so the walker simply steers by the target's
    screen offset from the fox's own pixel — zero world-space math,
    zero camera conventions. A target behind the camera gets an orbit
    drag (with a flip-if-it-doesn't-help feedback loop). */
async function releaseWalkKeys(page: Page): Promise<void> {
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.up(k).catch(() => undefined);
  }
}

async function dragOrbit(page: Page, dir: number): Promise<void> {
  const box = await page.locator('.world-canvas').boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dir * (box.width * 0.4), cy, { steps: 9 });
  await page.mouse.up();
}

async function walkToWorld(page: Page, wx: number, wz: number, nearDist: number): Promise<void> {
  let orbitDir: number = 1;
  let orbitMiss = 0;
  let orbitBudget = 12;
  try {
    for (let round = 0; round < 260; round++) {
      const steer = await page.evaluate(([x, z]) => {
        const w = window.__lennyWorld!;
        const me = w.presencePos()!;
        const f = w.screenOf(me.x, me.z) ?? { x: 0.5, y: 0.55, on: true };
        const t = w.screenOf(x!, z!);
        if (!t) return null;
        return { on: t.on, dx: t.x - f.x, dy: t.y - f.y, dist: Math.hypot(x! - me.x, z! - me.z) };
      }, [wx, wz]);
      if (!steer) throw new Error('world bridge gone (screenOf null — the world closed?)');
      if (steer.dist <= nearDist) return;

      if ((!steer.on || Math.abs(steer.dx) > 0.45) && orbitBudget > 0) {
        /* behind the camera or far off to one side — orbit until it
           enters the frame; flip the direction if two drags did nothing.
           Bounded: a bounded orbit can never eat the whole clock. */
        await dragOrbit(page, orbitDir);
        orbitBudget -= 1;
        orbitMiss += 1;
        if (orbitMiss >= 2) {
          orbitDir = -orbitDir;
          orbitMiss = 0;
        }
        continue;
      }
      orbitMiss = 0;

      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        await page.keyboard.up(k).catch(() => undefined);
      }
      /* screen-down IS the ground ahead; screen-up is the far horizon —
         both mean "walk forward". Screen sides are the strafe keys. */
      if (steer.dx > 0.06) await page.keyboard.down('ArrowRight');
      else if (steer.dx < -0.06) await page.keyboard.down('ArrowLeft');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(360);
      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        await page.keyboard.up(k).catch(() => undefined);
      }
    }
    const end = await page.evaluate(() => {
      const w = window.__lennyWorld;
      return w ? { me: w.presencePos(), fps: Math.round(w.fps()), phase: w.phase?.() } : 'bridge-gone';
    });
    throw new Error(`never arrived near (${wx}, ${wz}) — fox at ${JSON.stringify(end)} after 260 rounds`);
  } finally {
    await releaseWalkKeys(page);
  }
}




test('ninety-five landmarks exist and a fresh garden has found none', async ({ page }) => {
  await openWorld(page);
  const landmarks = await page.evaluate(() => window.__lennyWorld?.landmarks());
  expect(landmarks!.length).toBe(95);
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
