import {state,subscribe} from '../game/state';
/* מוזיקה אדפטיבית: שכבות לפי אורות + גוון/כלי ייחודי לכל עולם */
let ctx:AudioContext|null=null;let master:GainNode|null=null;let started=false;
export function audioLayers(){return Math.min(5,1+Math.floor(state.lights/2));}
export function audioStarted(){return started;}
export function worldTimbre(){const types:OscillatorType[]=['sine','triangle','square','sawtooth'];
 return {type:types[((state.world%4)+4)%4], root:261.6*(1+(((state.world%5)+5)%5)*0.12)};}
function note(f:number,dur:number,vol:number,type:OscillatorType){const c=ctx,m=master;if(!c||!m)return;
 const o=c.createOscillator();const g=c.createGain();
 o.type=type;o.frequency.value=f;
 g.gain.setValueAtTime(0,c.currentTime);
 g.gain.linearRampToValueAtTime(vol,c.currentTime+0.02);
 g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
 o.connect(g);g.connect(m);o.start();o.stop(c.currentTime+dur+0.05);}
export function startAudio(){try{
 if(started)return;
 const AC=(window as any).AudioContext||(window as any).webkitAudioContext;if(!AC)return;
 ctx=new AC();master=ctx.createGain();master.gain.value=0.15;master.connect(ctx.destination);
 started=true;let beat=0;
 const mult=[1,9/8,5/4,3/2,5/3,2];
 setInterval(()=>{const c=ctx;if(!c||!master)return;const L=audioLayers();const tim=worldTimbre();
  note(tim.root*mult[beat%6],0.25,0.5,tim.type);
  if(L>=2)note(tim.root*mult[(beat+2)%6]/2,0.3,0.4,tim.type);
  if(L>=3)note(tim.root*mult[(beat+4)%6]*2,0.15,0.3,'sine');
  if(L>=4)note(tim.root*mult[(beat+3)%6]*1.5,0.12,0.25,'sine');
  beat++;},450);
 (window as any).__audioStarted=true;
}catch{/* noop */}}
(window as any).__getAudioLayers=()=>audioLayers();
(window as any).__getAudioTimbre=()=>worldTimbre().type;
subscribe(()=>{(window as any).__audioLayersNow=audioLayers();});
