/* ============================================================
 * GlowFish difficulty e2e — plays the REAL Phaser CANVAS.
 *
 * Stage 2 section 5. The canvas is opaque by design (no DOM
 * widgets to query), so the suite reads PIXELS:
 *
 *  - the error ripple (a red used nowhere else in the scene)
 *    marks where each calibration tap actually landed, giving a
 *    least-squares fit from canvas-pixel space to page coords —
 *    absorbing canvas offset, FIT scale and DPR;
 *  - the glowing target is the only near-gold body in the play
 *    band (exactly one live target-kind fish exists at any
 *    moment), so cluster-finding locates it every frame;
 *  - round completion is proven by confetti (its violet appears
 *    nowhere else in the scene);
 *  - the show-hint floods the pond with target-coloured light.
 *
 * No production test hooks: everything runs the shipping scene.
 * ============================================================ */

import { test, expect, Page } from '@playwright/test';
import { PNG } from 'pngjs';

/* ---------------- pixel helpers ---------------- */

interface Cluster {
  cx: number;
  cy: number;
  count: number;
}

interface Pix {
  r: number;
  g: number;
  b: number;
}

function px(png: PNG, x: number, y: number): Pix {
  const i = (png.width * y + x) << 2;
  return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2] };
}

/* the error ripple 0xff3b3b, alpha-composited over the dark pond:
   at particle alpha 0.4-1.0 the composite keeps r-dominance
   (e.g. alpha .6 -> (169,44,44)). Coral body (255,122,107) fails
   on g=122 > 115; dimmed coral (205,107,97) passes g but is only
   reachable via a wrong-fish tap, and calibration taps land in
   guaranteed open water. */
function isRippleRed(p: Pix): boolean {
  return p.r >= 110 && p.r - p.g >= 55 && p.r - p.b >= 55 && p.g <= 115 && p.b <= 115;
}

/* the glowing target's light (body + full-alpha auras). Loose enough
   to catch the show-hint aura at 0.85+ alpha over the dark bg; coral
   (g=122), pink (b=207) and white text (b=236) all fail. A gold-KIND
   distractor body (240,192,90) also passes - so the LEADER is picked
   from among gold clusters by its unique dim-gold halo (see
   leaderCluster). */
function isGoldLight(p: Pix): boolean {
  return p.r >= 200 && p.g >= 150 && p.b <= 160;
}

/* the leader's aura rings composited over the dark pond:
   mid-glow 0.3xpulse -> ~(105,89,63); outer 0.07-0.18 -> ~(55-85,...).
   Only the glowing leader produces this dim-gold surround. */
function isHaloGold(p: Pix): boolean {
  return p.r >= 50 && p.r <= 140 && p.g >= 40 && p.g <= 115 && p.b >= 15 && p.b <= 75 && p.r > p.b + 10;
}

/* round-complete confetti violet 0x7c4dff, alpha-composited over the
   dark pond. Particles live 0.8-1.6s, so a capture 250-700ms after
   completion sees alpha ~0.4-0.8: r=40+84a, g=40+37a, b=40+215a.
   Collisions checked: violet fish full (177,140,255) fails r<=110;
   dimmed violet/blue fail g<=80; blue at alpha .3 fails b-r>=55. */
function isConfettiViolet(p: Pix): boolean {
  return p.r >= 50 && p.r <= 110 && p.g <= 80 && p.b >= 90 && p.b - p.r >= 55;
}

function collectMatches(png: PNG, match: (p: Pix) => boolean, yMinF: number, yMaxF: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const y0 = Math.floor(png.height * yMinF);
  const y1 = Math.floor(png.height * yMaxF);
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      if (match(px(png, x, y))) pts.push({ x, y });
    }
  }
  return pts;
}

/* greedy proximity grouping; clusters smaller than minCount ignored */
function clustersOf(pts: Array<{ x: number; y: number }>, minCount: number): Cluster[] {
  const clusters: Cluster[] = [];
  for (const p of pts) {
    let best: Cluster | null = null;
    let bestD = Infinity;
    for (const c of clusters) {
      const d = Math.hypot(c.cx - p.x, c.cy - p.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && bestD < 26) {
      const n = best.count;
      best.cx = (best.cx * n + p.x) / (n + 1);
      best.cy = (best.cy * n + p.y) / (n + 1);
      best.count = n + 1;
    } else {
      clusters.push({ cx: p.x, cy: p.y, count: 1 });
    }
  }
  return clusters.filter((c) => c.count >= minCount);
}

function countMatching(png: PNG, match: (p: Pix) => boolean, yMinF: number, yMaxF: number): number {
  return collectMatches(png, match, yMinF, yMaxF).length;
}

async function shot(page: Page): Promise<PNG> {
  const buf = await page.locator('canvas').screenshot();
  return PNG.sync.read(buf);
}

/* ---------------- game helpers ---------------- */

const DDA_KEY = 'lenny-dda-v1';
const GARDEN_KEY = 'lenny-garden';
/* attention-stream = zone index 2 on the garden path */
const ATTENTION_ZONE = 2;
/* play band as fractions of canvas height (excludes mascot/ring
   above and the dialogue box below) */
const BAND_TOP = 0.26;
const BAND_BOTTOM = 0.85;

async function seedAndOpen(page: Page, level: number): Promise<void> {
  await page.addInitScript(([ddaKey, gardenKey, lv]) => {
    localStorage.setItem(ddaKey, JSON.stringify({
      'attention-stream': { skill: Number(lv), streak: 0, rounds: 0, frustration: 0 },
    }));
    /* finish memory-hill once -> unlocks attention-stream (bridge rule) */
    localStorage.setItem(gardenKey, JSON.stringify({
      firstSeen: Date.now(),
      lights: 0,
      zones: { 'memory-hill': { finished: 1, unlocked: true } },
      finished: { 'memory-hill': 1 },
    }));
  }, [DDA_KEY, GARDEN_KEY, String(level)] as unknown as [string, string, string]);

  await page.goto('/');
  await page.click('#startBtn');
  await page.waitForSelector('.zone', { timeout: 5000 });
  await page.locator('.zone').nth(ATTENTION_ZONE).click();
  const canvas = page.locator('canvas');
  await canvas.waitFor({ timeout: 10000 });
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(700); /* intro dialogue + first frames */
}

/* map canvas-pixel space -> page coords. Primary: least-squares fit
   on the red-ripple marks of open-water taps (absorbs canvas offset,
   FIT scale, DPR and any Phaser input drift). Fallback: pure canvas
   geometry (Phaser's own mapping is within ~10px when bounds are
   settled). Taps are spread VERTICALLY - a single-row calibration
   makes the y-axis slope degenerate (0/0). */
async function calibrate(page: Page): Promise<(p: { x: number; y: number }) => { x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas box missing');

  /* below the fish band; a stray fish hit simply yields no ripple
     and the tap is skipped */
  const taps = [
    { fx: 0.25, fy: 0.76 },
    { fx: 0.50, fy: 0.81 },
    { fx: 0.75, fy: 0.86 },
  ];
  const pairs: Array<{ png: { x: number; y: number }; page: { x: number; y: number } }> = [];
  let pngW = 0;
  let pngH = 0;

  for (const tap of taps) {
    const before = await shot(page);
    pngW = before.width;
    pngH = before.height;
    const px0 = box.x + tap.fx * box.width;
    const py0 = box.y + tap.fy * box.height;
    await page.touchscreen.tap(px0, py0);
    await page.waitForTimeout(110); /* ripple alive (life 0.25-0.35s) */
    const after = await shot(page);

    /* the ripple = red pixels present now and not before */
    const newReds: Array<{ x: number; y: number }> = [];
    for (const p of collectMatches(after, isRippleRed, 0.15, 0.99)) {
      if (!isRippleRed(px(before, p.x, p.y))) newReds.push(p);
    }
    const clusters = clustersOf(newReds, 3);
    if (clusters.length > 0) {
      /* expected ripple position in png space, for stray-pixel guard */
      const expX = (px0 - box.x) * (after.width / box.width);
      const expY = (py0 - box.y) * (after.height / box.height);
      const near = clusters
        .filter((c) => Math.hypot(c.cx - expX, c.cy - expY) < 80)
        .sort((a, b) => Math.hypot(a.cx - expX, a.cy - expY) - Math.hypot(b.cx - expX, b.cy - expY));
      if (near.length > 0) {
        const c = near[0];
        pairs.push({ png: { x: c.cx, y: c.cy }, page: { x: px0, y: py0 } });
      }
    }
    await page.waitForTimeout(450); /* ripple fades fully */
  }

  /* axis-wise least squares: page = a * png + b (requires >= 2
     DISTINCT rows/columns, guaranteed by the vertical tap spread) */
  const geometric = (p: { x: number; y: number }) => ({
    x: box.x + p.x * (box.width / pngW),
    y: box.y + p.y * (box.height / pngH),
  });

  if (pairs.length < 2) {
    console.warn('calibration: falling back to geometric mapping');
    return geometric;
  }

  const fit = (getA: (p: typeof pairs[0]) => number, getB: (p: typeof pairs[0]) => number) => {
    const n = pairs.length;
    const sx = pairs.reduce((s, p) => s + getA(p), 0);
    const sy = pairs.reduce((s, p) => s + getB(p), 0);
    const sxx = pairs.reduce((s, p) => s + getA(p) * getA(p), 0);
    const sxy = pairs.reduce((s, p) => s + getA(p) * getB(p), 0);
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-6) return null; /* degenerate axis */
    const a = (n * sxy - sx * sy) / denom;
    const b = (sy - a * sx) / n;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0.8 || a > 1.25) return null;
    return { a, b };
  };
  const fx = fit((p) => p.png.x, (p) => p.page.x);
  const fy = fit((p) => p.png.y, (p) => p.page.y);

  if (!fx || !fy) {
    console.warn('calibration: degenerate fit, falling back to geometric mapping');
    return geometric;
  }

  return (p) => ({ x: fx.a * p.x + fx.b, y: fy.a * p.y + fy.b });
}

async function goldCluster(page: Page): Promise<Cluster | null> {
  const png = await shot(page);
  const cs = clustersOf(collectMatches(png, isGoldLight, BAND_TOP, BAND_BOTTOM), 8);
  return cs.length > 0 ? cs.reduce((a, b) => (a.count >= b.count ? a : b)) : null;
}

/* the GLOWING leader: among gold clusters, the one wrapped in the
   dim-gold aura halo (only the leader glows). Deterministic even
   when a gold-kind distractor shares the palette. */
async function leaderCluster(page: Page): Promise<Cluster | null> {
  const png = await shot(page);
  const cs = clustersOf(collectMatches(png, isGoldLight, BAND_TOP, BAND_BOTTOM), 8);
  if (cs.length === 0) return null;
  if (cs.length === 1) return cs[0];
  const haloScore = (c: Cluster): number => {
    let n = 0;
    for (let dy = -56; dy <= 56; dy += 3) {
      for (let dx = -56; dx <= 56; dx += 3) {
        const d = Math.hypot(dx, dy);
        if (d < 20 || d > 56) continue;
        const x = Math.round(c.cx + dx);
        const y = Math.round(c.cy + dy);
        if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
        if (isHaloGold(px(png, x, y))) n++;
      }
    }
    return n;
  };
  return cs.sort((a, b) => haloScore(b) - haloScore(a))[0];
}

async function tapCluster(page: Page, c: Cluster, toPage: (p: { x: number; y: number }) => { x: number; y: number }): Promise<void> {
  const pt = toPage({ x: c.cx, y: c.cy });
  await page.touchscreen.tap(pt.x, pt.y);
}

/* a non-gold, saturated fish cluster (for deliberate misses);
   clusters near the glowing target are rejected so the leader's
   mid-glow ring can never be mistaken for a distractor */
async function distractorCluster(page: Page): Promise<Cluster | null> {
  const gold = await goldCluster(page);
  const png = await shot(page);
  const cs = clustersOf(
    collectMatches(png, (p) => {
      const sat = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
      return sat > 50 && Math.max(p.r, p.g, p.b) > 100 && !isGoldLight(p);
    }, BAND_TOP, BAND_BOTTOM),
    8,
  );
  const far = gold
    ? cs.filter((c) => Math.hypot(c.cx - gold.cx, c.cy - gold.cy) > 60)
    : cs;
  if (far.length === 0) return null;
  const midY = png.height * (BAND_TOP + BAND_BOTTOM) / 2;
  /* nearest to the band centre keeps it away from edges */
  return far.sort((a, b) => Math.abs(a.cy - midY) - Math.abs(b.cy - midY))[0];
}

/* ---------------- the tests ---------------- */

test.describe('glowfish difficulty generator', () => {
  /* pixel-scanning under load: generous per-test budget */
  test.setTimeout(90_000);

  test('level 0: find both targets -> round completes with confetti and session advances', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0);
    const toPage = await calibrate(page);

    /* round 1 at level 0 = 2 targets, static pond. A null leader is
       legitimate right after a round completes (900ms transition +
       300ms spawn fade-in) - wait through it; only the FIRST check
       must see a target. Retry tolerates a stray miss. */
    let roundDone = false;
    let firstSeen = false;
    for (let i = 0; i < 6 && !roundDone; i++) {
      const target = await leaderCluster(page);
      if (!target) {
        expect(firstSeen, 'a glowing target should be visible at start').toBe(true);
        await page.waitForTimeout(900); /* round transition gap */
        continue;
      }
      firstSeen = true;
      await tapCluster(page, target, toPage);
      await page.waitForTimeout(250); /* confetti is freshest here */
      const png = await shot(page);
      if (countMatching(png, isConfettiViolet, BAND_TOP, BAND_BOTTOM) >= 25) roundDone = true;
      else await page.waitForTimeout(400);
    }
    expect(roundDone, 'round 1 should complete (confetti) after 2 finds').toBe(true);

    /* the session advances: a fresh round spawns a new glowing target */
    await page.waitForTimeout(2000);
    const next = await leaderCluster(page);
    expect(next, 'round 2 should have spawned a new glowing target').not.toBeNull();

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('level 0.95: active pond stays completable (a round finishes)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0.95);
    const toPage = await calibrate(page);

    /* hunt for round completion: tap whatever glows, watch for confetti */
    let roundDone = false;
    for (let i = 0; i < 14 && !roundDone; i++) {
      const target = await leaderCluster(page);
      if (!target) {
        await page.waitForTimeout(900); /* round transition gap */
        continue;
      }
      await tapCluster(page, target, toPage);
      await page.waitForTimeout(250);
      const png = await shot(page);
      const violet = countMatching(png, isConfettiViolet, BAND_TOP, BAND_BOTTOM);
      if (violet >= 25) roundDone = true;
      else await page.waitForTimeout(350);
    }

    expect(roundDone, 'a full round should complete even in an active pond').toBe(true);
    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('hint ladder: 3 straight misses escalate to the show-flash (full aura)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0);
    const toPage = await calibrate(page);

    const baselineGold = countMatching(await shot(page), isGoldLight, BAND_TOP, BAND_BOTTOM);
    expect(baselineGold).toBeGreaterThan(0);

    /* Pick the decoy ONCE from the clean pond, then tap the SAME
       spot 3 times. Re-picking after miss #2 would risk latching on
       to the clear-hint's sparkle residue around the leader, whose
       tap would land in open water and never register the miss. */
    const decoy = await distractorCluster(page);
    expect(decoy, 'a distractor should be locatable').not.toBeNull();
    const decoySpot: Cluster = { cx: (decoy as Cluster).cx, cy: (decoy as Cluster).cy, count: 1 };

    /* miss the same distractor 3 times: gentle -> clear -> show.
       (Exactly one live target exists, so any non-gold cluster is a
       genuine distractor - never an unlit twin of the target.) */
    for (let i = 0; i < 3; i++) {
      await tapCluster(page, decoySpot, toPage);
      /* after the 3rd miss, catch the show aura INSIDE its 1s window */
      await page.waitForTimeout(i === 2 ? 300 : 1200);
    }

    /* show-hint aura: the target floods its surroundings with light.
       The aura window is 1s, so take up to 3 quick captures and keep
       the best - robust against screenshot latency under load. */
    let flashGold = 0;
    for (let k = 0; k < 3 && flashGold < Math.max(850, baselineGold * 2); k++) {
      if (k > 0) await page.waitForTimeout(120);
      flashGold = Math.max(flashGold, countMatching(await shot(page), isGoldLight, BAND_TOP, BAND_BOTTOM));
    }
    expect(flashGold).toBeGreaterThanOrEqual(850);
    expect(flashGold).toBeGreaterThanOrEqual(baselineGold * 2);

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('progress ring advances after the first find', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await seedAndOpen(page, 0);
    const toPage = await calibrate(page);

    const before = await shot(page);
    const target = await leaderCluster(page);
    expect(target).not.toBeNull();
    await tapCluster(page, target as Cluster, toPage);
    await page.waitForTimeout(650); /* ring animates toward 1/2 */

    const after = await shot(page);

    /* diff the top strip (y < 0.18H, x > 0.72W): ring arc moved.
       Fish live at y >= 0.30H and the mascot sits at x ~ 0.15W, so
       only the ring (and ambient noise below threshold) is inside. */
    let changed = 0;
    const yMax = Math.floor(before.height * 0.18);
    const xMin = Math.floor(before.width * 0.72);
    for (let y = 0; y < yMax; y += 1) {
      for (let x = xMin; x < before.width; x += 1) {
        const a = px(before, x, y);
        const b = px(after, x, y);
        if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 45) changed++;
      }
    }
    expect(changed, 'the ring arc should visibly advance').toBeGreaterThanOrEqual(25);

    expect(pageErrors, 'no runtime errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  });
});
