import {test,expect} from '@playwright/test';
test('נרטיב עולם מוצג בחידה', async ({page})=>{
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 const n=await page.evaluate(()=>(window as any).__narrative as string);
 expect(n.length).toBeGreaterThan(5);
});
