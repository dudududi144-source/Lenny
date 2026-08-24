import {state,subscribe} from './state';
/* מוזיקה אדפטיבית (Web Audio): שכבות נוספות עם כל אור — העולם מתעורר גם בסאונד */
let ctx:AudioContext|null=null;let master:GainNode|null=null;let started=false;
export function audioLayers(){return Math.min(5,1+Math.floor(state.lights/2));}
export function audioStarted(){return started;}
function note(f:number,dur:number,vol:number){if(!ctx||!master)return;
 const o=ctx.createOscillator();const g=ctx.createGain();
 o.type='sine';o.frequency.value=f;
 g.gain.setValueAtTime(0,ctx.currentTime);
 g.gain.linearRampToValueAtTime(vol,ctx.currentTime+0.02);
 g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
 o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+dur+0.05);}
export function startAudio(){try{
 if(started)return;
 const AC=(window as any).AudioContext||(window as any).webkitAudioContext;if(!AC)return;
 ctx=new AC();master=ctx.createGain();master.gain.value=0.15;master.connect(ctx.destination);
 started=true;let beat=0;
 const scale=[261.6,293.7,329.6,392,440,523.3];
 setInterval(()=>{if(!ctx||!master)return;const L=audioLayers();
  note(scale[beat%scale.length],0.25,0.5);
  if(L>=2)note(scale[(beat+2)%scale.length]/2,0.3,0.4);
  if(L>=3)note(scale[(beat+4)%scale.length]*2,0.15,0.3);
  if(L>=4)note(scale[(beat+3)%scale.length]*1.5,0.12,0.25);
  beat++;},450);
 (window as any).__audioStarted=true;
}catch{/* noop */}}
(window as any).__getAudioLayers=()=>audioLayers();
subscribe(()=>{(window as any).__audioLayersNow=audioLayers();});
