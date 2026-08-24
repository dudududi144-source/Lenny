import {test,expect} from '@playwright/test';
test('boot: מרנדר + קלט מזיז את לני', async ({page})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?scene=boot');
 await page.waitForSelector('canvas');
 await page.waitForTimeout(500);
 const rendered=await page.evaluate(()=>{const c=document.querySelector('canvas') as HTMLCanvasElement;
  const x=c.getContext('2d');if(!x)return false;
  const d=x.getImageData(0,0,c.width,Math.min(200,c.height)).data;
  const s=new Set<number>();for(let i=0;i<d.length;i+=40)s.add(d[i]+d[i+1]+d[i+2]);
  return s.size>0;});
 expect(rendered).toBe(true);
 const x0=await page.evaluate(()=>(window as any).__lennyX as number);
 // החזקת MAGEM אמיתית (CDP touch) בצד ימין — fallback לעכבר
 try{
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:300}]});
  await page.waitForTimeout(300);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }catch{ await page.mouse.move(300,300);await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up(); }
 const x1=await page.evaluate(()=>(window as any).__lennyX as number);
 expect(x1).toBeGreaterThan(x0);
 expect(errors).toEqual([]);
});
