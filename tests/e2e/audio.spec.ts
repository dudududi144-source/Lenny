import {test,expect} from '@playwright/test';
test('מוזיקה אדפטיבית: מתחילה במגע ומתעבה עם אורות', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await page.touchscreen.tap(187,300);
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__audioStarted)).toBe(true);
 const l0=await page.evaluate(()=>(window as any).__getAudioLayers());
 await page.evaluate(()=>(window as any).__setLights(8));
 await page.waitForTimeout(200);
 const l1=await page.evaluate(()=>(window as any).__getAudioLayers());
 expect(l1).toBeGreaterThan(l0);
 expect(errors).toEqual([]);
});
