import type { GameKind, GameSpec } from '../builder/GameSpec';
import type { SceneCtx, GameScene } from '../engine/GameScene';
import { ComingSoonScene } from './ComingSoon';
import { GlowFishScene } from './GlowFish';
import { MemoryPairsScene } from './MemoryPairs';
import { AcornSortScene } from './AcornSort';
import { KiteMatchScene } from './KiteMatch';
import { FindLetterScene } from './FindLetter';
import { EmotionFaceScene } from './EmotionFace';
import { BeePaintScene } from './BeePaint';
import { DrumBeatScene } from './DrumBeat';
import { SequenceEchoScene } from './SequenceEcho';
import { BreathPoolScene } from './BreathPool';
import { PlayPathScene } from './PlayPath';
import { OpenCanvasScene } from './OpenCanvas';
import { RainbowOrderScene } from './RainbowOrder';
import { ShapeShadowScene } from './ShapeShadow';
import { StarConnectScene } from './StarConnect';
import { WindChimeScene } from './WindChime';
import { LeafSizeScene } from './LeafSize';

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

/* stage 15-C: the five new unique scenes do NOT own a kind — they ride
   existing kinds ('sort-order' / 'match-shadow' / 'sequence-echo') and
   pin their scene via spec.params.extra.scene (the light-path-play-1
   pattern), so the builder's kind union stays frozen. */

export type SceneFactory = (ctx: SceneCtx) => GameScene;

/** scene key → factory. Every zone game is now rebuilt on PixiJS. */
export const SCENE_REGISTRY: Record<string, SceneFactory> = {
  'coming-soon': (ctx) => new ComingSoonScene(ctx),
  'play': (ctx) => new PlayPathScene(ctx),
  'memory-pairs': (ctx) => new MemoryPairsScene(ctx),
  'sequence-echo': (ctx) => new SequenceEchoScene(ctx),
  'glow-fish': (ctx) => new GlowFishScene(ctx),
  'acorn-sort': (ctx) => new AcornSortScene(ctx),
  'kite-match': (ctx) => new KiteMatchScene(ctx),
  'find-letter': (ctx) => new FindLetterScene(ctx),
  'emotion-face': (ctx) => new EmotionFaceScene(ctx),
  'bee-paint': (ctx) => new BeePaintScene(ctx),
  'open-create': (ctx) => new OpenCanvasScene(ctx),
  'drum-beat': (ctx) => new DrumBeatScene(ctx),
  'lenny-story': (ctx) => new BreathPoolScene(ctx),
  /* stage 15-C — the content flood */
  'rainbow-order': (ctx) => new RainbowOrderScene(ctx),
  'shape-shadow': (ctx) => new ShapeShadowScene(ctx),
  'star-connect': (ctx) => new StarConnectScene(ctx),
  'wind-chime': (ctx) => new WindChimeScene(ctx),
  'leaf-size': (ctx) => new LeafSizeScene(ctx),
};

export function sceneKeyForSpec(spec: GameSpec): string {
  /* Stage 6: a spec may pin its unique legacy scene explicitly
     (e.g. PlayPath mapped to kind 'open-create' but routed to 'play').
     Unknown overrides fall through to the coming-soon guard in GameHost. */
  const override = spec.params?.extra?.scene;
  if (typeof override === 'string' && override.length > 0) return override;
  return KIND_TO_SCENE[spec.kind];
}

export function sceneKeyForZone(zoneId: string, gameScene: string | undefined): string | null {
  if (gameScene) return gameScene;
  return null;
}
