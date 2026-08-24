import Phaser from 'phaser';
/* MascotRig — לני modular וקטורית: פרופורציות, squash-stretch, secondary motion, 6 הבעים */
export type Emotion='calm'|'joy'|'frustrated'|'sad'|'surprised'|'proud';
const SKIN=0xffe0c2,HAIR=0x6b3f23,DRESS=0xf2549a,INK=0x2a2140,MOUTH=0xc2405e;
function face(g:Phaser.GameObjects.Graphics,x:number,hy:number,s:number,e:Emotion){
 const ex=5*s,ey=hy-1*s;
 if(e!=='joy'){g.fillStyle(INK,1);g.fillCircle(x-ex,ey,2.2*s);g.fillCircle(x+ex,ey,2.2*s);}
 else{g.lineStyle(2*s,INK,1);
  g.beginPath();g.arc(x-ex,ey,2.5*s,Math.PI,0,true);g.strokePath();
  g.beginPath();g.arc(x+ex,ey,2.5*s,Math.PI,0,true);g.strokePath();}
 g.lineStyle(1.6*s,HAIR,1);
 if(e==='frustrated'){g.lineBetween(x-ex-2*s,ey-4*s,x-ex+2*s,ey-3*s);g.lineBetween(x+ex+2*s,ey-4*s,x+ex-2*s,ey-3*s);}
 if(e==='surprised'||e==='proud'){g.lineBetween(x-ex-2*s,ey-5*s,x-ex+2*s,ey-5*s);g.lineBetween(x+ex-2*s,ey-5*s,x+ex+2*s,ey-5*s);}
 const my=hy+6*s;g.lineStyle(2*s,MOUTH,1);
 if(e==='joy'){g.beginPath();g.arc(x,my-1*s,4*s,0,Math.PI,false);g.strokePath();}
 else if(e==='sad'||e==='frustrated'){g.beginPath();g.arc(x,my+3*s,4*s,Math.PI,0,true);g.strokePath();}
 else if(e==='surprised'){g.fillStyle(MOUTH,1);g.fillCircle(x,my,2.2*s);}
 else{g.lineBetween(x-3*s,my,x+3*s,my+(e==='proud'?-1*s:0));}
}
export function drawMascot(g:Phaser.GameObjects.Graphics,x:number,y:number,s:number,t:number,e:Emotion,vy=0,onGround=true){
 g.clear();
 const sq=!onGround?(vy<0?1.06:0.95):1+Math.sin(t*2)*0.012;
 const sway=Math.sin(t*3)*2*s*(onGround?0.4:1);
 const bodyH=26*s*sq,headR=15*s;
 const hipY=y-bodyH,headY=hipY-headR*1.15;
 g.lineStyle(5*s,SKIN,1);
 g.lineBetween(x-6*s,y,x-6*s,hipY+6*s);g.lineBetween(x+6*s,y,x+6*s,hipY+6*s);
 g.fillStyle(DRESS,1);g.beginPath();
 g.moveTo(x-10*s,hipY+4*s);g.lineTo(x+10*s,hipY+4*s);g.lineTo(x+7*s,hipY-14*s);g.lineTo(x-7*s,hipY-14*s);
 g.closePath();g.fillPath();
 g.lineStyle(4*s,SKIN,1);
 g.lineBetween(x-8*s,hipY-10*s,x-13*s,hipY-2*s+sway);g.lineBetween(x+8*s,hipY-10*s,x+13*s,hipY-2*s-sway);
 g.fillStyle(HAIR,1);g.fillCircle(x,headY-2*s,headR*1.02);
 g.fillStyle(SKIN,1);g.fillCircle(x,headY+2*s,headR*0.86);
 g.fillStyle(HAIR,1);g.fillCircle(x-headR*0.9+sway*0.3,headY-headR*0.4,4*s);
 face(g,x,headY,s,e);
}
