import {state,subscribe} from '../game/state';
let ctx:AudioContext|null=null;let master:GainNode|null=null;let started=false;
export function audioLayers(){return Math.min(5,1+Math.floor(state.lights/2));}
export function audioStarted(){return started;}
function note(f:number,dur:number,vol:number){const c=ctx,m=master;if(!c||!m)return;
 const o=c.createOscillator();const g=c.createGain();
 o.type='sine';o.frequency.value=f;
 g.gain.setValueAtTime(0,c.currentTime);
 g.gain.linearRampToValueAtTime(vol,c.currentTime+0.02);
 g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
 o.connect(g);g.connect(m);o.start();o.stop(c.currentTime+dur+0.05);}
export function startAudio(){try{
 if(started)return;
 const AC=(window as any).AudioContext||(window as any).webkitAudioContext;if(!AC)return;
 const c=new AC() as AudioContext;ctx=c;
 const m=c.createGain();m.gain.value=0.15;m.connect(c.destination);master=m;
 started=true;let beat=0;
 const scale=[261.6,293.7,329.6,392,440,523.3];
 setInterval(()=>{const L=audioLayers();
  note(scale[beat%scale.length],0.25,0.5);
  if(L>=2)note(scale[(beat+2)%scale.length]/2,0.3,0.4);
  if(L>=3)note(scale[(beat+4)%scale.length]*2,0.15,0.3);
  if(L>=4)note(scale[(beat+3)%scale.length]*1.5,0.12,0.25);
  beat++;},450);
 (window as any).__audioStarted=true;
}catch{/* noop */}}
(window as any).__getAudioLayers=()=>audioLayers();
subscribe(()=>{(window as any).__audioLayersNow=audioLayers();});
