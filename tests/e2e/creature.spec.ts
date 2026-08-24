import {test,expect} from '@playwright/test';
async function sig(page:any){return await page.evaluate(()=>{const c=document.querySelector('canvas') as HTMLCanvasElement;
 const x=c.getContext('2d')!;const d=x.getImageData(230,330,100,90).data;
 let h=0;for(let i=0;i<d.length;i+=37)h=(h*31+d[i]+d[i+1]+d[i+2])>>>0;return h;});}
test('יצורים ייחודיים לכל עולם נרנדרים שונה', async ({page})=>{
 await page.goto('/?scene=game&world=0');await page.waitForSelector('canvas');await page.waitForTimeout(400);
 const a=await sig(page);
 await page.goto('/?scene=game&world=3');await page.waitForSelector('canvas');await page.waitForTimeout(400);
 const b=await sig(page);
 expect(a).not.toBe(b);
});
