import { stateManager } from '../core/StateManager';
import { events } from '../core/EventBus';

/* מקור האמת היחיד — כעת מגובה על ידי StateManager המרכזי */
export interface WorldState{lights:number;emotion:'calm'|'joy'|'frustrated';world:number;}

/* אובייקט חי שמתעדכן אוטומטית מה-StateManager (backward compat) */
export const state:WorldState = stateManager.get();

/* סנכרון אוטומטי: כל שינוי ב-StateManager מתעדכן לאובייקט הישן */
events.on('state:lights:changed',(l:number)=>{state.lights=l;});
events.on('state:emotion:changed',(e:WorldState['emotion'])=>{state.emotion=e;});
events.on('state:world:changed',(w:number)=>{state.world=w;});

export function setLights(n:number){stateManager.setLights(n);}
export function setEmotion(e:WorldState['emotion']){stateManager.setEmotion(e);}
export function setWorld(w:number){stateManager.setWorld(w);}

type L=()=>void;
const listeners=new Set<L>();
events.on('state:lights:changed',()=>listeners.forEach(f=>f()));
events.on('state:emotion:changed',()=>listeners.forEach(f=>f()));
events.on('state:world:changed',()=>listeners.forEach(f=>f()));

export function subscribe(f:L){listeners.add(f);return()=>{listeners.delete(f);};}
