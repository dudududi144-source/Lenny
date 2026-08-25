/* ============================================================
 * GameFactory — turns a GameSpec into a runnable Phaser scene.
 *
 * This is the engine of the multi-capable game builder.
 * Given a spec, it assembles a scene from the reusable fx
 * systems and wires in the cognitive core. The result is a
 * self-contained scene that:
 *   - introduces itself via Lenny's voice (DialogueBox)
 *   - adapts difficulty via AdaptiveDifficulty
 *   - reports to PlayerModel + LearningSignals
 *   - celebrates via ParticleBurst
 *
 * Mapping kind -> template scene:
 *   memory-pairs  -> MemoryPairsScene
 *   find-target   -> GlowFishScene
 *   sort-order    -> AcornSortScene
 *   match-shadow  -> KiteMatchScene
 *   letter-find   -> FindLetterScene
 *   emotion-name  -> EmotionFaceScene
 *   paint-fill    -> BeePaintScene
 *   rhythm-tap    -> DrumBeatScene
 *   breath-guide  -> LennyStoryScene
 *   open-create   -> (future OpenEndedScene)
 * ============================================================ */

import Phaser from 'phaser';
import { GameSpec, GameKind } from './GameSpec';

/** Which Phaser scene key implements each game kind. */
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
  'open-create': 'bee-paint', /* until a dedicated open scene exists */
};

export class GameFactory {
  /** Resolve the Phaser scene key for a spec. */
  static sceneKey(spec: GameSpec): string {
    return KIND_TO_SCENE[spec.kind];
  }

  /**
   * Start a game from its spec.
   * Passes the spec into the scene via the Phaser scene data bag,
   * so template scenes can read narrative + params without coupling.
   */
  static start(scene: Phaser.Scene, spec: GameSpec): void {
    const key = GameFactory.sceneKey(spec);
    scene.scene.start(key, { spec });
  }

  /**
   * Validate a spec before use (catches authoring mistakes early).
   * Returns a list of problems; empty list = spec is healthy.
   */
  static validate(spec: GameSpec): string[] {
    const problems: string[] = [];
    if (!spec.id) problems.push('missing id');
    if (!spec.zone) problems.push('missing zone');
    if (!spec.kind) problems.push('missing kind');
    if (!KIND_TO_SCENE[spec.kind]) problems.push('unknown kind: ' + spec.kind);
    if (!spec.narrative || !spec.narrative.intro || spec.narrative.intro.length === 0) {
      problems.push('missing narrative.intro');
    }
    if (!spec.skills || spec.skills.length === 0) problems.push('missing skills');
    if (spec.baseTier < 0 || spec.baseTier > 3) problems.push('baseTier out of range');
    return problems;
  }
}
