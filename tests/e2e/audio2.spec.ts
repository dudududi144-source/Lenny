import {test,expect} from '@playwright/test';
test('סאונד: גוון ייחודי לכל עולם', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await page.touchscreen.tap(187,300);
 await page.waitForTimeout(200);
 const t0=await page.evaluate(()=>(window as any).__getAudioTimbre());
 await page.evaluate(()=>(window as any).__setWorld(3));
 await page.waitForTimeout(100);
 const t1=await page.evaluate(()=>(window as any).__getAudioTimbre());
 expect(t1).not.toBe(t0);
 expect(errors).toEqual([]);
});
