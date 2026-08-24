import {test,expect} from '@playwright/test';
test('onboarding: מופיע בפעם הראשונה ונעלם אחרי תנועה', async ({page})=>{
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__onboard)).toBe(true);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(400);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(200);
 expect(await page.evaluate(()=>(window as any).__onboard)).toBe(false);
});
