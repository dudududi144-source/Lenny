import Phaser from 'phaser';
/* Aurora Paper-Diorama sky — gradient bands + moving glows; מחמם עם lights */
function mix(a:number,b:number,f:number){
 const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;
 return (Math.round(ar+(br-ar)*f)<<16)|(Math.round(ag+(bg-ag)*f)<<8)|Math.round(ab+(bb-ab)*f);}
export function drawAurora(g:Phaser.GameObjects.Graphics,w:number,h:number,t:number,lights:number){
 g.clear();
 const warm=lights/10;
 const top=mix(0x0a0416,0x2a1a4a,warm),mid=mix(0x141a3a,0x7c4dff,warm*0.6),bot=mix(0x1d2443,0xf2549a,warm*0.4);
 const bands=24;
 for(let i=0;i<bands;i++){const f=i/(bands-1);
  const c=f<0.5?mix(top,mid,f*2):mix(mid,bot,(f-0.5)*2);
  g.fillStyle(c,1);g.fillRect(0,(h/bands)*i,w,h/bands+1);}
 for(let i=0;i<3;i++){
  const gx=w*(0.2+0.3*i)+Math.sin(t*0.3+i*2)*w*0.1;
  const gy=h*0.25+Math.cos(t*0.23+i)*h*0.08;
  const r=90+i*30+warm*40;
  for(let k=4;k>0;k--){g.fillStyle(0x7dffb8,0.05*k*(0.5+warm));g.fillCircle(gx,gy,(r*k)/4);}
 }
}
