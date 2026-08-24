import Phaser from 'phaser';
/* polish: grain עדין + זוהר עליון — מוריד את ה"דיגיטלי הזול" */
export function drawPost(g:Phaser.GameObjects.Graphics,w:number,h:number,seed:number){
 g.clear();
 for(let i=0;i<70;i++){
  const x=((i*131+seed*17)%w);const y=((i*197+seed*29)%h);
  g.fillStyle(0xffffff,0.03);g.fillRect(x,y,1.5,1.5);}
 g.fillStyle(0xffd76a,0.05);g.fillRect(0,0,w,h*0.12);
}
