import { expect, test, type Page } from '@playwright/test';

/* Discovery quests (critic round B, W2/W7): roaming becomes measurable
 * practice — wayfinding (spatial), counting (cardinality), patterns
 * (seriation). The rotation is seeded so each test drives a KNOWN
 * family deterministically. A miss never punishes; completion is
 * stored honestly (no lights, no unlocks).
 */

interface Seed {
  wayfinding?: number;
  counting?: number;
  patterns?: number;
}

async function openWorldWithQuests(page: Page, seed: Seed): Promise<void> {
  await page.addInitScript((s: Seed) => {
    localStorage.setItem('lenny-garden-mode', 'world');
    localStorage.setItem('lenny-world-onboarded', '1');
    /* the minutes-long walkers hold the world open on perf distress
       (CI's software GL is the fallback's own intended target) */
    localStorage.setItem('lenny-world-hold', '1');
    localStorage.setItem('lenny-world-quests-v1', JSON.stringify({
      v: 2,
      families: {
        wayfinding: { completions: s.wayfinding ?? 0, trials: 0, corrections: 0, tier: 1 },
        counting: { completions: s.counting ?? 0, trials: 0, corrections: 0, tier: 1 },
        patterns: { completions: s.patterns ?? 0, trials: 0, corrections: 0, tier: 1 },
      },
      active: null,
      lastSeq: 0,
      days: {},
    }));
  }, seed);
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('.world-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  /* the first offer lands ~8s after exploring — poll, never sleep-guess */
  await page.waitForFunction(() => window.__lennyWorld?.quest() !== null, null, { timeout: 20000 });
}

async function tapAt(page: Page, fx: number, fy: number): Promise<void> {
  const box = await page.locator('.world-canvas').boundingBox();
  const x = box!.x + box!.width * fx;
  const y = box!.y + box!.height * fy;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
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



test('wayfinding: the child walks to the named place and the quest completes', async ({ page }) => {
  /* the errand stays child-sized (4–26u); CI's software-GL tap rounds
     are simply slow — the clock gets honest room, the walk does not */
  test.setTimeout(240_000);
  await openWorldWithQuests(page, { counting: 1, patterns: 1 });
  const q = await page.evaluate(() => window.__lennyWorld?.quest());
  expect(q!.family).toBe('wayfinding');
  expect(q!.target).toBeTruthy();

  const landmarks = await page.evaluate(() => window.__lennyWorld?.landmarks());
  const target = landmarks!.find((l) => l.id === q!.target)!;

  await walkToWorld(page, target.x, target.z, 1.9);

  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.quest()), { timeout: 6000 })
    .toBeNull();
  const stored = await page.evaluate(() => localStorage.getItem('lenny-world-quests-v1'));
  const parsed = JSON.parse(stored!) as { families: Record<string, { completions: number }> };
  expect(parsed.families.wayfinding.completions).toBe(1);
});

test('counting: tap every flower, then answer HOW MANY among chips', async ({ page }) => {
  await openWorldWithQuests(page, { wayfinding: 1 });
  const q = await page.evaluate(() => window.__lennyWorld?.quest());
  expect(q!.family).toBe('counting');
  const count = q!.count;
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(8);

  /* tap each bloomed flower — one-to-one correspondence */
  for (let i = 0; i < count; i++) {
    await expect
      .poll(() => page.evaluate((n) => window.__lennyWorld?.propScreen(`quest-flower-${n}`)?.on ?? false, i))
      .toBe(true);
    const s = await page.evaluate((n) => window.__lennyWorld?.propScreen(`quest-flower-${n}`), i);
    await tapAt(page, s!.x, s!.y);
    await page.waitForTimeout(220);
  }

  /* the answer chips appear — tap the true count */
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.quest()?.stage), { timeout: 5000 })
    .toBe('answering');
  await page.locator(`.world-quest-chips [data-count="${count}"]`).click();

  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.quest()), { timeout: 6000 })
    .toBeNull();
  const stored = await page.evaluate(() => localStorage.getItem('lenny-world-quests-v1'));
  const parsed = JSON.parse(stored!) as { families: Record<string, { completions: number }>; days: Record<string, { completed: number }> };
  expect(parsed.families.counting.completions).toBe(1);
  expect(Object.values(parsed.days).reduce((a, d) => a + d.completed, 0)).toBe(1);
});

test('counting: a wrong answer never punishes — the flowers rebloom for a recount', async ({ page }) => {
  await openWorldWithQuests(page, { wayfinding: 1 });
  const q = await page.evaluate(() => window.__lennyWorld?.quest());
  expect(q!.family).toBe('counting');
  const count = q!.count;

  for (let i = 0; i < count; i++) {
    const s = await page.evaluate((n) => window.__lennyWorld?.propScreen(`quest-flower-${n}`), i);
    await tapAt(page, s!.x, s!.y);
    await page.waitForTimeout(200);
  }
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.quest()?.stage)).toBe('answering');

  /* tap a wrong chip (the count-1 chip when valid, else count+1) */
  const wrong = count > 3 ? count - 1 : count + 1;
  await page.locator(`.world-quest-chips [data-count="${wrong}"]`).click();

  /* back to counting stage — recount from zero, still no completion */
  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.quest()?.stage), { timeout: 5000 })
    .toBe('counting');
  const after = await page.evaluate(() => window.__lennyWorld?.quest());
  expect(after!.picked).toBe(0);
  const stored = await page.evaluate(() => localStorage.getItem('lenny-world-quests-v1'));
  const parsed = JSON.parse(stored!) as { families: Record<string, { completions: number; corrections: number }> };
  expect(parsed.families.counting.completions).toBe(0);
  expect(parsed.families.counting.corrections).toBe(1);
});

test('patterns: the child continues the stone sequence with color chips', async ({ page }) => {
  await openWorldWithQuests(page, { wayfinding: 1, counting: 1 });
  const q = await page.evaluate(() => window.__lennyWorld?.quest());
  expect(q!.family).toBe('patterns');
  expect(q!.answer).toBeTruthy();

  await page.locator(`.world-quest-chips [data-color="${q!.answer}"]`).click();

  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.quest()), { timeout: 6000 })
    .toBeNull();
  const stored = await page.evaluate(() => localStorage.getItem('lenny-world-quests-v1'));
  const parsed = JSON.parse(stored!) as { families: Record<string, { completions: number }> };
  expect(parsed.families.patterns.completions).toBe(1);
});

test('a quest can be ignored for free — "אַחֲרֵי כָּךְ" ends it with no record', async ({ page }) => {
  await openWorldWithQuests(page, { counting: 1, patterns: 1 });
  expect(await page.evaluate(() => window.__lennyWorld?.quest())).not.toBeNull();

  await page.locator('#world-quest-later').click();

  await expect
    .poll(() => page.evaluate(() => window.__lennyWorld?.quest()), { timeout: 6000 })
    .toBeNull();
  await expect(page.locator('#world-quest')).toBeHidden();
  const stored = await page.evaluate(() => localStorage.getItem('lenny-world-quests-v1'));
  const parsed = JSON.parse(stored!) as { families: Record<string, { completions: number }> };
  /* the deferred family (wayfinding) stays at its seeded zero */
  expect(parsed.families.wayfinding.completions).toBe(0);
});
