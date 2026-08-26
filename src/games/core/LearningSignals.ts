/* ============================================================
 * LearningSignals — measure what the child actually learned.
 *
 * Win/lose is a terrible proxy for learning. This system records
 * the *shape* of a session: error kinds, reaction times, retry
 * behaviour, and hint usage. That signal is what lets the
 * platform (and the ParentLens) speak honestly about growth.
 *
 * Design notes (the exemplar part):
 *  - Append-only event stream per session, capped in size.
 *  - Derived summaries computed on demand, never stored stale.
 *  - Error taxonomy is generic (kind + detail) so every game
 *    can emit signals without coupling.
 * ============================================================ */

export type SignalKind =
  | 'attempt'      /* an answer was given */
  | 'error-type'   /* a specific wrong-answer category */
  | 'hint-used'    /* the child took a hint */
  | 'retry'        /* the child tried again */
  | 'idle'         /* the child paused / disengaged */
  | 'mastery'      /* repeated clean success */
  | 'breakthrough'; /* first-ever success on a skill */

export interface LearningEvent {
  t: number;         /* ms timestamp */
  kind: SignalKind;
  skill: string;     /* what skill this touches, e.g. 'letter.bet' */
  detail?: string;   /* free-form, e.g. error category */
  reactionMs?: number;
}

export interface SessionSummary {
  attempts: number;
  correct: number;
  hints: number;
  retries: number;
  avgReactionMs: number;
  errorKinds: Record<string, number>;
  masteredSkills: string[];
}

const SIG_KEY = 'lenny-signals-v1';

export class LearningSignals {
  private events: LearningEvent[] = [];
  private correctSkills: Record<string, number> = {};
  private readonly MASTERY_AFTER = 3;
  private readonly CAP = 400;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SIG_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.events)) this.events = s.events;
        if (s && s.correctSkills) this.correctSkills = s.correctSkills;
      }
    } catch { /* fresh */ }
  }

  private save(): void {
    try {
      localStorage.setItem(SIG_KEY, JSON.stringify({ events: this.events, correctSkills: this.correctSkills }));
    } catch { /* noop */ }
  }

  /** Log an answer attempt. */
  attempt(skill: string, correct: boolean, reactionMs?: number): void {
    this.push({ t: Date.now(), kind: 'attempt', skill, reactionMs, detail: correct ? 'correct' : 'wrong' });
    if (correct) {
      this.correctSkills[skill] = (this.correctSkills[skill] || 0) + 1;
      if (this.correctSkills[skill] === this.MASTERY_AFTER) {
        this.push({ t: Date.now(), kind: 'mastery', skill });
      }
    }
  }

  /** Log a wrong-answer category (e.g. 'confused-bet-kaf'). */
  errorKind(skill: string, kind: string): void {
    this.push({ t: Date.now(), kind: 'error-type', skill, detail: kind });
  }

  hintUsed(skill: string): void {
    this.push({ t: Date.now(), kind: 'hint-used', skill });
  }

  retry(skill: string): void {
    this.push({ t: Date.now(), kind: 'retry', skill });
  }

  idle(durationMs: number): void {
    this.push({ t: Date.now(), kind: 'idle', skill: 'session', reactionMs: durationMs });
  }

  /** First-time success on a skill this child never got before. */
  breakthrough(skill: string): void {
    this.push({ t: Date.now(), kind: 'breakthrough', skill });
  }

  /** Compute the session summary on demand. */
  summarize(): SessionSummary {
    let attempts = 0, correct = 0, hints = 0, retries = 0;
    let reactionSum = 0, reactionN = 0;
    const errorKinds: Record<string, number> = {};
    const mastered: string[] = [];

    for (const e of this.events) {
      if (e.kind === 'attempt') {
        attempts++;
        if (e.detail === 'correct') correct++;
        if (typeof e.reactionMs === 'number') { reactionSum += e.reactionMs; reactionN++; }
      } else if (e.kind === 'hint-used') hints++;
      else if (e.kind === 'retry') retries++;
      else if (e.kind === 'error-type' && e.detail) {
        errorKinds[e.detail] = (errorKinds[e.detail] || 0) + 1;
      } else if (e.kind === 'mastery') mastered.push(e.skill);
    }

    return {
      attempts,
      correct,
      hints,
      retries,
      avgReactionMs: reactionN > 0 ? Math.round(reactionSum / reactionN) : 0,
      errorKinds,
      masteredSkills: mastered,
    };
  }

  private push(e: LearningEvent): void {
    this.events.push(e);
    if (this.events.length > this.CAP) this.events.shift();
    this.save();
  }
}
