import Phaser from 'phaser';
import {state,setLights} from './state';
import {loadSave,storeSave} from '../systems/save';
import {pickPuzzle,hintLevel,Puzzle,PUZZLES} from '../systems/puzzles';
import {drawAurora} from '../fx/aurora';
import {drawDiorama} from '../fx/diorama';
import {drawMascot} from '../fx/mascot';
import {drawPost} from '../fx/post';
import narrativeData from '../content/narrative.json';
import {speak} from '../systems/tts';
type Animal='dog'|'cat'|'bird';

/* Vertical Slice data-driven: תנועה -> חידה מה-JSON -> שער -> אור -> העולם מתעורר -> save */
export class GameScene extends Phaser.Scene{
 private bg!:Phaser.GameObjects.Graphics;private dio!:Phaser.GameObjects.Graphics;
 private mg!:Phaser.GameObjects.Graphics;private fg!:Phaser.GameObjects.Graphics;
 private mx=0;private my=0;private baseY=0;private vx=0;private vy=0;
 private puzzleOpen=false;private gateOpen=false;private won=0;private fails=0;
 private puzzle:Puzzle|null=null;
 private onboard=false;
 private qText!:Phaser.GameObjects.Text;
 private narrText!:Phaser.GameObjects.Text;
 private pg!:Phaser.GameObjects.Graphics;private optTexts:Phaser.GameObjects.Text[]=[];
 private xs:number[]=[];
 constructor(){super('game');}
 create(){
  const sv=loadSave();setLights(sv.lights);
  this.onboard=!sv.onboarded;
  (window as any).__screen='game';
  const w=this.scale.width,h=this.scale.height;this.baseY=h*0.62;
  this.bg=this.add.graphics();this.dio=this.add.graphics();this.mg=this.add.graphics();this.fg=this.add.graphics();this.pg=this.add.graphics();
  this.mx=w*0.2;this.my=this.baseY;
  this.xs=[0.3,0.5,0.7].map(f=>f*w);
  this.qText=this.add.text(w/2,h*0.26,'',{fontFamily:'Heebo',fontSize:'28px',color:'#FFF6EC'}).setOrigin(0.5);this.qText.setVisible(false);
  this.narrText=this.add.text(w/2,h*0.18,'',{fontFamily:'Heebo',fontSize:'16px',color:'#7dffb8'}).setOrigin(0.5);this.narrText.setVisible(false);
  for(let i=0;i<3;i++){const t=this.add.text(this.xs[i],h*0.45,'',{fontFamily:'Heebo',fontSize:'30px',color:'#FFD76A'}).setOrigin(0.5);t.setVisible(false);this.optTexts.push(t);}
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   if(this.puzzleOpen&&this.puzzle){const y=h*0.45;
    for(let i=0;i<3;i++){if(Math.abs(p.x-this.xs[i])<44&&Math.abs(p.y-y)<54){
      if(this.puzzle.options[i]===this.puzzle.target)this.win();else{this.fails++;state.emotion='frustrated';}
      return;}}
    return;}
   const fx=p.x/w;
   if(fx<0.34)this.vx=-240;else if(fx>0.66)this.vx=240;else this.vy=-260;
   if(this.onboard){this.onboard=false;storeSave({lights:state.lights,name:loadSave().name,onboarded:true});}
  });
  this.input.on('pointerup',()=>{this.vx=0;});
 }
 private openPuzzle(){const want=new URLSearchParams(location.search).get('puzzle');
  this.puzzle=(want?PUZZLES.find(q=>q.id===want):undefined)??pickPuzzle(state.lights);
  this.fails=0;this.puzzleOpen=true;speak(this.puzzle.prompt);
  this.qText.setText(this.puzzle.prompt);this.qText.setVisible(true);
  const nl=(narrativeData.narrative as string[])[this.puzzle.world]||'';
  this.narrText.setText(nl);this.narrText.setVisible(true);
  (window as any).__narrative=nl;
  const showText=this.puzzle.type==='count'||this.puzzle.type==='letter'||this.puzzle.type==='time';
  this.optTexts.forEach((t,i)=>{if(showText){t.setText(String(this.puzzle!.options[i]));t.setVisible(true);}else t.setVisible(false);});}
 private win(){this.puzzleOpen=false;this.gateOpen=true;this.won=this.time.now;
  setLights(state.lights+1);storeSave({lights:state.lights,name:loadSave().name});state.emotion='joy';speak('כָּבוֹד!');
  this.qText.setVisible(false);this.narrText.setVisible(false);this.optTexts.forEach(t=>t.setVisible(false));}
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
   if(this.mx>gx-90&&!this.puzzleOpen)this.openPuzzle();}
  if(this.puzzleOpen&&this.puzzle){this.fg.fillStyle(0x0a0416,0.6);this.fg.fillRect(0,0,w,h);
   const P=this.puzzle;
   if(P.type==='match')(P.options as Animal[]).forEach((a,i)=>this.drawAnimal(this.xs[i],h*0.45,1.4,a));
   else if(P.type==='count'){const n=P.target as number;for(let i=0;i<n;i++)this.drawFlower(w*0.35+i*36,h*0.32,1);}
   else if(P.type==='time')this.drawClock(w/2,h*0.3,P.target as number);
   else if(P.type!=='letter')P.options.forEach((o,i)=>this.drawOpt(this.xs[i],h*0.45,P.type,o as string));
   if(hintLevel(this.fails)>=1){const ci=this.puzzle.options.indexOf(this.puzzle.target);
    this.fg.lineStyle(3,0x7dffb8,0.9);this.fg.strokeCircle(this.xs[ci],h*0.45,46);}}
  drawPost(this.pg,w,h,Math.floor(t*2));
  if(this.onboard){this.fg.fillStyle(0xfff6ec,0.9);this.fg.fillTriangle(40,h*0.5,60,h*0.5-12,60,h*0.5+12);this.fg.fillTriangle(w-40,h*0.5,w-60,h*0.5-12,w-60,h*0.5+12);}
  if(this.won){const k=(this.time.now-this.won)/1000;
   if(k<1.2){this.fg.lineStyle(4,0xffd76a,1-k/1.2);this.fg.strokeCircle(this.mx,this.my-40,20+k*80);}}
  if(this.puzzle&&this.puzzleOpen){const ci=this.puzzle.options.indexOf(this.puzzle.target);(window as any).__correctX=this.xs[ci];}
  (window as any).__hintLevel=hintLevel(this.fails);
  (window as any).__onboard=this.onboard;
  (window as any).__puzzleOpen=this.puzzleOpen;
  (window as any).__lights=state.lights;
  (window as any).__lennyX=this.mx;
 }
 private drawOpt(x:number,y:number,type:string,o:string){const g=this.fg;
  if(type==='color'){const m:{[k:string]:number}={red:0xe74c3c,blue:0x4dc9ff,yellow:0xffd76a,green:0x7dffb8};g.fillStyle(m[o]??0xffffff,1);g.fillCircle(x,y,26);}
  else if(type==='size'){const r=o==='big'?30:o==='med'?22:14;g.fillStyle(0x7c4dff,1);g.fillCircle(x,y,r);}
  else if(type==='odd'){if(o==='square'){g.fillStyle(0x7dffb8,1);g.fillRect(x-20,y-20,40,40);}else{g.fillStyle(0x7dffb8,1);g.fillCircle(x,y,20);}}
  if(type==='music'){const yy=o==='high'?y-24:o==='mid'?y:y+24;g.fillStyle(0x4dc9ff,1);g.fillCircle(x,yy,10);g.lineStyle(2,0x4dc9ff,1);g.lineBetween(x+9,yy,x+9,yy-26);return;}
  else if(type==='emotion'){g.fillStyle(0xffe0c2,1);g.fillCircle(x,y,22);g.fillStyle(0x2a2140,1);g.fillCircle(x-7,y-4,3);g.fillCircle(x+7,y-4,3);g.lineStyle(2,0xc2405e,1);
   if(o==='happy'){g.beginPath();g.arc(x,y+6,8,0,Math.PI,false);g.strokePath();}else if(o==='sad'){g.beginPath();g.arc(x,y+12,8,Math.PI,0,true);g.strokePath();}else{g.lineBetween(x-8,y+8,x+8,y+8);}}}
 private drawClock(x:number,y:number,hour:number){const g=this.fg;g.fillStyle(0xfff6ec,1);g.fillCircle(x,y,26);g.lineStyle(3,0x2a2140,1);g.strokeCircle(x,y,26);
  const a=(hour%12)/12*Math.PI*2-Math.PI/2;g.lineBetween(x,y,x+Math.cos(a)*14,y+Math.sin(a)*14);g.lineBetween(x,y,x,y-12);}
 private drawFlower(x:number,y:number,s:number){const g=this.fg;
  g.fillStyle(0xff8bd4,1);for(let k=0;k<5;k++){const a=k/5*Math.PI*2;g.fillCircle(x+Math.cos(a)*6*s,y+Math.sin(a)*6*s,4*s);}
  g.fillStyle(0xffd76a,1);g.fillCircle(x,y,3.5*s);}
 private drawAnimal(x:number,y:number,s:number,a:Animal){const g=this.fg;
  if(a==='dog'){g.fillStyle(0x8d5a3b,1);g.fillCircle(x,y,12*s);g.fillCircle(x+9*s,y-8*s,7*s);g.fillStyle(0x5b3a24,1);g.fillCircle(x+6*s,y-14*s,3*s);}
  else if(a==='cat'){g.fillStyle(0x9aa0b4,1);g.fillCircle(x,y,12*s);g.fillCircle(x,y-10*s,7*s);
   g.beginPath();g.moveTo(x-6*s,y-14*s);g.lineTo(x-2*s,y-20*s);g.lineTo(x-1*s,y-13*s);g.closePath();g.fillPath();
   g.beginPath();g.moveTo(x+6*s,y-14*s);g.lineTo(x+2*s,y-20*s);g.lineTo(x+1*s,y-13*s);g.closePath();g.fillPath();}
  else{g.fillStyle(0x4dc9ff,1);g.fillCircle(x,y,10*s);g.fillStyle(0xffd76a,1);
   g.beginPath();g.moveTo(x+9*s,y-2*s);g.lineTo(x+16*s,y);g.lineTo(x+9*s,y+2*s);g.closePath();g.fillPath();}}
}
