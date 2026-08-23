import Phaser from 'phaser';
import {state} from './game/state';
import tokens from './tokens.json';

/* Boot — הוכחת יכולת: רקע חי + mascot מגיב למגע (CANVAS כדי שהבדיקות יראו פיקסלים) */
class BootScene extends Phaser.Scene{
 private mascot!:Phaser.GameObjects.Arc;
 private vx=0;private baseY=0;
 constructor(){super('boot');}
 create(){
  const w=this.scale.width,h=this.scale.height;
  this.baseY=h*0.62;
  this.mascot=this.add.circle(w/2,this.baseY,26,0xf2549a);
  (window as any).__lennyX=this.mascot.x;
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   const fx=p.x/this.scale.width;
   if(fx<0.34)this.vx=-240;else if(fx>0.66)this.vx=240;else this.mascot.y=this.baseY-60;
  });
  this.input.on('pointerup',()=>{this.vx=0;});
 }
 update(time:number){
  const dt=this.game.loop.delta/1000;
  const w=this.scale.width;
  this.cameras.main.setBackgroundColor(tokens.colors.night);
  this.mascot.x=Phaser.Math.Clamp(this.mascot.x+this.vx*dt,30,w-30);
  this.mascot.y+= (this.baseY-this.mascot.y)*Math.min(1,dt*4);
  (window as any).__lennyX=this.mascot.x;
  (window as any).__lights=state.lights;
 }
}

new Phaser.Game({
 type:Phaser.CANVAS,
 parent:'game',
 backgroundColor:tokens.colors.night,
 scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
 scene:[BootScene]
});
