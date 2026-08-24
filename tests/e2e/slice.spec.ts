import {test,expect} from '@playwright/test';
test('vertical slice: תנועה->חידה->אור->save', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?scene=game');
 await page.waitForSelector('canvas');
 await page.waitForTimeout(400);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 const cx=await page.evaluate(()=>(window as any).__correctX as number);
 await page.touchscreen.tap(cx,667*0.45);
 await page.waitForTimeout(400);
 expect(await page.evaluate(()=>(window as any).__lights)).toBe(1);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lenny-save-v1')||'{}'));
 expect(saved.lights).toBe(1);
 expect(errors).toEqual([]);
});
