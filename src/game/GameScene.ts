import Phaser from 'phaser';
import {state,setLights} from './state';
import {loadSave,storeSave} from '../systems/save';
import {drawAurora} from '../fx/aurora';
import {drawDiorama} from '../fx/diorama';
import {drawMascot} from '../fx/mascot';
type Animal='dog'|'cat'|'bird';

/* Vertical Slice "השחר הראשון": תנועה -> חידה -> שער -> אור -> העולם מתעורר -> save */
export class GameScene extends Phaser.Scene{
 private bg!:Phaser.GameObjects.Graphics;private dio!:Phaser.GameObjects.Graphics;
 private mg!:Phaser.GameObjects.Graphics;private fg!:Phaser.GameObjects.Graphics;
 private mx=0;private my=0;private baseY=0;private vx=0;private vy=0;
 private puzzleOpen=false;private gateOpen=false;private won=0;
 private opts:{x:number;a:Animal}[]=[];
 constructor(){super('game');}
 create(){
  const sv=loadSave();if(sv.lights>0){setLights(sv.lights);this.gateOpen=true;}
  const w=this.scale.width,h=this.scale.height;this.baseY=h*0.62;
  this.bg=this.add.graphics();this.dio=this.add.graphics();this.mg=this.add.graphics();this.fg=this.add.graphics();
  this.mx=w*0.2;this.my=this.baseY;
  const xs=[0.3,0.5,0.7].map(f=>f*w);
  const order:Animal[]=['dog','cat','bird'];
  this.opts=order.map((a,i)=>({x:xs[i],a}));
  (window as any).__correctX=xs[0];
  this.add.text(w/2,h*0.3,'מִי הַכֶּלֶב? 🐾'.replace(' 🐾',''),{fontFamily:'Heebo',fontSize:'28px',color:'#FFF6EC'}).setOrigin(0.5).setName('q');
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   if(this.puzzleOpen){const y=h*0.45;
    for(const o of this.opts){if(Math.abs(p.x-o.x)<40&&Math.abs(p.y-y)<50){
      if(o.a==='dog')this.win();else{state.emotion='frustrated';}
      return;}}
    return;}
   const fx=p.x/w;
   if(fx<0.34)this.vx=-240;else if(fx>0.66)this.vx=240;else this.vy=-260;
  });
  this.input.on('pointerup',()=>{this.vx=0;});
 }
 private win(){this.puzzleOpen=false;this.gateOpen=true;this.won=this.time.now;
  setLights(1);storeSave({lights:1,name:loadSave().name});state.emotion='joy';}
 update(time:number){
  const dt=this.game.loop.delta/1000;const w=this.scale.width,h=this.scale.height;const t=time*0.001;
  drawAurora(this.bg,w,h,t,state.lights);
  drawDiorama(this.dio,w,h,t,this.mx,state.lights);
  this.mx=Phaser.Math.Clamp(this.mx+this.vx*dt,30,w-30);
  this.vy+=900*dt;this.my=Math.min(this.baseY,this.my+this.vy*dt);if(this.my>=this.baseY)this.vy=0;
  drawMascot(this.mg,this.mx,this.my,1.2,t,state.emotion,this.vy,this.my>=this.baseY-1);
  this.fg.clear();
  const gx=w*0.85;
  if(!this.gateOpen){this.fg.fillStyle(0x7c4dff,1);this.fg.fillRect(gx-4,h*0.4,8,h*0.22);
   this.fg.fillStyle(0xffd76a,1);this.fg.fillCircle(gx,h*0.4,8);
   if(this.mx>gx-90&&!this.puzzleOpen)this.puzzleOpen=true;}
  if(this.puzzleOpen){this.fg.fillStyle(0x0a0416,0.6);this.fg.fillRect(0,0,w,h);
   this.opts.forEach(o=>{this.drawAnimal(o.x,h*0.45,1.4,o.a);});}
  if(this.won){const k=(this.time.now-this.won)/1000;
   if(k<1.2){this.fg.lineStyle(4,0xffd76a,1-k/1.2);this.fg.strokeCircle(this.mx,this.my-40,20+k*80);}}
  (window as any).__puzzleOpen=this.puzzleOpen;
  (window as any).__lights=state.lights;
  (window as any).__lennyX=this.mx;
 }
 private drawAnimal(x:number,y:number,s:number,a:Animal){
  const g=this.fg;
  if(a==='dog'){g.fillStyle(0x8d5a3b,1);g.fillCircle(x,y,12*s);g.fillCircle(x+9*s,y-8*s,7*s);g.fillStyle(0x5b3a24,1);g.fillCircle(x+6*s,y-14*s,3*s);}
  else if(a==='cat'){g.fillStyle(0x9aa0b4,1);g.fillCircle(x,y,12*s);g.fillCircle(x,y-10*s,7*s);
   g.beginPath();g.moveTo(x-6*s,y-14*s);g.lineTo(x-2*s,y-20*s);g.lineTo(x-1*s,y-13*s);g.closePath();g.fillPath();
   g.beginPath();g.moveTo(x+6*s,y-14*s);g.lineTo(x+2*s,y-20*s);g.lineTo(x+1*s,y-13*s);g.closePath();g.fillPath();}
  else{g.fillStyle(0x4dc9ff,1);g.fillCircle(x,y,10*s);g.fillStyle(0xffd76a,1);
   g.beginPath();g.moveTo(x+9*s,y-2*s);g.lineTo(x+16*s,y);g.lineTo(x+9*s,y+2*s);g.closePath();g.fillPath();}
 }
}
