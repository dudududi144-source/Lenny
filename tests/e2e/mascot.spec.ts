import {test,expect} from '@playwright/test';
test('mascot: הבעים נרנדרים שונים ומגיבים ל-emotion', async ({page})=>{
 await page.goto('/');
 await page.waitForSelector('canvas');
 await page.waitForTimeout(300);
 const sigs:number[]=[];
 for(const e of ['calm','joy','frustrated','sad','surprised','proud']){
  await page.evaluate(em=>(window as any).__setEmotion(em),e);
  await page.waitForTimeout(200);
  const sig=await page.evaluate(()=>{const c=document.querySelector('canvas') as HTMLCanvasElement;
   const x=c.getContext('2d')!;
   const d=x.getImageData(Math.floor(c.width/2)-45,Math.floor(c.height*0.5),90,Math.floor(c.height*0.12)).data;
   let hsh=0;for(let i=0;i<d.length;i+=37)hsh=(hsh*31+d[i])>>>0;return hsh;});
  sigs.push(sig);
 }
 expect(new Set(sigs).size).toBeGreaterThanOrEqual(4);
});
