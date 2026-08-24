import Phaser from 'phaser';
import {loadSave} from '../systems/save';
import {state} from '../game/state';
/* ParentLens — דשבורד הורים מאותו state store (שקיפות, לא דוח מנופח) */
export class ParentsScene extends Phaser.Scene{
 constructor(){super('parents');}
 create(){
  (window as any).__screen='parents';
  const sv=loadSave();const w=this.scale.width,h=this.scale.height;
  this.add.rectangle(w/2,h/2,w,h,0x0a0416);
  this.add.text(w/2,h*0.12,'פִּנַּת הַהוֹרִים',{fontFamily:'Heebo',fontSize:'28px',color:'#FFF6EC'}).setOrigin(0.5);
  const lines=[
   'אוֹרוֹת: '+state.lights+'/10',
   'התקדמות: '+Math.round(state.lights*10)+'%',
   'מיומנויות שנתקלו: חיות, מספרים',
   'מגבלת זמן: '+(sv.limit?sv.limit+' דק׳':'כבויה')];
  this.add.text(w/2,h*0.32,lines.join('\n'),{fontFamily:'Heebo',fontSize:'20px',color:'#FFF6EC',align:'center'}).setOrigin(0.5);
  (window as any).__parentsLines=lines.length;
 }
}
