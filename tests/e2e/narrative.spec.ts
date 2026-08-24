import {test,expect} from '@playwright/test';
test('נרטיב לעולם: שם+יצור+שורת סיפור', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await page.touchscreen.tap(187,548);await page.waitForTimeout(300);
 await page.touchscreen.tap(67,667*0.34);await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__worldName)).toBe('אֲחוּ הַחַיּוֹת');
 expect(errors).toEqual([]);
});
