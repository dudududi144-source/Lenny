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
  let orbitBudget = 16;
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

      /* orbit ONLY when the target is truly off-screen — when it is
         on the frame the child simply walks at it (camera-follow
         closes the angle; orbiting a visible target just churns) */
      if (!steer.on && orbitBudget > 0) {
        /* behind the camera or far off to one side — orbit until it
           enters the frame; flip the direction if two drags did nothing.
           Bounded: a bounded orbit can never eat the whole clock. */
        await dragOrbit(page, orbitDir);
        orbitBudget -= 1;
        orbitMiss += 1;
        /* a target behind the camera needs THREE-FOUR same-direction
           drags — flipping after two just undoes the yaw (the
           stage-15 continent churned here). Flip only after six. */
        if (orbitMiss >= 6) {
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
      /* short steps when close — a 360ms hold at 20fps overshoots the ring and the fox never reads as arrived */
      await page.waitForTimeout(Math.round(Math.min(360, Math.max(120, steer.dist * 80))));
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

  /* stop ON the discovery ring (keep + 0.75 — inside the world's own keep+0.8 discovery band): the exact center sits in the rim-slide zone where high-fps steps overshoot */
  await walkToWorld(page, target.x, target.z, target.keep + 0.75);

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
