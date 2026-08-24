import {test,expect} from '@playwright/test';
test('ניווט: כניסה->רכזת->עולם', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__screen)).toBe('title');
 await page.touchscreen.tap(187,548);
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__screen)).toBe('hub');
 await page.touchscreen.tap(67,667*0.34);
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__screen)).toBe('game');
 expect(errors).toEqual([]);
});
