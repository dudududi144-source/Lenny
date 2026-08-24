import {test,expect} from '@playwright/test';
async function solveAt(page:any,lights:number){
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await page.evaluate(l=>(window as any).__setLights(l),lights);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 const cx=await page.evaluate(()=>(window as any).__correctX as number);
 await page.touchscreen.tap(cx,667*0.45);
 await page.waitForTimeout(300);
}
test('אותיות + רגשות נפתרים', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await solveAt(page,5); // letter
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(6);
 await solveAt(page,6); // emotion
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(7);
 expect(errors).toEqual([]);
});
