import {test,expect} from '@playwright/test';
test('ParentLens מציג נתונים אמיתיים', async ({page})=>{
 await page.goto('/?scene=parents');
 await page.waitForSelector('canvas');
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__screen)).toBe('parents');
 expect(await page.evaluate(()=>(window as any).__parentsLines)).toBeGreaterThanOrEqual(4);
});
