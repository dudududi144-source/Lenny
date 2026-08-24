import Phaser from 'phaser';
import {state,setLights,setEmotion} from './game/state';
import {DesignScene} from './ui/DesignScene';
import {drawAurora} from './fx/aurora';
import {drawDiorama} from './fx/diorama';
import {drawMascot} from './fx/mascot';
import {GameScene} from './game/GameScene';
import {startAudio} from './systems/audio';
import {TitleScene} from './ui/TitleScene';
import {HubScene} from './ui/HubScene';
import {ParentsScene} from './ui/ParentsScene';
import {WinScene} from './ui/WinScene';
import tokens from './tokens.json';

/* Boot — הוכחת יכולת: רקע חי + mascot מגיב למגע (CANVAS כדי שהבדיקות יראו פיקסלים) */
class BootScene extends Phaser.Scene{
 private mg!:Phaser.GameObjects.Graphics;
 private bg!:Phaser.GameObjects.Graphics;
 private dio!:Phaser.GameObjects.Graphics;
 private mx=0;private my=0;private baseY=0;private vx=0;private vy=0;
 constructor(){super('boot');}
 create(){
  if(new URLSearchParams(location.search).get('scene')==='design'){this.scene.start('design');return;}
  if(new URLSearchParams(location.search).get('scene')==='game'){this.scene.start('game');return;}
  const w=this.scale.width,h=this.scale.height;
  this.baseY=h*0.62;
  this.bg=this.add.graphics();
  this.dio=this.add.graphics();
  this.mg=this.add.graphics();
  this.mx=w/2;this.my=this.baseY;
  (window as any).__lennyX=this.mx;
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   const fx=p.x/this.scale.width;
   if(fx<0.34)this.vx=-240;else if(fx>0.66)this.vx=240;else this.vy=-260;
  });
  this.input.on('pointerup',()=>{this.vx=0;});
 }
 update(time:number){
  const dt=this.game.loop.delta/1000;
  const w=this.scale.width,h=this.scale.height;
  drawAurora(this.bg,w,h,time*0.001,state.lights);
  drawDiorama(this.dio,w,h,time*0.001,this.mx,state.lights);
  this.mx=Phaser.Math.Clamp(this.mx+this.vx*dt,30,w-30);
  this.vy+=900*dt;this.my=Math.min(this.baseY,this.my+this.vy*dt);
  if(this.my>=this.baseY)this.vy=0;
  const onG=this.my>=this.baseY-1;
  drawMascot(this.mg,this.mx,this.my,1.2,time*0.001,state.emotion,this.vy,onG);
  (window as any).__lennyX=this.mx;
  (window as any).__lights=state.lights;
  (window as any).__emotion=state.emotion;
 }
}

/* טוקנים → CSS vars (לשימוש UI DOM בהמשך) */
const root=document.documentElement;
Object.entries(tokens.colors).forEach(([k,v])=>root.style.setProperty('--ln-'+k,v as string));
tokens.spacing.forEach((s,i)=>root.style.setProperty('--ln-sp'+i,s+'px'));
tokens.type.forEach((s,i)=>root.style.setProperty('--ln-fs'+i,s+'px'));
(window as any).__setLights=setLights;
(window as any).__setEmotion=setEmotion;
document.addEventListener('pointerdown',()=>startAudio());

new Phaser.Game({
 type:Phaser.CANVAS,
 parent:'game',
 backgroundColor:tokens.colors.night,
 scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
 scene:[TitleScene,HubScene,GameScene,ParentsScene,WinScene,BootScene,DesignScene]
});
