import Phaser from 'phaser';
/* Parallax Paper-Diorama — שכבות עם עומק+צל, נושמות, ומתעוררות עם lights */
function mix(a:number,b:number,f:number){
 const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;
 return (Math.round(ar+(br-ar)*f)<<16)|(Math.round(ag+(bg-ag)*f)<<8)|Math.round(ab+(bb-ab)*f);}
export function drawDiorama(g:Phaser.GameObjects.Graphics,w:number,h:number,t:number,camX:number,lights:number){
 const warm=lights/10;
 const layers=[
  {f:0.2,col:mix(0x2a2140,0x7c4dff,warm*0.5),amp:22,base:0.60},
  {f:0.45,col:mix(0x241a38,0xf2549a,warm*0.4),amp:30,base:0.73},
  {f:0.75,col:mix(0x1a1230,0x2f7a5a,warm*0.3),amp:40,base:0.86}];
 layers.forEach((L,li)=>{
  const off=camX*L.f;
  g.fillStyle(L.col,1);g.beginPath();g.moveTo(0,h);
  for(let x=0;x<=w;x+=16){
   const y=h*L.base+Math.sin((x+off)*0.02+li*2+t*0.2)*L.amp*0.3+Math.sin((x+off)*0.005+li)*L.amp;
   g.lineTo(x,y);}
  g.lineTo(w,h);g.closePath();g.fillPath();
  if(li===2){const n=Math.round(warm*6);
   for(let i=0;i<n;i++){const fx=(((i*97-off)%w)+w)%w;g.fillStyle(0xffd76a,1);g.fillCircle(fx,h*L.base+14,4);}}
 });
}
