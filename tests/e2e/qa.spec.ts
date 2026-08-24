import {test,expect} from '@playwright/test';
const routes=['/','/?scene=game','/?scene=parents'];
test('QA: צילומי מסך בכל המסכים (מובייל)', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const r of routes){
  await page.goto(r);await page.waitForSelector('canvas');await page.waitForTimeout(500);
  await test.info().attach('mobile'+r.replace(/[/?=]/g,'_'),{body:await page.screenshot(),contentType:'image/png'});
 }
 expect(errors).toEqual([]);
});
