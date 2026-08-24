import {test,expect} from '@playwright/test';
test('שיא: אור עשירי -> מסך העולם המואר', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('lenny-save-v1',JSON.stringify({lights:9,name:'',onboarded:true})));
 await page.goto('/?scene=game');await page.waitForSelector('canvas');await page.waitForTimeout(300);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:375*0.8,y:500}]});
 await page.waitForTimeout(1600);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>(window as any).__puzzleOpen===true,null,{timeout:6000});
 for(let k=0;k<5;k++){
  if(await page.evaluate(()=>(window as any).__screen)==='win')break;
  if(!(await page.evaluate(()=>(window as any).__puzzleOpen)))break;
  const cx=await page.evaluate(()=>(window as any).__correctX as number);
  await page.touchscreen.tap(cx,667*0.45);
  await page.waitForTimeout(300);
 }
 await page.waitForFunction(()=>(window as any).__screen==='win',null,{timeout:4000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lenny-save-v1')||'{}'));
 expect(saved.lights).toBe(10);
 expect(errors).toEqual([]);
});
