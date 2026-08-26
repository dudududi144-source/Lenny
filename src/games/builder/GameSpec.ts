/* ============================================================
 * GameSpec — the contract for defining a game as DATA.
 *
 * This is the foundation of the multi-capable game builder.
 * Instead of writing a new scene for every game, a game is
 * described by a spec. The factory reads the spec and produces
 * a playable scene. New game = new data, not new code.
 *
 * A spec declares:
 *   - kind: which game template to use
 *   - skills: which cognitive skills it trains
 *   - zone: which garden zone it lives in
 *   - params: template-specific knobs (count, speed, etc.)
 *   - narrative: the story framing (Lenny's voice)
 *   - difficulty: how the DDA should treat it
 * ============================================================ */

import { GameCategory } from '../../data/games';

/** Which playable template this game is built from. */
export type GameKind =
  | 'memory-pairs'      /* flip cards to find matches */
  | 'find-target'       /* find the one that matches a cue */
  | 'sort-order'        /* arrange items in order */
  | 'match-shadow'      /* pair objects with their shadows */
  | 'rhythm-tap'        /* tap to a beat */
  | 'paint-fill'        /* fill shapes with chosen colors */
  | 'emotion-name'      /* name the feeling shown */
  | 'letter-find'       /* find a target letter */
  | 'breath-guide'      /* slow breathing with lights */
  | 'open-create'       /* no right answer — pure creation */
  | 'sequence-echo';    /* watch a growing pattern, repeat it back (working memory) */

export interface GameNarrative {
  /* Lenny's intro line(s) */
  intro: string[];
  /* line shown on success */
  win: string;
  /* gentle line shown on struggle */
  encourage: string;
}

export interface GameParams {
  /* generic knobs; templates read what they need */
  itemCount?: number;
  speed?: number;
  rounds?: number;
  /* allow the factory to pass arbitrary extras */
  extra?: Record<string, number | string | boolean>;
}

export interface GameSpec {
  id: string;
  kind: GameKind;
  /* which garden zone hosts this game */
  zone: string;
  /* cognitive category this game belongs to */
  category: GameCategory;
  /* skills this game trains (feed LearningSignals) */
  skills: string[];
  narrative: GameNarrative;
  params: GameParams;
  /* base difficulty tier 0..3 before DDA adjusts */
  baseTier: number;
  /* is this an open-ended creativity game (no wrong answer)? */
  openEnded: boolean;
}
