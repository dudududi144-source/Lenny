import {test,expect} from '@playwright/test';
test('aurora: רקע חי — שני פריימים שונים + מגוון צבע', async ({page})=>{
 await page.goto('/');
 await page.waitForSelector('canvas');
 await page.waitForTimeout(400);
 const a=await page.screenshot();
 await page.waitForTimeout(400);
 const b=await page.screenshot();
 expect(a.equals(b)).toBe(false);
 const variety=await page.evaluate(()=>{const c=document.querySelector('canvas') as HTMLCanvasElement;
  const x=c.getContext('2d');if(!x)return 0;
  const d=x.getImageData(0,0,c.width,c.height).data;
  const s=new Set<string>();for(let i=0;i<d.length;i+=97)s.add(d[i]+','+d[i+1]+','+d[i+2]);
  return s.size;});
 expect(variety).toBeGreaterThan(6);
});
