import Phaser from 'phaser';
import tokens from '../tokens.json';
/* Design System specimen — מציג פלטה/טיפוגרפיה/רדיוסים מהטוקנים בלבד */
export class DesignScene extends Phaser.Scene{
 constructor(){super('design');}
 create(){
  const g=this.add.graphics();
  const w=this.scale.width,h=this.scale.height;
  g.fillStyle(parseInt(tokens.colors.cream.slice(1),16),1);g.fillRect(0,0,w,h);
  const cols=Object.values(tokens.colors);
  cols.forEach((hex,i)=>{g.fillStyle(parseInt(hex.slice(1),16),1);
    g.fillRoundedRect(16+(i%5)*64, 32+Math.floor(i/5)*64, 52,52, tokens.radius.s);});
  let y=200;
  tokens.type.forEach(s=>{this.add.text(16,y,'אָבָג דֹּרֶךְ '+s,{fontFamily:'Heebo',fontSize:s+'px',color:'#'+tokens.colors.ink.slice(1)});y+=s+16;});
  // רדיוסים
  let rx=16;
  (['s','m','l'] as const).forEach(k=>{g.fillStyle(parseInt(tokens.colors.violet.slice(1),16),1);
    g.fillRoundedRect(rx,h-90,64,64,tokens.radius[k]);rx+=80;});
 }
}
