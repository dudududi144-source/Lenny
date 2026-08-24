import Phaser from 'phaser';
import {state} from '../game/state';
import {drawAurora} from '../fx/aurora';
import {drawDiorama} from '../fx/diorama';
import {drawMascot} from '../fx/mascot';
export class TitleScene extends Phaser.Scene{
 private bg!:Phaser.GameObjects.Graphics;private dio!:Phaser.GameObjects.Graphics;private mg!:Phaser.GameObjects.Graphics;
 private btn={x:0,y:0,w:180,h:56};
 constructor(){super('title');}
 create(){
  (window as any).__screen='title';
  const q=new URLSearchParams(location.search).get('scene');
  if(q==='game'){this.scene.start('game');return;}
  if(q==='boot'){this.scene.start('boot');return;}
  if(q==='parents'){this.scene.start('parents');return;}
  if(q==='design'){this.scene.start('design');return;}
  const w=this.scale.width,h=this.scale.height;
  this.bg=this.add.graphics();this.dio=this.add.graphics();this.mg=this.add.graphics();this.fg=this.add.graphics();
  this.btn={x:w/2-90,y:h*0.78,w:180,h:56};
  this.add.text(w/2,h*0.2,'LENY',{fontFamily:'Heebo',fontSize:'56px',color:'#FFD76A'}).setOrigin(0.5);
  this.add.text(w/2,h*0.3,'גַּן שֶל אוֹרוֹת',{fontFamily:'Heebo',fontSize:'24px',color:'#FFF6EC'}).setOrigin(0.5);
  const bt=this.add.text(w/2,this.btn.y+28,'יוֹצְאִים לַמַּסָּע',{fontFamily:'Heebo',fontSize:'24px',color:'#2a2140'}).setOrigin(0.5);
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   if(p.x>this.btn.x&&p.x<this.btn.x+this.btn.w&&p.y>this.btn.y&&p.y<this.btn.y+this.btn.h)this.scene.start('hub');});
  this.events.on('update',(_t:number,d:number)=>this.render(d));
  void bt;
 }
 private fg!:Phaser.GameObjects.Graphics;
 private render(time:number){const w=this.scale.width,h=this.scale.height;const t=time*0.001;
  drawAurora(this.bg,w,h,t,state.lights);drawDiorama(this.dio,w,h,t,w/2,state.lights);
  drawMascot(this.mg,w/2,h*0.62,1.2,t,state.emotion,0,true);
  if(!this.fg)this.fg=this.add.graphics();this.fg.clear();
  this.fg.fillStyle(0xffd76a,1);this.fg.fillRoundedRect(this.btn.x,this.btn.y,this.btn.w,this.btn.h,28);}
}
