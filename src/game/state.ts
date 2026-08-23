/* מקור האמת היחיד — כל הרכיבים קוראים ממנו */
export interface WorldState{lights:number;emotion:'calm'|'joy'|'frustrated';}
type L=()=>void;
const listeners=new Set<L>();
export const state:WorldState={lights:0,emotion:'calm'};
export function setLights(n:number){state.lights=Math.max(0,Math.min(10,n));listeners.forEach(f=>f());}
export function setEmotion(e:WorldState['emotion']){state.emotion=e;listeners.forEach(f=>f());}
export function subscribe(f:L){listeners.add(f);return()=>{listeners.delete(f);};}
