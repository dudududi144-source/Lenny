/* ============================================================
 * SkillBridge — connects GameSpec.skills to SkillGraph acquisition.
 *
 * The SkillGraph defines WHAT leads to WHAT (recognize the letter
 * before hearing its sound, hear sounds before syllables...). The
 * GameSpecs declare which skills each game trains. Until now the
 * two never met. This bridge maps a spec-level skill id to its
 * graph node, so real play can acquire real nodes — and the
 * ParentLens skill progress stops being decorative.
 *
 * Design notes:
 *  - Mapping is data, not logic: add rows as the graph expands.
 *  - Unknown skills are ignored (forward-compatible with specs
 *    authored for graphs that do not exist yet).
 *  - Acquisition persists via SkillGraph's own localStorage key.
 * ============================================================ */

import { SkillGraph, LITERACY_GRAPH } from './SkillGraph';
import { LearningSignals } from './LearningSignals';
import { GameSpec } from '../builder/GameSpec';

/** Maps GameSpec skill identifiers to SkillGraph node IDs. */
const SKILL_TO_NODE: Record<string, string> = {
  'letter.alef': 'recognize-alef',
  'letter.bet': 'recognize-bet',
  'sound.alef': 'sound-alef',
  'sound.bet': 'sound-bet',
  /* Add more rows as SkillGraph expands */
};

export class SkillBridge {
  private graph: SkillGraph;

  constructor(signals?: LearningSignals) {
    this.graph = new SkillGraph(LITERACY_GRAPH);
    if (signals) {
      /* Acquisition is gated on LearningSignals' MASTERY_AFTER (3
         cumulative correct attempts per skill) -- never on a single
         success. One recognition is luck; three is mastery.
         The bridge SHARES the scene's signals instance -- it must
         never create its own: two instances writing the same
         localStorage key would erase each other's events. */
      signals.onMastery((skill) => this.onSkillMastered(skill));
    }
  }

  /** Called when a child shows mastery of a skill in a game. */
  onSkillMastered(skill: string): void {
    const nodeId = SKILL_TO_NODE[skill];
    if (nodeId) this.graph.acquire(nodeId);
  }

  /** Extract skills from a GameSpec and map to graph nodes. */
  specSkills(spec: GameSpec): string[] {
    return spec.skills
      .map((s) => SKILL_TO_NODE[s])
      .filter((n): n is string => !!n);
  }

  /** What percentage of the graph is acquired? */
  progress(): number {
    return this.graph.progress();
  }
}
