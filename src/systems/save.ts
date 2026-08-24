/* systems/save — שמירה מקומית בטוחה (אפס מעקב) */
const KEY='lenny-save-v1';
export interface Save{lights:number;name:string;}
export function loadSave():Save{try{const r=localStorage.getItem(KEY);if(r)return JSON.parse(r) as Save;}catch{/* noop */}return{lights:0,name:''};}
export function storeSave(s:Save){try{localStorage.setItem(KEY,JSON.stringify(s));}catch{/* noop */}}
