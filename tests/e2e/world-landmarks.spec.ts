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


/** Compass steering: the walker never guesses the camera. Each round
    it probes eight WORLD directions through the bridge — the one that
    projects at screen-center IS the camera's forward — then presses
    the key combo whose angle best matches the bearing to the target.
    No taps, no rays, no dithering, no spin state. */
const WALK_DIRS: Array<{ keys: string[]; a: number }> = [
  { keys: ['ArrowUp'], a: 0 },
  { keys: ['ArrowUp', 'ArrowRight'], a: Math.PI / 4 },
  { keys: ['ArrowRight'], a: Math.PI / 2 },
  { keys: ['ArrowDown', 'ArrowRight'], a: (3 * Math.PI) / 4 },
  { keys: ['ArrowDown'], a: Math.PI },
  { keys: ['ArrowDown', 'ArrowLeft'], a: (-3 * Math.PI) / 4 },
  { keys: ['ArrowLeft'], a: -Math.PI / 2 },
  { keys: ['ArrowUp', 'ArrowLeft'], a: -Math.PI / 4 },
];

async function releaseWalkKeys(page: Page): Promise<void> {
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.up(k).catch(() => undefined);
  }
}

async function walkToWorld(page: Page, wx: number, wz: number, nearDist: number): Promise<void> {
  let stuck = 0;
  let lastX = NaN;
  let lastZ = NaN;
  try {
    for (let round = 0; round < 300; round++) {
      const step = await page.evaluate(([x, z]) => {
        const w = window.__lennyWorld!;
        const me = w.presencePos()!;
        /* the bearing to the target, world-space */
        const bt = Math.atan2(x! - me.x, z! - me.z);
        /* probe eight world directions — the one projecting nearest the
           screen center is the camera's forward */
        let bestA = 0;
        let bestScore = Infinity;
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const pr = w.screenOf(me.x + Math.sin(a) * 4, me.z + Math.cos(a) * 4);
          if (!pr || !pr.on) continue;
          const score = Math.abs(pr.x - 0.5) + Math.abs(pr.y - 0.6) * 0.4;
          if (score < bestScore) {
            bestScore = score;
            bestA = a;
          }
        }
        /* the relative angle target-vs-forward, quantized to 45° */
        let d = bt - bestA;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const idx = Math.round(d / (Math.PI / 4));
        const dir = WALK_DIRS[((idx % 8) + 8) % 8];
        return { keys: dir.keys, dist: Math.hypot(x! - me.x, z! - me.z) };
      }, [wx, wz]);
      if (!step) throw new Error('world bridge gone (screenOf null — the world closed?)');
      if (step.dist <= nearDist) return;
      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        await page.keyboard.up(k).catch(() => undefined);
      }
      for (const k of step.keys) await page.keyboard.down(k);
      await page.waitForTimeout(360);
      for (const k of step.keys) await page.keyboard.up(k);
      /* a shelf or a surface can swallow the keys — Escape reclaims them */
      const now = await page.evaluate(() => window.__lennyWorld?.presencePos());
      if (now && Math.hypot(now.x - lastX, now.z - lastZ) < 0.15) {
        stuck += 1;
        if (stuck >= 3) {
          stuck = 0;
          await page.keyboard.press('Escape').catch(() => undefined);
        }
      } else {
        stuck = 0;
      }
      if (now) {
        lastX = now.x;
        lastZ = now.z;
      }
    }
    const end = await page.evaluate(() => {
      const w = window.__lennyWorld;
      return w ? { me: w.presencePos(), fps: Math.round(w.fps()), phase: w.phase?.() } : 'bridge-gone';
    });
    throw new Error(`never arrived near (${wx}, ${wz}) — fox at ${JSON.stringify(end)} after 300 rounds`);
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
