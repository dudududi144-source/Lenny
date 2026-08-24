import {test,expect} from '@playwright/test';
async function solve(page:any){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 const cx=await page.evaluate(()=>(window as any).__correctX as number);
 await page.touchscreen.tap(cx,667*0.45);
 await page.waitForTimeout(300);
}
test('שעות+מוזיקה נפתרות (כיסוי מלא)', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?scene=game&puzzle=w8-time');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await solve(page);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(1);
 await page.goto('/?scene=game&puzzle=w3-music');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await solve(page);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(2);
 expect(errors).toEqual([]);
});
