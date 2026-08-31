/* ============================================================
 * MemoryPairs difficulty e2e — plays the REAL Phaser CANVAS.
 *
 * Stage 2b section 5 (GlowFish template, second validation).
 * The canvas is opaque by design (no DOM widgets to query), so
 * the suite reads PIXELS:
 *
 *  - the grid geometry is DERIVED from the scene's own config
 *    (fractions of the 420x720 design space), so every slot has
 *    a known rectangle in any screenshot size;
 *  - card backs are purple (0x7c4dff), faces are cream — a slot
 *    reads as DOWN / FRONT / unknown (flip transition);
 *  - FRONT slots are classified into (suit, tone) kinds by
 *    vector signature: flower=disc+detached petal ring with an
 *    EMPTY gap between, bug=body+thin legs below and an EMPTY
 *    top, fish=left tail + right-heavy mass, tree=top-heavy
 *    crown+narrow trunk. Tones split warm (r>>b) vs cool.
 *  - the deck is read from ONE peek frame (readDeckStable:
 *    two consecutive fully-valid reads + the each-kind-exactly-
 *    twice invariant), replacing the fragile reveal-protocol
 *    cascade of earlier drafts;
 *  - level-0 completion is READ-FREE brute force with verified
 *    outcomes (the game itself remembers everything);
 *  - the show-hint aura is pink 0xff8ad9 — a pink used nowhere
 *    else in the scene;
 *  - the peek-plus dim aid darkens failed slots measurably.
 *
 * All settles are STATE-DRIVEN (waitBacksRestored / waitFaceUp /
 * aura poll), never fixed sleeps. No production test hooks:
 * everything runs the shipping scene.
 * ============================================================ */

import { test, expect, Page } from '@playwright/test';
import { PNG } from 'pngjs';

/* ---------------- pixel helpers ---------------- */

interface Pix { r: number; g: number; b: number; }

function px(png: PNG, x: number, y: number): Pix {
  const i = (png.width * y + x) << 2;
  return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2] };
}

function lum(p: Pix): number {
  return 0.3 * p.r + 0.6 * p.g + 0.1 * p.b;
}

/* card back 0x7c4dff at 0.9 alpha over the dark veil: b-dominant.
   NOTE violet KIND pixels (177,140,255) also pass this — that is
   fine: face detection runs on cream coverage first, and shape
   classification treats those samples as colored ink. */
function isBackPurple(p: Pix): boolean {
  return p.b > p.r + 30 && p.b > p.g + 30;
}

/* the card face background 0xfff9f0 (+ its 0xe8d9c8 edge) */
function isCream(p: Pix): boolean {
  return p.r >= 210 && p.g >= 195 && p.b >= 175;
}

/* colored ink: the suit color, saturated, on the cream face.
   NOTE violet ink (177,140,255) is ALSO b-dominant like the back —
   classifySlot therefore decides front-vs-down by CREAM coverage
   first and only then splits ink out of the non-cream remainder. */
function isInk(p: Pix): boolean {
  const sat = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
  return sat > 50;
}

/* warm inks (coral 255,122,107 / gold 240,192,90): red >> blue.
   cool inks (violet 177,140,255 / mint 95,217,169): not. */
function isWarm(p: Pix): boolean {
  return p.r - p.b >= 50;
}

/* the show-hint aura 0xff8ad9 (255,138,217) at 0.95 stroke alpha.
   Collisions checked: bloom pink 0xf2549a fails g>=95 (84); coral
   fails b>=175 (107); violet fails r>=200 (177); cream/white fail
   sat; dialogue text fails all. */
function isAuraPink(p: Pix): boolean {
  return p.r >= 200 && p.g >= 95 && p.g <= 190 && p.b >= 175 && p.r - p.g >= 50;
}

/* ---------------- slot geometry (mirrors the scene config) ------- */

/* design space: 420x720; grid area x=0.08W y=0.22H w=0.84W h=0.50H,
   gap 10 (design px). A fresh garden seed enters memory-hill through
   the Game Builder (memory-pairs-1, itemCount 4) -> 2 rows x 4 cols;
   slotsForLayout stays general so the mirror can follow any layout. */
const DESIGN_W = 420;
const DESIGN_H = 720;

interface Slot { fx: number; fy: number; fw: number; fh: number; }

function slotsForLayout(rows: number, cols: number): Slot[] {
  const ax = 0.08 * DESIGN_W, ay = 0.22 * DESIGN_H;
  const aw = 0.84 * DESIGN_W, ah = 0.50 * DESIGN_H;
  const gap = 10;
  const cw = (aw - (cols - 1) * gap) / cols;
  const ch = (ah - (rows - 1) * gap) / rows;
  const out: Slot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        fx: (ax + c * (cw + gap) + cw / 2) / DESIGN_W,
        fy: (ay + r * (ch + gap) + ch / 2) / DESIGN_H,
        fw: cw / DESIGN_W,
        fh: ch / DESIGN_H,
      });
    }
  }
  return out;
}

/* ---------------- slot classification ---------------- */

type SlotRead = 'down' | 'unknown' | { kind: string };

/* classify one slot from the png. Scale-invariant: everything is
   expressed in fractions of the slot rect; u = 0.44 * slot width
   exactly as the scene's drawKind(). */
function classifySlot(png: PNG, s: Slot): SlotRead {
  const W = png.width;
  const cx = s.fx * W, cy = s.fy * png.height;
  const hw = (s.fw * W) / 2, hh = (s.fh * png.height) / 2;
  const u = 0.44 * (2 * hw);

  /* deep inset (6px) keeps the back-edge anti-alias halo out of the
     shape bands (a halo row at the top edge would break the bug's
     empty-top signature) */
  let cream = 0, purple = 0, total = 0;
  const stash: Array<{ x: number; y: number; p: Pix }> = [];
  for (let y = Math.round(cy - hh) + 6; y < cy + hh - 6; y += 2) {
    for (let x = Math.round(cx - hw) + 6; x < cx + hw - 6; x += 2) {
      total++;
      const p = px(png, x, y);
      if (isCream(p)) cream++;
      else {
        if (isBackPurple(p)) purple++;
        stash.push({ x, y, p });
      }
    }
  }
  if (total === 0) return 'unknown';
  const creamFrac = cream / total;
  const purpleFrac = purple / total;

  if (creamFrac < 0.18 && purpleFrac > 0.4) return 'down';
  if (creamFrac < 0.3) return 'unknown'; /* mid-flip / partial */

  /* FRONT: the ink is every saturated non-cream sample — violet
     included (its back-like b-dominance no longer matters here) */
  const ink = stash.filter((q) => isInk(q.p));

  /* shape metrics over the ink samples */
  let fDisc = 0, fGap = 0, fRing = 0, topBand = 0, centerMass = 0;
  let legs = 0, crown = 0, trunk = 0, bottomWide = 0, tail = 0;
  let sx = 0, sy = 0;
  for (const q of ink) {
    const dx = q.x - cx, dy = q.y - cy;
    const d = Math.hypot(dx, dy);
    sx += dx; sy += dy;
    if (d < 0.30 * u) fDisc++;
    if (d >= 0.36 * u && d <= 0.50 * u) fGap++;
    if (d >= 0.52 * u && d <= 0.80 * u) fRing++;
    if (d < 0.55 * u) centerMass++;
    if (dy < -0.40 * u) topBand++;
    if (dy > 0.30 * u && dy < 0.62 * u) {
      if (Math.abs(dx) < 0.12 * u) trunk++;
      if (Math.abs(dx) >= 0.15 * u) bottomWide++;
      legs++;
    }
    if (dy < -0.05 * u) crown++;
    if (dx >= -0.75 * u && dx <= -0.50 * u && Math.abs(dy) < 0.26 * u) tail++;
  }
  const n = ink.length;
  if (n === 0) return 'unknown';
  const centroidX = sx / n, centroidY = sy / n;

  /* 1. flower: filled center + EMPTY gap ring + detached petal ring */
  if (fDisc >= 12 && fRing >= 8 && fGap <= Math.max(2, 0.12 * (fDisc + fRing))) {
    return { kind: `${toneOf(ink)}:flower` };
  }
  /* 2. bug: empty top, big body, sparse thin legs below */
  if (topBand <= 1 && centerMass >= 25 && legs >= 8) {
    return { kind: `${toneOf(ink)}:bug` };
  }
  /* 3. fish: tail on the left + body mass shifted right */
  if (tail >= 5 && centroidX > 0.02 * u) {
    return { kind: `${toneOf(ink)}:fish` };
  }
  /* 4. tree: top-heavy crown + narrow trunk */
  if (crown >= 30 && trunk >= 5 && bottomWide <= trunk * 1.2 && centroidY < 0) {
    return { kind: `${toneOf(ink)}:tree` };
  }
  return 'unknown';
}

function toneOf(ink: Array<{ p: Pix }>): string {
  let warm = 0;
  for (const q of ink) if (isWarm(q.p)) warm++;
  return warm >= ink.length / 2 ? 'warm' : 'cool';
}

/* ---------------- game helpers ---------------- */

const DDA_KEY = 'lenny-dda-v1';
const GARDEN_KEY = 'lenny-garden';
/* memory-hill = zone index 1 on the garden path */
const MEMORY_ZONE = 1;

interface DeckSlot { slot: Slot; kind: string; }

/* the fresh-seed layout: GameSpec memory-pairs-1 (itemCount 4) -> 2x4.
   Mirrors entry.ts: specs[Math.min(done=0, len-1)] -> itemCount 4. */
const FRESH_LAYOUT = { rows: 2, cols: 4 };

async function shot(page: Page): Promise<PNG> {
  const buf = await page.locator('canvas').screenshot();
  return PNG.sync.read(buf);
}

async function seedAndOpen(page: Page, level: number): Promise<void> {
  await page.addInitScript(([ddaKey, gardenKey, lv]) => {
    localStorage.setItem(ddaKey, JSON.stringify({
      'memory-hill': { skill: Number(lv), streak: 0, rounds: 0, frustration: 0 },
    }));
    /* finish light-path once -> unlocks memory-hill (key rule) */
    localStorage.setItem(gardenKey, JSON.stringify({
      firstSeen: Date.now(),
      lights: 0,
      zones: {},
      finished: { 'light-path': 1 },
    }));
  }, [DDA_KEY, GARDEN_KEY, String(level)] as unknown as [string, string, string]);

  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  await page.locator('.zone').nth(MEMORY_ZONE).click();
  const canvas = page.locator('canvas');
  await canvas.waitFor({ timeout: 10000 });
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(700); /* intro dialogue + first frames */
}

/* static geometry: canvas-box mapping (Phaser's own mapping is
   within a few px; slot half-width ~36px css absorbs it) */
async function tapSlot(page: Page, s: Slot): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas box missing');
  await page.touchscreen.tap(box.x + s.fx * box.width, box.y + s.fy * box.height);
}

/* Read the FULL deck from peek frames: two consecutive reads must
   classify every slot as a valid FRONT kind, agree with each other,
   and satisfy the each-kind-exactly-twice invariant. Returns null
   when no stable frame exists (level 0 = exposure 'none'). */
async function readDeckStable(page: Page, slots: Slot[], polls = 12): Promise<DeckSlot[] | null> {
  let prevKey: string | null = null;
  for (let i = 0; i < polls; i++) {
    const png = await shot(page);
    const reads: (SlotRead)[] = slots.map((s) => classifySlot(png, s));
    const allKinds = reads.every((r) => r !== 'down' && r !== 'unknown');
    if (allKinds) {
      const ds = slots.map((s, k) => ({ slot: s, kind: (reads[k] as { kind: string }).kind }));
      const counts = new Map<string, number>();
      for (const d of ds) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
      const invariant = [...counts.values()].every((c) => c === 2);
      const key = ds.map((d) => d.kind).join('|');
      if (invariant) {
        if (key === prevKey) return ds;
        prevKey = key;
      } else {
        prevKey = null;
      }
    } else {
      prevKey = null;
    }
    await page.waitForTimeout(120);
  }
  return null;
}

/* poll until every listed slot reads 'down' twice in a row */
async function waitBacksRestored(page: Page, slots: Slot[], timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let consecutive = 0;
  while (Date.now() < deadline) {
    const png = await shot(page);
    const allDown = slots.every((s) => classifySlot(png, s) === 'down');
    consecutive = allDown ? consecutive + 1 : 0;
    if (consecutive >= 2) return true;
    await page.waitForTimeout(140);
  }
  return false;
}

/* tap a slot and MAKE SURE the card actually flipped up. A tap eaten
   by a lock window (miss 1200ms / match 500ms / peek tail) would
   silently poison the attempt — the pairing shifts and the game's
   miss counter never sees it. Retrying until the FRONT is visible
   makes every attempt atomic. */
async function tapUp(page: Page, d: DeckSlot): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await tapSlot(page, d.slot);
    const deadline = Date.now() + 1300;
    while (Date.now() < deadline) {
      const png = await shot(page);
      const r = classifySlot(png, d.slot);
      if (r !== 'down' && r !== 'unknown' && (r as { kind: string }).kind === d.kind) return;
      await page.waitForTimeout(110);
    }
  }
  throw new Error(`slot never flipped up (lock window ate every tap): ${d.kind}`);
}

/* settle pad: covers the input-lock tail that outlives the visual
   restore (flipDown finishes ~320ms before the lock releases) */
async function settle(page: Page, ms = 420): Promise<void> {
  await page.waitForTimeout(ms);
}

/* poll until every listed slot reads FRONT with the expected kind */
async function waitFaceUp(page: Page, ds: DeckSlot[], timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let consecutive = 0;
  while (Date.now() < deadline) {
    const png = await shot(page);
    const ok = ds.every((d) => {
      const r = classifySlot(png, d.slot);
      return r !== 'down' && r !== 'unknown' && (r as { kind: string }).kind === d.kind;
    });
    consecutive = ok ? consecutive + 1 : 0;
    if (consecutive >= 2) return true;
    await page.waitForTimeout(140);
  }
  return false;
}

/* mean luminance of a slot rect (for the dim-aid measurement) */
function slotLuminance(png: PNG, s: Slot): number {
  const cx = s.fx * png.width, cy = s.fy * png.height;
  const hw = (s.fw * png.width) / 2, hh = (s.fh * png.height) / 2;
  let sum = 0, n = 0;
  for (let y = Math.round(cy - hh) + 3; y < cy + hh - 3; y += 2) {
    for (let x = Math.round(cx - hw) + 3; x < cx + hw - 3; x += 2) {
      sum += lum(px(png, x, y));
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/* the aura ring fragments into arcs where its anti-aliased stroke
   crosses brighter background art, and the garden background itself
   carries static pink pixels — so raw censuses and small radii fail
   (a card is TALL: a 54px radius around the center sees only the
   ring's middle band and calls its own top/bottom arcs "far").
   Measure the pink GAIN over a pre-miss baseline instead, with a
   radius covering the FULL ring (0.7x slot diagonal): the static
   background cancels exactly, and a real show-aura adds ~700-1000
   sampled px around the twin while nothing else turns pink. */
function pinkGainNear(before: PNG, after: PNG, s: Slot): { near: number; far: number } {
  const cx = s.fx * after.width, cy = s.fy * after.height;
  const radius = 0.7 * Math.hypot(s.fw * after.width, s.fh * after.height);
  const y0 = after.height * 0.18, y1 = after.height * 0.78;
  let near = 0, far = 0;
  for (let y = Math.floor(y0); y < y1; y += 2) {
    for (let x = 0; x < after.width; x += 2) {
      if (!isAuraPink(px(after, x, y))) continue;
      if (isAuraPink(px(before, x, y))) continue; /* static pink: bg art */
      if (Math.hypot(x - cx, y - cy) <= radius) near++;
      else far++;
    }
  }
  return { near, far };
}

/* complete the whole game from a verified deck map */
async function completeFromMap(page: Page, deck: DeckSlot[]): Promise<void> {
  /* group slots by kind, match each pair, verify faces stay up */
  const byKind = new Map<string, DeckSlot[]>();
  for (const d of deck) {
    const arr = byKind.get(d.kind) ?? [];
    arr.push(d);
    byKind.set(d.kind, arr);
  }
  for (const pair of byKind.values()) {
    await tapUp(page, pair[0]);
    await tapSlot(page, pair[1].slot);
    const up = await waitFaceUp(page, [pair[0], pair[1]]);
    expect(up, `pair ${pair[0].kind} should match and stay face-up`).toBe(true);
    await settle(page, 320); /* match lock (500ms) tail */
  }
  await page.locator('#garden').waitFor({ state: 'visible', timeout: 15000 });
}

/* ---------------- the tests ---------------- */

test.describe('memory-pairs difficulty generator', () => {
  test.setTimeout(120_000);

  test('level 0: no reveal (deck unreadable), brute-force completion wins', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0);
    const slots = slotsForLayout(FRESH_LAYOUT.rows, FRESH_LAYOUT.cols);

    /* exposure 'none': no full-front frame may ever appear now */
    const peeked = await readDeckStable(page, slots, 6);
    expect(peeked, 'level 0 must NOT reveal the deck').toBeNull();

    /* READ-FREE brute force: the game itself remembers everything.
       (i, j) attempts; matched slots no-op; mismatches flip back. */
    const garden = page.locator('#garden');
    outer:
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          await tapSlot(page, slots[i]);
          await page.waitForTimeout(280);
          await tapSlot(page, slots[j]);
          await page.waitForTimeout(1450); /* mismatch lock + flip tail */
          if (await garden.isVisible().catch(() => false)) break outer;
        }
      }
    }
    await garden.waitFor({ state: 'visible', timeout: 15000 });

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('level 0.5: the deck peeks once, flips back, and is completable from the peek frame', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0.5);
    const slots = slotsForLayout(FRESH_LAYOUT.rows, FRESH_LAYOUT.cols);

    const deck = await readDeckStable(page, slots);
    expect(deck, 'peek mode must show a stable readable deck').not.toBeNull();
    const ds = deck as DeckSlot[];

    /* endPeek: every card flips back DOWN for real */
    const restored = await waitBacksRestored(page, slots);
    expect(restored, 'after the peek all cards must be face-down again').toBe(true);
    await settle(page); /* peek lock tail (releases after the backs) */

    /* complete the game using ONLY what the peek frame revealed */
    await completeFromMap(page, ds);

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('level 0.95: peek-plus — 4 misses dim the failed cards, game still completable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0.95);
    const slots = slotsForLayout(FRESH_LAYOUT.rows, FRESH_LAYOUT.cols);

    const deck = await readDeckStable(page, slots);
    expect(deck, 'peek-plus must show a stable readable deck').not.toBeNull();
    const ds = deck as DeckSlot[];
    expect(await waitBacksRestored(page, slots)).toBe(true);
    await settle(page); /* peek lock tail */

    /* both occurrences of each kind, by kind */
    const byKind = new Map<string, DeckSlot[]>();
    for (const d of ds) {
      const arr = byKind.get(d.kind) ?? [];
      arr.push(d);
      byKind.set(d.kind, arr);
    }
    const kinds = [...byKind.keys()];
    expect(kinds.length).toBeGreaterThanOrEqual(4);
    const [ka, kb, kc] = kinds;
    const A = byKind.get(ka) as DeckSlot[];
    const B = byKind.get(kb) as DeckSlot[];
    const C = byKind.get(kc) as DeckSlot[];

    /* four verified misses re-using failed slots: 6 distinct slots
       dim, leaving untouched slots to measure against */
    const missPairs: DeckSlot[][] = [
      [A[0], B[0]],
      [A[0], C[0]],
      [A[1], B[1]],
      [A[1], C[1]],
    ];
    for (const [a, b] of missPairs) {
      await tapUp(page, a);
      await tapSlot(page, b.slot);
      const restored = await waitBacksRestored(page, [a.slot, b.slot]);
      expect(restored, `(${a.kind} vs ${b.kind}) must be a verified miss`).toBe(true);
      await settle(page);
    }

    /* dim aid: failed slots now measurably darker than untouched ones */
    const png = await shot(page);
    const dimmedSet = new Set<Slot>();
    for (const [a, b] of missPairs) { dimmedSet.add(a.slot); dimmedSet.add(b.slot); }
    const dimmed = [...dimmedSet].map((s) => slotLuminance(png, s));
    const clean = ds.map((d) => d.slot).filter((s) => !dimmedSet.has(s)).map((s) => slotLuminance(png, s));
    expect(dimmed.length).toBeGreaterThanOrEqual(5);
    expect(clean.length).toBeGreaterThanOrEqual(2);
    expect(
      Math.max(...dimmed),
      `dimmed (${Math.max(...dimmed).toFixed(1)}) must sit below clean (${Math.min(...clean).toFixed(1)})`,
    ).toBeLessThan(Math.min(...clean) - 8);

    /* and the game remains fully winnable */
    await completeFromMap(page, ds);

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('hint ladder: three consecutive misses escalate to the pink show-aura on the twin', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0.5); /* peek mode -> deterministic deck map */
    const slots = slotsForLayout(FRESH_LAYOUT.rows, FRESH_LAYOUT.cols);

    const deck = await readDeckStable(page, slots);
    expect(deck).not.toBeNull();
    const ds = deck as DeckSlot[];
    expect(await waitBacksRestored(page, slots)).toBe(true);
    await settle(page); /* peek lock tail */

    const firstOf = new Map<string, DeckSlot>();
    for (const d of ds) if (!firstOf.has(d.kind)) firstOf.set(d.kind, d);
    const kinds = [...firstOf.values()];
    const held = kinds[0];
    const twin = ds.find((d) => d !== held && d.kind === held.kind);
    expect(twin, 'the held card must have exactly one twin in the deck').toBeTruthy();

    /* three CONSECUTIVE verified misses, all against the held card.
       Before the 3rd miss: a clean baseline frame (no pink anywhere
       but the static bg art) — the aura is measured as pink GAIN. */
    for (const other of [kinds[1], kinds[2], kinds[3]]) {
      await tapUp(page, held);
      /* the aura fires only at the MISS resolution (the 2nd tap), so
         a frame taken after the first pick is guaranteed aura-free */
      let baselineBuf: Buffer | null = null;
      if (other === kinds[3]) baselineBuf = await page.locator('canvas').screenshot();
      const baseline = baselineBuf ? PNG.sync.read(baselineBuf) : null;
      await tapSlot(page, other.slot);
      if (other === kinds[3]) {
        /* 3rd miss: catch the 1.2s aura INSIDE its window */
        let gain: { near: number; far: number } | null = null;
        let last = 'baseline captured';
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline && !gain) {
          const g = pinkGainNear(baseline as PNG, await shot(page), (twin as DeckSlot).slot);
          last = `near=${g.near} far=${g.far}`;
          if (g.near >= 150 && g.near >= 4 * Math.max(1, g.far)) gain = g;
          else await page.waitForTimeout(110);
        }
        expect(gain,
          `the show-aura must flood the twin slot with new pink (last scan: ${last})`,
        ).not.toBeNull();
        const restored = await waitBacksRestored(page, [held.slot, other.slot]);
        expect(restored, 'the 3rd attempt must still be a miss, not a match').toBe(true);
        await settle(page);
      } else {
        const restored = await waitBacksRestored(page, [held.slot, other.slot]);
        expect(restored, `(${held.kind} vs ${other.kind}) must be a verified miss`).toBe(true);
        await settle(page);
      }
    }

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });
});
