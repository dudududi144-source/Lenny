import {test,expect} from '@playwright/test';
async function openPuzzle(page:any){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 return await page.evaluate(()=>(window as any).__puzzleType as string);
}
test('עומק: כל עולם מלמד את המיומנות שלו', async ({page})=>{
 await page.goto('/?scene=game&world=0');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 expect(await openPuzzle(page)).toBe('match');
 await page.goto('/?scene=game&world=5');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 expect(await openPuzzle(page)).toBe('count');
});
