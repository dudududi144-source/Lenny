import {test,expect} from '@playwright/test';
test('סאונד: גוון כלי משתנה לפי עולם', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await page.touchscreen.tap(187,300);
 await page.waitForTimeout(200);
 const w0=await page.evaluate(()=>(window as any).__getAudioWave());
 await page.evaluate(()=>(window as any).__setWorld(3));
 await page.waitForTimeout(100);
 const w1=await page.evaluate(()=>(window as any).__getAudioWave());
 expect(w1).not.toBe(w0);
 expect(errors).toEqual([]);
});
