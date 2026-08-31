import { expect, test, type Page } from '@playwright/test';

/* ParentLens e2e — the adult gate + dashboard render from the core stores. */

async function openParentGate(page: Page): Promise<{ a: number; b: number }> {
  await page.goto('/');
  await page.locator('#parent-link, .parent-link').first().click();
  await expect(page.locator('#parent-screen')).toBeVisible();
  await expect(page.locator('.parent-gate-question')).toBeVisible();
  const question = await page.locator('.parent-gate-question').textContent();
  const match = question!.match(/(\d+)\s*×\s*(\d+)/);
  expect(match).not.toBeNull();
  return { a: Number(match![1]), b: Number(match![2]) };
}

test('wrong answer keeps the dashboard locked; correct answer opens it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  const { a, b } = await openParentGate(page);
  const answer = a * b;

  /* tap a wrong option (there is always at least one) */
  const options = page.locator('.parent-gate-options button');
  const count = await options.count();
  let tappedWrong = false;
  for (let i = 0; i < count && !tappedWrong; i++) {
    const text = Number(await options.nth(i).textContent());
    if (text !== answer) {
      await options.nth(i).click();
      tappedWrong = true;
    }
  }
  expect(tappedWrong).toBe(true);
  await expect(page.locator('.parent-gate-feedback')).toContainText('תְּשׁוּבָה שְׁגוּיָה');
  await expect(page.locator('.parent-dashboard')).toBeHidden();

  /* now the correct one */
  for (let i = 0; i < count; i++) {
    if (Number(await options.nth(i).textContent()) === answer) {
      await options.nth(i).click();
      break;
    }
  }
  await expect(page.locator('.parent-dashboard')).toBeVisible();
  await expect(page.locator('#parent-screen .parent-title').last()).toContainText('מַה שֶּׁהַגַּן מְסַפֵּר');
  await expect(page.locator('.parent-zone-row')).toHaveCount(10);
  expect(errors).toEqual([]);
});

test('dashboard reflects seeded progress and returns to the hero', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lenny-garden',
      JSON.stringify({
        firstSeen: Date.now() - 86400000,
        lights: 4,
        zones: { 'light-path': { finished: 2, unlocked: true } },
      }),
    );
    localStorage.setItem(
      'lenny-signals-v1',
      JSON.stringify({
        events: [
          { t: Date.now(), kind: 'attempt', skill: 'memory.pairs' },
          { t: Date.now(), kind: 'attempt', skill: 'memory.pairs' },
          { t: Date.now(), kind: 'error-type', skill: 'memory.pairs', detail: 'near-miss-same-suit' },
        ],
        correctSkills: { 'memory.pairs': 2 },
      }),
    );
  });

  const { a, b } = await openParentGate(page);
  const answer = a * b;
  const options = page.locator('.parent-gate-options button');
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    if (Number(await options.nth(i).textContent()) === answer) {
      await options.nth(i).click();
      break;
    }
  }
  await expect(page.locator('.parent-dashboard')).toBeVisible();

  /* the seeded garden progress shows on the light-path row */
  const firstRow = page.locator('.parent-zone-row').first();
  await expect(firstRow).toContainText('שְׁבִיל הָאוֹר');
  await expect(page.locator('.parent-zone-count').first()).toHaveText('2');

  /* back to the hero */
  await page.locator('#parent-screen').getByRole('button', { name: /חזרה/ }).last().click();
  await expect(page.locator('#hero-screen')).toBeVisible();
});
