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

async function closeShelfIfOpen(page: Page): Promise<void> {
  const shelf = page.locator('#world-shelf:not(.hidden)');
  if (await shelf.isVisible().catch(() => false)) {
    await page.locator('#world-shelf-close').click();
    await expect(shelf).toBeHidden();
  }
}


/** Wait until the fox finishes her current errand — a moving fox can
    never be "within 1.9" of anywhere (CI's slow rounds re-aim her
    mid-stride forever). Mirrors the pad walkers' settle discipline. */
async function settleWalker(page: Page): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const busy = await page.evaluate(() => window.__lennyWorld?.errand?.() != null);
    if (!busy) return;
    await page.waitForTimeout(400);
  }
}

async function walkToWorld(page: Page, wx: number, wz: number, nearDist: number): Promise<void> {
  for (let i = 0; i < 150; i++) {
    await closeShelfIfOpen(page);
    await settleWalker(page);
    const p = await page.evaluate(() => window.__lennyWorld?.presencePos());
    if (p && Math.hypot(p.x - wx, p.z - wz) <= nearDist) return;
    /* stage 11: the world is journey-scale — a far errand is OFF-SCREEN.
       A child walks toward it anyway: sample the bearing line for the
       first stretch of ground that IS visible, and tap that. */
    const spot = await page.evaluate(([x, z]) => {
      const w = window.__lennyWorld!;
      const me = w.presencePos()!;
      const s = w.screenOf(x!, z!)!;
      if (s.on && (s.x > 0.03 || s.x < 0.97) && s.y > 0.02) return { fx: s.x, fy: s.y };
      const dx = x! - me.x;
      const dz = z! - me.z;
      const len = Math.hypot(dx, dz) || 1;
      for (const k of [3, 5, 8, 12, 17, 23, 30]) {
        const probe = w.screenOf(me.x + (dx / len) * k, me.z + (dz / len) * k);
        if (probe && probe.on) return { fx: probe.x, fy: probe.y };
      }
      return null;
    }, [wx, wz]);
    if (!spot) throw new Error('no visible ground toward the errand');
    /* the stage-14 camera keeps its visible ground in the UPPER band —
       a tap clamped to mid-screen lands ON the fox (a no-op step) */
    const fx = Math.min(0.78, Math.max(0.22, spot.fx));
    const fy = Math.min(0.34, Math.max(0.10, spot.fy));
    await tapAt(page, fx, fy);
    await page.waitForTimeout(650);
  }
  throw new Error(`never arrived near (${wx}, ${wz})`);
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
