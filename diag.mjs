import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 740 }, hasTouch: true });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,200)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0,150)); });
await page.addInitScript(() => localStorage.setItem('lenny-garden-mode', 'world'));
await page.goto('http://localhost:4173/');
await page.getByRole('button', { name: /נַתְחִיל/ }).click();
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => ({
    fps: Math.round(window.__lennyWorld?.fps() ?? -1),
    phase: window.__lennyWorld?.phase(),
    zones: window.__lennyWorld?.zones()?.length ?? -1,
    screen: window.__lenny?.screen(),
  }));
  console.log(`t+${i+1}s`, JSON.stringify(s));
  if (s.phase === 'closed') break;
}
await b.close();
