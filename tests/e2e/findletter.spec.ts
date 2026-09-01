import { expect, test, type Page } from '@playwright/test';

/* FindLetter e2e — DOM/state based: real taps via window.__lenny. */

interface LetterState {
  kind: string;
  round: number;
  totalRounds: number;
  targetLetter: string;
  letters: Array<{ x: number; y: number; glyph: string }>;
  wrongSinceLastFind: number;
  hint: string;
  done: boolean;
}

const UNLOCK_VALLEY = {
  firstSeen: Date.now(),
  lights: 5,
  zones: {
    'light-path': { finished: 1, unlocked: true },
    'memory-hill': { finished: 1, unlocked: true },
    'attention-stream': { finished: 1, unlocked: true },
    'thinking-forest': { finished: 1, unlocked: true },
    'space-sky': { finished: 1, unlocked: true },
  },
};

const CONFUSABLES: Record<string, string> = {
  'ב': 'כ', 'כ': 'ב', 'מ': 'ס', 'ס': 'מ', 'ד': 'ר', 'ר': 'ד',
};

async function openFindLetter(page: Page, ddaLevel: number): Promise<void> {
  await page.addInitScript(
    ({ garden, dda }) => {
      localStorage.setItem('lenny-garden', JSON.stringify(garden));
      localStorage.setItem('lenny-dda-v1', dda);
    },
    { garden: UNLOCK_VALLEY, dda: JSON.stringify({ 'words-valley': { skill: ddaLevel, streak: 0, rounds: 0, frustration: 0 } }) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /נַתְחִיל/ }).click();
  await page.locator('.zone-card[data-zone="words-valley"]').click();
  await expect(page.locator('#game-screen canvas')).toBeVisible();
  await expect(page.locator('#hud-zone')).toHaveText(/עֵמֶק הַמִּלִּים/);
}

async function state(page: Page): Promise<LetterState | null> {
  return page.evaluate(() => (window.__lenny?.sceneState() ?? null) as LetterState | null);
}

async function tapDesign(page: Page, dx: number, dy: number): Promise<void> {
  /* map through the LIVE Arena world space (never a hardcoded 420x720) */
  const { rect, design } = await page.evaluate(() => ({
    rect: window.__lenny?.canvasRect(),
    design: window.__lenny?.design,
  }));
  expect(rect).not.toBeNull();
  await page.touchscreen.tap(
    rect!.x + (dx / design!.w) * rect!.width,
    rect!.y + (dy / design!.h) * rect!.height,
  );
}

test('level-0: five letters found; signals stream records the attempts', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await openFindLetter(page, 0.05);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const target = s.letters.find((l) => l.glyph === s.targetLetter);
    if (target) {
      await tapDesign(page, target.x, target.y);
      await page.waitForTimeout(700); /* round lock 500ms + new round */
    } else {
      await page.waitForTimeout(200);
    }
  }

  expect((await state(page))?.done ?? true).toBe(true);
  const signals = await page.evaluate(() => JSON.parse(localStorage.getItem('lenny-signals-v1') ?? '{"events":[]}'));
  const letterAttempts = (signals.events as Array<{ kind: string; skill: string }>).filter(
    (e) => e.kind === 'attempt' && (e.skill === 'language.letter-recognition' || e.skill.startsWith('letter.')),
  );
  expect(letterAttempts.length).toBeGreaterThanOrEqual(5);

  const garden = await page.evaluate(() => window.__lenny!.garden());
  const finished = garden.finished?.['words-valley'] ?? garden.zones['words-valley']?.finished ?? 0;
  expect(finished).toBeGreaterThan(0);
  /* the ceremony holds ~5.2s (dt-clamped under load) + exit wipe — load-tolerant window */
  await expect(page.locator('#garden-screen')).toBeVisible({ timeout: 22000 });
  expect(errors).toEqual([]);
});

test('level 0.6 plants the confusable partner whenever the target has one', async ({ page }) => {
  test.setTimeout(120_000);
  await openFindLetter(page, 0.6);

  const deadline = Date.now() + 90_000;
  let checksWithPartner = 0;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (!s || s.done) break;
    const partner = CONFUSABLES[s.targetLetter];
    if (partner) {
      checksWithPartner++;
      expect(s.letters.some((l) => l.glyph === partner)).toBe(true);
    }
    expect(s.letters.length).toBe(6);
    const target = s.letters.find((l) => l.glyph === s.targetLetter);
    if (target) {
      await tapDesign(page, target.x, target.y);
      await page.waitForTimeout(700);
    }
  }
  expect((await state(page))?.done ?? true).toBe(true);
  /* the conditional assertion actually ran for at least one round */
  expect(checksWithPartner).toBeGreaterThanOrEqual(1);
});
