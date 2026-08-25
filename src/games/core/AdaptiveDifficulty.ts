/* ============================================================
 * AdaptiveDifficulty — the cognitive heart of the platform.
 *
 * Dynamic Difficulty Adjustment (DDA) built around the Zone of
 * Proximal Development: keep each child between boredom and
 * frustration. Skill is an exponential moving average of recent
 * outcomes, with streak momentum and a frustration cooldown that
 * protects emotional safety (see docs/ETHICS.md).
 *
 * Scenes map the continuous level (0..1) onto their own knobs:
 *   memory  -> number of pairs
 *   timing  -> fall speed
 *   vision  -> number of distractors
 * ============================================================ */

const STORE_KEY = 'lenny-dda-v1';

interface ZoneRecord {
  skill: number;       /* estimated skill, 0..1 */
  streak: number;      /* + wins in a row / - losses in a row */
  rounds: number;      /* total rounds played in this zone */
  frustration: number; /* consecutive struggle events */
}

export type HintStrength = 'none' | 'gentle' | 'clear' | 'show';

export class AdaptiveDifficulty {
  private zone: string;
  private rec: ZoneRecord;

  private readonly EMA = 0.25;
  private readonly STREAK_PUSH = 0.02;
  private readonly FRUSTRATION_LIMIT = 3;

  constructor(zone: string) {
    this.zone = zone;
    this.rec = this.load(zone);
  }

  /** Record one round outcome. score in 0..1 = how clean the win was. */
  outcome(win: boolean, score: number = 1): void {
    const r = this.rec;
    r.rounds++;
    if (win) {
      r.frustration = 0;
      r.streak = r.streak >= 0 ? r.streak + 1 : 1;
      const target = Math.min(1, 0.5 + score * 0.5);
      const push = Math.min(r.streak, 4) * this.STREAK_PUSH;
      r.skill += (target - r.skill) * this.EMA + push;
    } else {
      r.streak = r.streak <= 0 ? r.streak - 1 : -1;
      const target = Math.max(0, r.skill - 0.25);
      r.skill += (target - r.skill) * this.EMA;
      if (r.streak <= -2) r.frustration++;
    }
    r.skill = Math.max(0, Math.min(1, r.skill));
    this.save();
  }

  /** Continuous difficulty level 0..1 (scenes map this to knobs). */
  level(): number {
    if (this.inCooldown()) return Math.max(0, this.rec.skill - 0.25);
    return this.rec.skill;
  }

  /** Discrete tier 0..3 for content selection. */
  tier(): number {
    const lv = this.level();
    if (lv < 0.25) return 0;
    if (lv < 0.5) return 1;
    if (lv < 0.75) return 2;
    return 3;
  }

  /** True while the frustration cooldown is active. */
  inCooldown(): boolean {
    return this.rec.frustration >= this.FRUSTRATION_LIMIT;
  }

  /** Release the cooldown after an eased round succeeds. */
  releaseCooldown(): void {
    this.rec.frustration = 0;
    this.save();
  }

  /** How strong a hint to offer, given recent fails. */
  suggestHint(recentFails: number): HintStrength {
    if (recentFails <= 0) return 'none';
    if (recentFails === 1) return 'gentle';
    if (recentFails === 2) return 'clear';
    return 'show';
  }

  /** Rounds played in this zone (feeds the parent lens). */
  roundsPlayed(): number {
    return this.rec.rounds;
  }

  private load(zone: string): ZoneRecord {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const all = JSON.parse(raw);
        if (all && all[zone]) return all[zone] as ZoneRecord;
      }
    } catch { /* fresh start */ }
    return { skill: 0.35, streak: 0, rounds: 0, frustration: 0 };
  }

  private save(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[this.zone] = this.rec;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch { /* noop */ }
  }
}
