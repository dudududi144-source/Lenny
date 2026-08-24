import {test,expect} from '@playwright/test';
async function solve(page:any){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 const cx=await page.evaluate(()=>(window as any).__correctX as number);
 // כישלון מכוון ואז פתרון
 const wrongX=cx===375*0.5?375*0.3:375*0.5;
 await page.touchscreen.tap(wrongX,667*0.45);
 await page.waitForTimeout(200);
 const hint=await page.evaluate(()=>(window as any).__hintLevel as number);
 await page.touchscreen.tap(cx,667*0.45);
 await page.waitForTimeout(300);
 return hint;
}
test('תוכן data-driven: 2 סוגי חידות + scaffolding', async ({page})=>{
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 const h1=await solve(page);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(1);
 expect(h1).toBeGreaterThanOrEqual(1);
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await solve(page);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(2);
});
