import { expect, test, type Page } from '@playwright/test';

/* ParentLens v2 e2e (Stage 5) — additive contracts:
   garden entry, hold-gate, dashboard data, and the way back.
   The original gate question contracts live in parent.spec.ts. */

const SEEDED_ZONES: Record<string, { finished: number; unlocked: boolean }> = {
  'light-path': { finished: 3, unlocked: true },
  'memory-hill': { finished: 2, unlocked: true },
};

async function gotoGarden(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await expect(page.locator('#garden-screen')).toBeVisible();
}

test('parents enter from the garden — quiet link at the end of the path', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await gotoGarden(page);

  const link = page.locator('#garden-parent-link');
  await expect(link).toBeVisible();
  /* touch target comfort: at least 44px tall */
  const box = await link.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await link.click();
  await expect(page.locator('#parent-screen')).toBeVisible();
  /* the gate always opens first — a child's stray tap never gets in */
  await expect(page.locator('.parent-hold')).toBeVisible();
  await expect(page.locator('.parent-gate-question')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a quick tap on the hold-star stays locked; a 2s hold opens the lens and back returns to the garden', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await gotoGarden(page);
  await page.locator('#garden-parent-link').click();
  await expect(page.locator('.parent-hold')).toBeVisible();

  /* short tap — must NOT open */
  await page.locator('.parent-hold').dispatchEvent('pointerdown');
  await page.waitForTimeout(320);
  await page.locator('.parent-hold').dispatchEvent('pointerup');
  await expect(page.locator('.parent-dashboard')).toBeHidden();

  /* real hold — 2s opens */
  await page.locator('.parent-hold').dispatchEvent('pointerdown');
  await expect(page.locator('.parent-dashboard')).toBeVisible({ timeout: 5000 });

  /* back returns to where we came from: the garden */
  await page.locator('#parent-screen').getByRole('button', { name: /חזרה/ }).last().click();
  await expect(page.locator('#garden-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('dashboard renders real data: weekly bars, insights, blooming rings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  const now = Date.now();
  await page.addInitScript((seed) => {
    localStorage.setItem('lenny-garden', JSON.stringify(seed.garden));
    localStorage.setItem('lenny-signals-v1', JSON.stringify(seed.signals));
  }, {
    garden: {
      firstSeen: now - 6 * 86_400_000,
      lights: 5,
      zones: SEEDED_ZONES,
      finished: { 'light-path': 3, 'memory-hill': 2 },
    },
    signals: {
      events: [
        { t: now, kind: 'attempt', skill: 'memory.pairs', detail: 'correct' },
        { t: now, kind: 'attempt', skill: 'memory.pairs', detail: 'correct' },
        { t: now - 600_000, kind: 'attempt', skill: 'memory.pairs', detail: 'wrong' },
        { t: now - 600_000, kind: 'error-type', skill: 'memory.pairs', detail: 'near-miss-same-suit' },
        { t: now - 86_400_000, kind: 'attempt', skill: 'glowfish.find', detail: 'correct' },
        { t: now - 86_400_000, kind: 'mastery', skill: 'sound-alef' },
      ],
      correctSkills: { 'memory.pairs': 2, 'glowfish.find': 1 },
    },
  });

  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('#garden-parent-link').click();
  await page.locator('.parent-hold').dispatchEvent('pointerdown');
  await expect(page.locator('.parent-dashboard')).toBeVisible({ timeout: 5000 });

  /* hero + zone rows (the garden path is always mapped) */
  await expect(page.locator('.parent-title').last()).toContainText('מַה שֶּׁהַגַּן מְסַפֵּר');
  await expect(page.locator('.parent-zone-row')).toHaveCount(10);

  /* weekly chart draws real bars (yesterday + today) */
  await expect(page.locator('.parent-chart .pl-bar').first()).toBeVisible();
  expect(await page.locator('rect.pl-bar').count()).toBeGreaterThanOrEqual(2);

  /* insights speak (real signals only — no streak mechanics, ETHICS §2#6) */
  await expect(page.locator('.parent-insight').first()).toBeVisible();
  const insights = await page.locator('.parent-insight-text').allTextContents();

  /* mastery milestone from the signals stream */
  expect(insights.join(' ')).toContain('הַצְּלִיל א');

  /* error donut + legend from the seeded error kinds */
  await expect(page.locator('.parent-donut-wrap .pl-svg').first()).toBeVisible();
  await expect(page.locator('.pl-legend-item').first()).toBeVisible();

  /* intro card is present */
  await expect(page.locator('.parent-intro')).toBeVisible();

  expect(errors).toEqual([]);
});

test('fresh child sees the gentle empty state, never broken empty charts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await gotoGarden(page);
  await page.locator('#garden-parent-link').click();
  await page.locator('.parent-hold').dispatchEvent('pointerdown');
  await expect(page.locator('.parent-dashboard')).toBeVisible({ timeout: 5000 });

  await expect(page.locator('.parent-empty')).toBeVisible();
  /* the analytics charts stay out of the way when there is nothing to show */
  expect(await page.locator('rect.pl-bar').count()).toBe(0);

  expect(errors).toEqual([]);
});
