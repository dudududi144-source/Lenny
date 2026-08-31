import type { GameKind, GameSpec } from '../builder/GameSpec';
import type { SceneCtx, GameScene } from '../engine/GameScene';
import { ComingSoonScene } from './ComingSoon';
import { GlowFishScene } from './GlowFish';

/* kind → scene key (mirrors builder/GameFactory's mapping without the
   Phaser dependency — the new shell must never import Phaser). */
const KIND_TO_SCENE: Record<GameKind, string> = {
  'memory-pairs': 'memory-pairs',
  'find-target': 'glow-fish',
  'sort-order': 'acorn-sort',
  'match-shadow': 'kite-match',
  'letter-find': 'find-letter',
  'emotion-name': 'emotion-face',
  'paint-fill': 'bee-paint',
  'rhythm-tap': 'drum-beat',
  'breath-guide': 'lenny-story',
  'open-create': 'open-create',
  'sequence-echo': 'sequence-echo',
};

export type SceneFactory = (ctx: SceneCtx) => GameScene;

/** scene key → factory. Filled in as Stage 3 rebuilds each game. */
export const SCENE_REGISTRY: Record<string, SceneFactory> = {
  'coming-soon': (ctx) => new ComingSoonScene(ctx),
  'glow-fish': (ctx) => new GlowFishScene(ctx),
};

export function sceneKeyForSpec(spec: GameSpec): string {
  return KIND_TO_SCENE[spec.kind];
}

export function sceneKeyForZone(zoneId: string, gameScene: string | undefined): string | null {
  if (gameScene) return gameScene;
  return null;
}
