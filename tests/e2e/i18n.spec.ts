import {test,expect} from '@playwright/test';
test('i18n: עברית ברירת מחדל', async ({page})=>{
 await page.goto('/');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__cta)).toContain('מַּסָּע');
});
test('i18n: מעבר לאנגלית', async ({page})=>{
 await page.addInitScript(()=>localStorage.setItem('lenny-lang','en'));
 await page.goto('/');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__cta)).toBe('Start the journey');
});
