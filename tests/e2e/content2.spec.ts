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
test('5 סוגי חידות data-driven נפתרים ברצף', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<5;i++){
  await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
  await solve(page);
  expect(await page.evaluate(()=>(window as any).__lights)).toBe(i+1);
 }
 expect(errors).toEqual([]);
});
