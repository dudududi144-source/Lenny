/* ============================================================
 * SequenceEcho difficulty e2e — plays the REAL Phaser CANVAS.
 *
 * Stage 2c section 2.9 (GlowFish/MemoryPairs template, third
 * validation). The canvas is opaque by design (no DOM widgets to
 * query), so the suite reads PIXELS — with one Stage 2c upgrade:
 * the game runs Phaser's CANVAS renderer with a 420x720 drawing
 * buffer that maps 1:1 onto design coordinates, and the canvas is
 * same-origin — so the suite reads the renderer's own buffer via
 * ctx.getImageData() inside page.evaluate (~5ms per read, vs
 * ~250ms for an element screenshot). Every lit window of the
 * playback (flash = 0.55 * gap, down to 220ms at level 1) is
 * therefore sampled 10-40x, which makes sequence reading
 * deterministic where screenshot polling could not be.
 *
 *  - the board is a fixed 3x2 keyboard of stone plates; all six
 *    (shape,tone) kinds are always visible, so kinds are
 *    classified from IDLE frames (lit auras never pollute them):
 *      tone  = mean ink luminance (bright >= ~170 > ~140 >= muted)
 *      leaf  = tall bbox + an EMPTY central vein channel between
 *              two populated side columns
 *      chime = detached clapper dot below + wider top than bottom
 *      orb   = centered round mass (fallback)
 *  - the echo sequence is read from the LIT AURAS: per-cell mean
 *    luminance GAIN over a stable idle baseline (lit adds a r34
 *    a0.4 aura + a stroke ring; idle wobble is +/-3). Onsets =
 *    lit-cell changes separated by quiet frames.
 *  - similarity assertions ride on deterministic pigeonholes: at
 *    level 1 the 5 echoed kinds must contain >= 2 same-shape
 *    tone-twin pairs (any 5 of 6 kinds do), while at level 0 the
 *    greedy selection can only echo cross-shape strangers.
 *  - the hint ladder is visible: the clear/show glow is pink
 *    0xff8ad9 (a pink used nowhere else in this scene), the show
 *    badges are cream 0xfff3dc circles in a quadrant no ink ever
 *    enters; both are censused per cell.
 *  - the progress ring is the only gold in its corner region.
 *
 * All settles are STATE-DRIVEN (stable-baseline polls, onset
 * counting, census peaks), never fixed sleeps. No production test
 * hooks: everything runs the shipping scene.
 * ============================================================ */

import { test, expect, Page } from '@playwright/test';

/* ---------------- design-space geometry (mirrors the scene) ------ */

const CELL_X = [84, 210, 336];           /* 0.2W, 0.5W, 0.8W of 420 */
const CELL_Y = [245, 403];               /* 0.34H, 0.56H of 720    */
/* cell index = row * 3 + col (row-major, like the scene's push order) */
const CELL_CX = [...CELL_X, ...CELL_X];
const CELL_CY = [CELL_Y[0], CELL_Y[0], CELL_Y[0], CELL_Y[1], CELL_Y[1], CELL_Y[1]];

const DDA_KEY = 'lenny-dda-v1';
const GARDEN_KEY = 'lenny-garden';
/* memory-hill = zone index 1 on the garden path; the zone advances
   through its registry games, so finished=2 routes to
   sequence-echo-1 (memory-pairs-1, memory-pairs-2, sequence-echo-1) */
const MEMORY_ZONE = 1;

/* ---------------- in-page pixel reader ---------------- */

/* One full-frame getImageData per call; everything is summarized
   in-page (the raw buffer never crosses the wire). */
const READ_SCENE_FN = () => {
  const CELL_X = [84, 210, 336];
  const CELL_Y = [245, 403];
  const CX = [...CELL_X, ...CELL_X];
  const CY = [CELL_Y[0], CELL_Y[0], CELL_Y[0], CELL_Y[1], CELL_Y[1], CELL_Y[1]];

  const cv = document.querySelector('canvas') as HTMLCanvasElement;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const W = cv.width, H = cv.height;
  const img = ctx.getImageData(0, 0, W, H).data;
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * W + x) << 2;
    return [img[i], img[i + 1], img[i + 2]];
  };
  const lum = (r: number, g: number, b: number): number => 0.3 * r + 0.6 * g + 0.1 * b;

  const cells: Array<{ lum: number; ink: number[][] }> = [];
  const pink: number[] = [];
  const cream: number[] = [];

  for (let c = 0; c < 6; c++) {
    const cx = CX[c], cy = CY[c];

    /* mean luminance over the lit-disc region (r = 36) */
    let lumSum = 0, n = 0;
    for (let dy = -36; dy <= 36; dy += 2) {
      for (let dx = -36; dx <= 36; dx += 2) {
        if (dx * dx + dy * dy > 36 * 36) continue;
        const [r, g, b] = at(cx + dx, cy + dy);
        lumSum += lum(r, g, b);
        n++;
      }
    }

    /* ink samples: saturated, luminous pixels inside the plate
       (inset 26 of the plate's 29 keeps the edge stroke out; the
       leaf's dark vein and the plate itself fail the sat test.
       Threshold 55: the dimmest idle ink, muted sage at a0.85 over
       the plate, composites to sat 66 — 70 would miss it) */
    const ink: number[][] = [];
    for (let dy = -26; dy <= 26; dy++) {
      for (let dx = -26; dx <= 26; dx++) {
        const [r, g, b] = at(cx + dx, cy + dy);
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (sat >= 55 && lum(r, g, b) >= 90) ink.push([dx, dy, r, g, b]);
      }
    }

    /* hint-glow pink (0xff8ad9) census over the cell disc r40 */
    let pk = 0;
    for (let dy = -40; dy <= 40; dy += 2) {
      for (let dx = -40; dx <= 40; dx += 2) {
        if (dx * dx + dy * dy > 40 * 40) continue;
        const [r, g, b] = at(cx + dx, cy + dy);
        if (r >= 200 && g >= 95 && g <= 190 && b >= 175 && r - g >= 50) pk++;
      }
    }

    /* badge cream (0xfff3dc) census in the badge quadrant — no ink
       or aura ever enters (+26..+54, -60..-32 relative to center) */
    let cr = 0;
    for (let dy = -60; dy <= -32; dy++) {
      for (let dx = 26; dx <= 54; dx++) {
        const [r, g, b] = at(cx + dx, cy + dy);
        if (r >= 240 && g >= 225 && b >= 185) cr++;
      }
    }

    cells.push({ lum: n > 0 ? lumSum / n : 0, ink });
    pink.push(pk);
    cream.push(cr);
  }

  /* the progress ring is the only gold in its corner (indicator
     inks live at y >= 209, far below this region) */
  let ringGold = 0;
  for (let y = 25; y <= 85; y++) {
    for (let x = 350; x <= 410; x++) {
      const [r, g, b] = at(x, y);
      if (r >= 200 && g >= 150 && b <= 160) ringGold++;
    }
  }

  return { cells, pink, cream, ringGold };
};

type CellRead = { lum: number; ink: number[][] };
type SceneRead = { cells: CellRead[]; pink: number[]; cream: number[]; ringGold: number };

async function readScene(page: Page): Promise<SceneRead> {
  return await page.evaluate(READ_SCENE_FN) as SceneRead;
}

/* ---------------- classification (kind from idle ink) ------------- */

function classifyKind(cell: CellRead): string {
  const ink = cell.ink;
  if (ink.length < 25) return 'unknown';
  const meanLum = ink.reduce((s, q) => s + 0.3 * q[2] + 0.6 * q[3] + 0.1 * q[4], 0) / ink.length;
  const tone = meanLum >= 170 ? 'bright' : 'muted';

  const u = 48;
  let topW = 0, botW = 0, clapper = 0, narrowCol = 0, leftCol = 0, rightCol = 0;
  let minY = 99, maxY = -99, minX = 99, maxX = -99;
  for (const q of ink) {
    const dx = q[0], dy = q[1];
    minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
    minY = Math.min(minY, dy); maxY = Math.max(maxY, dy);
    if (dy < -0.10 * u && Math.abs(dx) < 0.42 * u) topW++;
    if (dy > +0.10 * u && Math.abs(dx) < 0.42 * u) botW++;
    if (dy > 0.26 * u && dy < 0.62 * u && Math.abs(dx) < 0.16 * u) clapper++;
    if (Math.abs(dx) < 0.06 * u && Math.abs(dy) < 0.34 * u) narrowCol++;
    if (dx < -0.10 * u && dx > -0.26 * u && Math.abs(dy) < 0.34 * u) leftCol++;
    if (dx > +0.10 * u && dx < +0.26 * u && Math.abs(dy) < 0.34 * u) rightCol++;
  }
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);

  /* leaf: tall lens, empty central channel between populated sides */
  if (h / w >= 1.35 && leftCol >= 8 && rightCol >= 8
      && narrowCol <= 0.25 * Math.min(leftCol, rightCol)) {
    return `${tone}:leaf`;
  }
  /* chime: detached clapper below + taper (wider top than bottom) */
  if (clapper >= 6 && topW > botW * 1.3) return `${tone}:chime`;
  /* orb: centered round mass (fallback) */
  return `${tone}:orb`;
}

function inkCentroidY(cell: CellRead): number {
  if (cell.ink.length === 0) return 0;
  return cell.ink.reduce((s, q) => s + q[1], 0) / cell.ink.length;
}

/* ---------------- state-driven waits ---------------- */

/*
 * The idle baseline. A naive "two stable reads" baseline can be
 * corrupted in two ways: a read landing INSIDE a lit window (the
 * lit cell then reads as baseline and its onset is missed) or by
 * late confetti residue at a round boundary. Taking the per-cell
 * MINIMUM luminance over a spread of reads kills both: idle is the
 * darkest state a cell can be in (lit adds +40..65, confetti only
 * brightens), and the ink samples are taken from each cell's own
 * darkest read — guaranteed unlit, guaranteed un-confettied.
 */
interface Baseline {
  cells: CellRead[];            /* per-cell: min lum + ink of the darkest read */
}

async function idleBaseline(page: Page, samples = 6): Promise<Baseline> {
  const reads: SceneRead[] = [];
  for (let i = 0; i < samples; i++) {
    reads.push(await readScene(page));
    await page.waitForTimeout(130);
  }
  const cells: CellRead[] = reads[0].cells.map((_, i) => {
    let darkest = reads[0];
    for (const r of reads) {
      if (r.cells[i].lum < darkest.cells[i].lum) darkest = r;
    }
    return { lum: darkest.cells[i].lum, ink: darkest.cells[i].ink };
  });
  return { cells };
}

/*
 * Read the echo sequence from the lit auras: onsets = lit-cell
 * changes separated by quiet frames. CRITICAL: after the last onset
 * the playback may still be running (the scene only unlocks input
 * at LEAD + len*gap) — a tap sent before that is silently swallowed
 * (onTap -> dialogue.skip). The reader therefore keeps polling
 * until the scene has been quiet for 1250ms continuously; during
 * playback quiet gaps never exceed gap - flash <= 360ms, so 1250ms
 * of quiet proves the input phase is live.
 */
async function readSequence(
  page: Page,
  expectedLen: number,
  timeoutMs = 40000,
): Promise<{ onsets: number[]; baseline: Baseline }> {
  const baseline = await idleBaseline(page);
  const onsets: number[] = [];
  let lastLit = -1;
  let lastLitAt = 0;
  const start = Date.now();
  const deadline = start + timeoutMs;
  while (Date.now() < deadline) {
    const f = await readScene(page);
    let lit = -1, best = -100;
    for (let i = 0; i < 6; i++) {
      const gain = f.cells[i].lum - baseline.cells[i].lum;
      if (gain > best) { best = gain; lit = i; }
    }
    if (best >= 22) {
      if (lit !== lastLit && onsets.length < expectedLen) onsets.push(lit);
      lastLit = lit;
      lastLitAt = Date.now();
    } else {
      lastLit = -1; /* a quiet frame separates repeated cells */
      if (onsets.length >= expectedLen && Date.now() - lastLitAt >= 1250) {
        return { onsets, baseline };
      }
    }
    /* no sleep: each read itself costs several ms of page time */
  }
  return { onsets, baseline };
}

/* poll a numeric extractor until it crosses a threshold */
async function pollUntil(
  page: Page,
  extract: (s: SceneRead) => number,
  threshold: number,
  timeoutMs = 9000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let best = -Infinity;
  while (Date.now() < deadline) {
    const s = await readScene(page);
    best = Math.max(best, extract(s));
    if (best >= threshold) return best;
    await page.waitForTimeout(90);
  }
  return best;
}

/* ---------------- input ---------------- */

/*
 * Tap a cell and MAKE SURE the game actually received it: every tap
 * flashes the tapped cell (the same aura a playback lit uses), so a
 * verified tap shows a luminance gain over the baseline within
 * ~700ms. A tap swallowed by the 'showing' phase would flash
 * nothing — retry up to 3 times, then fail loudly (a silently
 * poisoned echo is the one failure mode this suite must never
 * paper over).
 */
async function tapCell(page: Page, baseline: Baseline, idx: number): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('canvas box missing');
    const x = box.x + (CELL_CX[idx] / 420) * box.width;
    const y = box.y + (CELL_CY[idx] / 720) * box.height;
    await page.touchscreen.tap(x, y);
    const deadline = Date.now() + 700;
    while (Date.now() < deadline) {
      const f = await readScene(page);
      if (f.cells[idx].lum - baseline.cells[idx].lum >= 20) return;
    }
  }
  throw new Error(`tap on cell ${idx} never registered (eaten 3 times)`);
}

/* ---------------- game bootstrap ---------------- */

/*
 * The scene's showLoader() covers the whole canvas with a 0.75-alpha
 * veil (plus a gold dot and cream text near the bottom row) until the
 * background asset finishes loading — every pixel read before that is
 * garbage (ink sat collapses below the threshold, luminances sag).
 * When the veil lifts, ink samples jump from ~0 to 25+ per cell, so
 * "two consecutive all-cells-inky reads" is a state-driven readiness
 * signal — no fixed sleep.
 */
async function waitBoardReady(page: Page, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let ready = false;
  while (Date.now() < deadline) {
    const s = await readScene(page);
    const allInky = s.cells.every((c) => c.ink.length >= 25);
    if (allInky) {
      if (ready) return;
      ready = true;
    } else {
      ready = false;
    }
    await page.waitForTimeout(80);
  }
  throw new Error('board never became readable (loader veil stuck?)');
}

async function seedAndOpen(page: Page, skill: number): Promise<void> {
  await page.addInitScript(([ddaKey, gardenKey, sk]) => {
    localStorage.setItem(ddaKey, JSON.stringify({
      'memory-hill': { skill: Number(sk), streak: 0, rounds: 0, frustration: 0 },
    }));
    /* light-path finished once unlocks memory-hill; two memory-hill
       finishes route the zone to its third registry game:
       sequence-echo-1 */
    localStorage.setItem(gardenKey, JSON.stringify({
      firstSeen: Date.now(),
      lights: 0,
      zones: {},
      finished: { 'light-path': 1, 'memory-hill': 2 },
    }));
  }, [DDA_KEY, GARDEN_KEY, String(skill)] as unknown as [string, string, string]);

  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  await page.locator('.zone').nth(MEMORY_ZONE).click();
  const canvas = page.locator('canvas');
  await canvas.waitFor({ timeout: 10000 });
  await expect(canvas).toBeVisible();
  await waitBoardReady(page);
}

/* ---------------- the tests ---------------- */

test.describe('sequence-echo difficulty generator', () => {
  test.setTimeout(150_000);

  test('level 0: static strangers, short sequences, full win', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0);

    /* round 1: the echo has 2 kinds (plan: 2 + floor(0*3)) and the
       greedy low-level selection can only pair cross-shape strangers */
    let { onsets: seq, baseline } = await readSequence(page, 2);
    expect(seq, 'round 1 must echo 2 indicators').toHaveLength(2);

    const grid = baseline.cells.map(classifyKind);
    const kindA = grid[seq[0]], kindB = grid[seq[1]];
    expect(kindA, 'every echoed kind must be classifiable').not.toBe('unknown');
    expect(kindB, 'every echoed kind must be classifiable').not.toBe('unknown');
    expect(kindA.split(':')[1], 'level-0 echoes are strangers: different shapes')
      .not.toBe(kindB.split(':')[1]);

    await tapCell(page, baseline, seq[0]);
    await tapCell(page, baseline, seq[1]);

    /* round 2 (skill rose to ~0.27: still a 2-kind echo) */
    ({ onsets: seq, baseline } = await readSequence(page, 2));
    expect(seq, 'round 2 must echo 2 indicators').toHaveLength(2);
    await tapCell(page, baseline, seq[0]);
    await tapCell(page, baseline, seq[1]);

    /* round 3 (skill ~0.49: the echo grows to 3) */
    ({ onsets: seq, baseline } = await readSequence(page, 3));
    expect(seq, 'round 3 must echo 3 indicators').toHaveLength(3);
    for (const cell of seq) await tapCell(page, baseline, cell);

    /* a full win returns to the garden */
    await page.locator('#garden').waitFor({ state: 'visible', timeout: 20000 });

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('level 1: long near-twin sequences, bobbing motion, still winnable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 1);

    /* round 1 echoes 5 kinds (plan: 2 + floor(1*3)) — any 5 of the
       6 kinds contain >= 2 same-shape tone-twin pairs (pigeonhole),
       which is what makes them hard to tell apart. The reader's
       baseline also carries each cell's ink from an unlit frame. */
    const { onsets: seq, baseline } = await readSequence(page, 5);
    expect(seq, 'level 1 must echo 5 indicators').toHaveLength(5);

    /* classify the whole keyboard from the unlit baseline frame */
    const grid = baseline.cells.map(classifyKind);
    expect(grid.filter((k) => k === 'unknown'), 'all six kinds must classify: ' + grid.join(','))
      .toHaveLength(0);
    const kinds = seq.map((c) => grid[c]);
    let sameShapePairs = 0;
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        if (kinds[i].split(':')[1] === kinds[j].split(':')[1]) sameShapePairs++;
      }
    }
    expect(sameShapePairs, 'the echoed kinds must include near-twins: ' + kinds.join(','))
      .toBeGreaterThanOrEqual(2);

    /* bobbing motion: the input phase is live now (no lit windows),
       so idle ink drifts vertically between reads — amp = 3 + 1*4
       = 7px at level 1; static levels read ~0 */
    const b1 = await readScene(page);
    await page.waitForTimeout(450);
    const b2 = await readScene(page);
    await page.waitForTimeout(450);
    const b3 = await readScene(page);
    const drifts = CELL_CX.map((_, i) =>
      Math.max(
        Math.abs(inkCentroidY(b2.cells[i]) - inkCentroidY(b1.cells[i])),
        Math.abs(inkCentroidY(b3.cells[i]) - inkCentroidY(b1.cells[i])),
      ));
    expect(Math.max(...drifts), 'high-level indicators must bob: ' + drifts.join(','))
      .toBeGreaterThanOrEqual(3.5);

    /* the game stays fully winnable at the hardest setting */
    for (const cell of seq) await tapCell(page, baseline, cell);
    for (let round = 0; round < 2; round++) {
      const { onsets: next, baseline: nb } = await readSequence(page, 5);
      expect(next, 'later rounds keep the 5-kind echo').toHaveLength(5);
      for (const cell of next) await tapCell(page, nb, cell);
    }
    await page.locator('#garden').waitFor({ state: 'visible', timeout: 20000 });

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('hint ladder: misses escalate to glow (2) then number badges (3)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0.5);
    const { onsets: seq, baseline } = await readSequence(page, 3);
    expect(seq, 'level 0.5 echoes 3 indicators').toHaveLength(3);

    /* a cell the sequence never visits */
    const wrong = [0, 1, 2, 3, 4, 5].find((c) => !seq.includes(c)) as number;

    /* miss 1 -> gentle: the sequence simply replays (slower) */
    await tapCell(page, baseline, wrong);
    expect((await readSequence(page, 3)).onsets, 'after miss 1 the sequence replays')
      .toHaveLength(3);

    /* miss 2 -> clear: a pink glow marks the next-needed indicator
       during the input phase (the pulse dips, so poll for a peak) */
    await tapCell(page, baseline, wrong);
    await readSequence(page, 3); /* consume the replay */
    const glowPeak = await pollUntil(
      page,
      (s) => Math.max(...seq.map((c) => s.pink[c])),
      40,
      12000,
    );
    expect(glowPeak, `the clear hint must glow the next-needed cell (peak ${glowPeak})`)
      .toBeGreaterThanOrEqual(40);

    /* miss 3 -> show: numbered badges (1,2,3...) beside the echoed
       indicators, in sequence order */
    await tapCell(page, baseline, wrong);
    const badgePeak = await pollUntil(
      page,
      (s) => seq.filter((c) => s.cream[c] >= 40).length,
      3,
      12000,
    );
    expect(badgePeak, 'all three echoed indicators must show number badges')
      .toBeGreaterThanOrEqual(3);

    /* badges belong to the sequence only: a non-echoed cell's badge
       quadrant stays cream-free */
    const s = await readScene(page);
    expect(s.cream[wrong], 'no badge may appear on a non-echoed cell').toBeLessThan(10);

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('progress: completing a round advances the progress ring', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0);
    const { onsets: seq, baseline } = await readSequence(page, 2);
    expect(seq, 'round 1 must echo 2 indicators').toHaveLength(2);
    const before = (await readScene(page)).ringGold;

    await tapCell(page, baseline, seq[0]);
    await tapCell(page, baseline, seq[1]);

    /* the ring eases toward 1/3 and its completion pulse decays —
       poll until the gold census stabilizes high */
    const deadline = Date.now() + 12000;
    let after = 0;
    let prev = -1;
    while (Date.now() < deadline) {
      const cur = (await readScene(page)).ringGold;
      if (prev > 40 && Math.abs(cur - prev) < 12) { after = cur; break; }
      prev = cur;
      await page.waitForTimeout(200);
    }
    expect(after, `ring gold must grow after a completed round (before ${before}, after ${after})`)
      .toBeGreaterThanOrEqual(before + 40);

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });
});
