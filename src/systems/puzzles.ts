import data from '../content/puzzles.json';
export type PuzzleType='match'|'count'|'color'|'size'|'odd'|'letter'|'emotion';
export interface Puzzle{id:string;world:number;type:PuzzleType;target:string|number;prompt:string;options:(string|number)[];}
/* טקסונומיה + scaffolding (ZPD) + תור spaced-repetition פשוט */
export const PUZZLES=data.puzzles as Puzzle[];
export function pickPuzzle(i:number){return PUZZLES[((i%PUZZLES.length)+PUZZLES.length)%PUZZLES.length];}
export function hintLevel(fails:number){return fails<=0?0:fails===1?1:2;} /* 0=ללא 1=הדגשה 2=רמז חזק */
