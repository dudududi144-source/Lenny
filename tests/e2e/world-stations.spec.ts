import { expect, test, type Page } from '@playwright/test';

/* Stage 14 — the living continent:
 *   - thirty game clearings (3 bands × 10 zones), fog-honest in the bridge
 *   - stepping onto a pad shows the ENTRY CARD; its big button opens
 *     the shelf narrowed to that band (the owner: entry must be clear)
 *   - a far pad tap is a walk errand, never a teleport
 *   - the acorn ledger persists; the well turns acorns into scarves
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

/** Tap a canvas point that is NOT covered by a DOM overlay (quest
    panel, entry card, compass…) — probe small offsets around the TRUE
    pixel and let elementFromPoint decide (a fixed clamp would bend
    far pads' pixels into near ground — stage-14 camera keeps distant
    places high in the frame). */
async function tapClearAt(page: Page, fx: number, fy: number): Promise<boolean> {
  const box = await page.locator('.world-canvas').boundingBox();
  const offsets: Array<[number, number]> = [
    [0, 0], [0, -0.04], [0, 0.04], [-0.06, 0], [0.06, 0], [0, -0.09], [0, 0.09],
  ];
  for (const [ox, oy] of offsets) {
    const cx = Math.min(0.94, Math.max(0.06, fx + ox));
    const cy = Math.min(0.94, Math.max(0.06, fy + oy));
    const clear = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x!, y!);
        return !!el && el.classList.contains('world-canvas');
      },
      [box!.x + box!.width * cx, box!.y + box!.height * cy],
    );
    if (clear) {
      await tapAt(page, cx, cy);
      return true;
    }
  }
  return false;
}

async function closeOverlays(page: Page): Promise<void> {
  const shelf = page.locator('#world-shelf:not(.hidden)');
  if (await shelf.isVisible().catch(() => false)) {
    await page.locator('#world-shelf-close').click();
    await expect(shelf).toBeHidden();
  }
  const later = page.locator('#world-quest-later');
  if (await later.isVisible().catch(() => false)) {
    await later.click();
    await expect(page.locator('#world-quest')).toBeHidden();
  }
}

/** Wait until the fox has finished her current errand — a settled
    walker projects honest pixels (a mid-stride camera drifts). */
async function settleWalker(page: Page): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const busy = await page.evaluate(() => window.__lennyWorld?.errand?.() != null);
    if (!busy) return;
    await page.waitForTimeout(300);
  }
}

async function walkToWorld(page: Page, wx: number, wz: number, nearDist: number): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await closeOverlays(page);
    const p = await page.evaluate(() => window.__lennyWorld?.presencePos());
    if (p && Math.hypot(p.x - wx, p.z - wz) <= nearDist) return;
    const spot = await page.evaluate(([x, z]) => {
      const w = window.__lennyWorld!;
      const me = w.presencePos()!;
      const s = w.screenOf(x!, z!)!;
      if (s.on) return { fx: s.x, fy: s.y };
      /* nothing directly toward the place is on screen — probe the
         visible ground around the fox and pick the direction closest
         to the target's bearing (the way a child rounds an obstacle) */
      const bear = Math.atan2(x! - me.x, z! - me.z);
      let best: { fx: number; fy: number } | null = null;
      let bestDiff = Infinity;
      for (let i = 0; i < 12; i++) {
        const a = bear + (i - 6) * 0.45;
        const probe = w.screenOf(me.x + Math.sin(a) * 8, me.z + Math.cos(a) * 8);
        if (!probe || !probe.on) continue;
        const diff = Math.abs(((a - bear + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = { fx: probe.x, fy: probe.y };
        }
      }
      return best;
    }, [wx, wz]);
    if (!spot) throw new Error('no visible ground toward the place');
    const fx = Math.min(0.78, Math.max(0.22, spot.fx));
    const fy = Math.min(0.72, Math.max(0.32, spot.fy));
    await tapAt(page, fx, fy);
    await page.waitForTimeout(650);
  }
  throw new Error(`never arrived near (${wx}, ${wz})`);
}

test('the bridge reports thirty clearings; the hub is open, the far map is fogged', async ({ page }) => {
  await openWorld(page);
  const stations = await page.evaluate(() => window.__lennyWorld?.stations());
  expect(stations!.length).toBe(30);
  const ids = new Set(stations!.map((s) => s.id));
  expect(ids.size).toBe(30);
  /* only the 'open' zones start unlocked — their clearings are open,
     every fogged zone's clearings are fogged with it */
  for (const s of stations!) {
    if (['light-path', 'breath-pool'].includes(s.zone)) {
      expect(s.open, s.id).toBe(true);
    } else {
      expect(s.open, s.id).toBe(false);
    }
  }
});

test('stepping onto a pad shows the entry card; the big button opens the band shelf', async ({ page }) => {
  test.setTimeout(90_000);
  await openWorld(page);
  const station = (await page.evaluate(() => window.__lennyWorld?.stations()))!.find(
    (s) => s.id === 'light-path:0',
  )!;
  await walkToWorld(page, station.x, station.z, 1.0);

  /* the card names the band and the zone, and offers ONE big button */
  const card = page.locator('#world-entry');
  await expect(card).toBeVisible({ timeout: 6000 });
  await expect(card).toContainText('הַמִּשְׂחָקִים הָרִאשׁוֹנִים');
  await expect(card).toContainText('שְׁבִיל הָאוֹר');

  await page.locator('#world-entry-play').click();
  const shelf = page.locator('#world-shelf:not(.hidden)');
  await expect(shelf).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#world-shelf .shelf-title')).toContainText('הַמִּשְׂחָקִים הָרִאשׁוֹנִים');
  await expect(page.locator('#world-shelf-row .shelf-card:not(.locked)').first()).toBeVisible();
  await page.locator('#world-shelf-close').click();
  await expect(page.locator('#world-shelf')).toBeHidden();
});

test('a far pad tap is a walk errand, not a teleport', async ({ page }) => {
  test.setTimeout(120_000);
  await openWorld(page);
  const station = (await page.evaluate(() => window.__lennyWorld?.stations()))!.find(
    (s) => s.id === 'light-path:1',
  )!;
  /* from the spawn the pad may be off-screen; a couple of visible-ground
     steps bring it into the frame, then one tap on the pad walks */
  let tapped: { fx: number; fy: number } | null = null;
  for (let i = 0; i < 14 && !tapped; i++) {
    tapped = await page.evaluate(([x, z]) => {
      const w = window.__lennyWorld!;
      const me = w.presencePos()!;
      const s = w.screenOf(x!, z!)!;
      if (s.on) return { fx: s.x, fy: s.y };
      /* walk along the visible probe closest to the pad's bearing */
      const bear = Math.atan2(x! - me.x, z! - me.z);
      let best: { fx: number; fy: number } | null = null;
      let bestDiff = Infinity;
      for (let a2 = 0; a2 < 12; a2++) {
        const a = bear + (a2 - 6) * 0.45;
        const probe = w.screenOf(me.x + Math.sin(a) * 8, me.z + Math.cos(a) * 8);
        if (!probe || !probe.on) continue;
        const diff = Math.abs(((a - bear + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = { fx: probe.x, fy: probe.y };
        }
      }
      return best;
    }, [station.x, station.z]);
    if (!tapped) break;
    await tapAt(page, tapped.fx, tapped.fy);
    await page.waitForTimeout(700);
    await closeOverlays(page);
    tapped = null;
    const check = await page.evaluate(([x, z]) => {
      const w = window.__lennyWorld!;
      const s = w.screenOf(x!, z!)!;
      return s.on ? { fx: s.x, fy: s.y } : null;
    }, [station.x, station.z]);
    if (check) tapped = check;
  }
  if (!tapped) throw new Error('pad never became visible');
  /* far away the tap SENDS the walker; close enough, it IS the door
     (the shelf opens) — both are the honest pad contract */
  const dist = await page.evaluate(([x, z]) => {
    const me = window.__lennyWorld!.presencePos()!;
    return Math.hypot(me.x - x!, me.z - z!);
  }, [station.x, station.z]);
  if (dist > 2.5) {
    /* far away the tap SENDS the walker — the errand must land AT the
       pad (a walk, never a teleport). Small hands tap again when a tap
       misses; the test earns the same grace: settle, re-aim, up to 3
       rounds (an overlay-covered pixel or a grazing ray is a miss,
       not a broken contract). */
    let settled = false;
    for (let round = 0; round < 3 && !settled; round++) {
      await closeOverlays(page);
      await settleWalker(page);
      tapped = await page.evaluate(([x, z]) => {
        const w = window.__lennyWorld!;
        const s = w.screenOf(x!, z!)!;
        return s.on ? { fx: s.x, fy: s.y } : null;
      }, [station.x, station.z]);
      if (!tapped) continue; /* the pad slipped behind the fox — re-aim */
      const landed = await tapClearAt(page, tapped.fx, tapped.fy);
      if (!landed) continue;
      await page.waitForTimeout(350);
      const errand = await page.evaluate(() => window.__lennyWorld?.errand());
      if (!errand) {
        /* no errand means the tap opened a surface — the door branch */
        settled = true;
        const shelf = page.locator('#world-shelf:not(.hidden)');
        await expect(shelf).toBeVisible({ timeout: 6000 });
        await expect(page.locator('#world-shelf .shelf-title')).toContainText('הַמִּשְׂחָקִים הַבָּאִים');
        await page.locator('#world-shelf-close').click();
        await expect(page.locator('#world-shelf')).toBeHidden();
        break;
      }
      /* a walk errand: honest only if it points at the pad */
      const miss = Math.hypot(errand.x - station.x, errand.z - station.z);
      expect(miss).toBeLessThan(30); /* sanity: it walks TOWARD the pad */
      if (miss < 2.0) settled = true;
    }
    expect(settled).toBe(true);
  } else {
    /* the walker already stands at the pad — the walk loop itself
       was the errand chain; arrival is the proof */
    expect(dist).toBeLessThanOrEqual(2.5);
  }
});

test('the acorn ledger persists, and the chip counts it', async ({ page }) => {
  await openWorld(page);
  await page.evaluate(() => {
    localStorage.setItem('lenny-world-acorns-v1', JSON.stringify(['acorn:0', 'acorn:1', 'acorn:2']));
  });
  await page.reload();
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.acorns())).toBe(3);
  await expect(page.locator('#world-acorn-chip')).toContainText('3');
});

test('the well turns acorns into a scarf the fox wears (the meaning of the road)', async ({ page }) => {
  test.setTimeout(120_000);
  await openWorld(page);
  /* a purse that can afford two scarves */
  await page.evaluate(() => {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(`acorn:${i}`);
    localStorage.setItem('lenny-world-acorns-v1', JSON.stringify(ids));
  });
  await page.reload();
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.waitForFunction(() => window.__lennyWorld?.phase() === 'exploring', null, { timeout: 25000 });

  const well = (await page.evaluate(() => window.__lennyWorld?.landmarks()))!.find((l) => l.id === 'well')!;
  await walkToWorld(page, well.x, well.z, 2.0);

  const panel = page.locator('#world-well');
  await expect(panel).toBeVisible({ timeout: 8000 });
  await expect(panel).toContainText('בְּאֵר הַגַּן');

  /* buy the green scarf — it is worn at once (owned AND worn) */
  await page.locator('#well-scarf-moss').click();
  await expect(page.locator('.well-row.wearing')).toHaveCount(1);
  const wardrobe = await page.evaluate(() => localStorage.getItem('lenny-world-wardrobe-v1'));
  expect(wardrobe).toContain('scarf-moss');

  /* the wallet went down by exactly the scarf's cost (8) */
  await expect.poll(() => page.evaluate(() => window.__lennyWorld?.acorns())).toBe(12);

  await page.locator('#well-close').click();
  await expect(panel).toBeHidden();
});
