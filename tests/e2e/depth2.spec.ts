import {test,expect} from '@playwright/test';
async function toPuzzle(page:any){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
}
test('חשיבה פתוחה: חידת free — כל בחירה מנצחת', async ({page})=>{
 await page.goto('/?scene=game&world=0');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await toPuzzle(page);
 expect(await page.evaluate(()=>(window as any).__puzzleType)).toBe('match');
 await page.touchscreen.tap(await page.evaluate(()=>(window as any).__correctX),667*0.45);
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(1);
 await page.goto('/?scene=game&world=0');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 await toPuzzle(page);
 expect(await page.evaluate(()=>(window as any).__puzzleType)).toBe('free');
 await page.touchscreen.tap(375*0.5,667*0.45); // כל בחירה
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(2);
});
