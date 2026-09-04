/* ============================================================
 * FpsGovernor — the world's performance steward (pure logic).
 *
 * Stage 7 perf contract:
 *   - desktop ≥ 60fps, mid-range phones ≥ 30fps
 *   - CI floor: ≥ 20fps sustained for 10s
 *   - below 25fps → automatic hardware scaling (softer pixels,
 *     never a stall)
 *   - below 10fps sustained 8s → distress signal (the shell
 *     silently falls back to the classic garden). Stage 13 retune:
 *     real software renderers (SwiftShader cloud previews) hold a
 *     CALM garden at 10-15fps — that is playable, never distress;
 *     the old 15x5s floor kept killing healthy worlds on those
 *     devices ~11s after every entry.
 *
 * Stage 15-D adds the QUALITY TIER model on top (weak/standard/rich):
 *   - `weak`  — the device has proven nothing: the CURRENT visuals
 *     exactly (this is the CI floor + distress path, byte for byte),
 *     and the resolution lever may soften all the way to 3.6.
 *   - `standard` — fps held well above the floor: the governor-gated
 *     decorations (glow, shadows — their own >40/<30 gates unchanged)
 *     plus the cheap extras (cloud layers, more flowers, road
 *     sparkles, birds). Resolution cap tightens to 2.4.
 *   - `rich`  — desktop/strong GPU with real headroom: bigger shadow
 *     map, boosted glow, the fullest flora/fx budgets. Cap 1.3 —
 *     near-native pixels.
 *   - Tiers are EARNED by measured fps headroom with hysteresis and
 *     hold times, booting at `weak`: a device must PROVE itself for
 *     seconds before any new decoration is forced on, so a fast
 *     first frame (warm shader cache, empty scene) can never flip
 *     the model on. The tier NEVER touches the distress logic and
 *     the resolution scaling keeps working on ALL tiers — only the
 *     cap on "how soft may the pixels go" moves.
 *
 * Pure: the caller feeds frame times, the governor only decides.
 * WorldApp applies the decisions to the real engine.
 * ============================================================ */

export interface GovernorOptions {
  /** below this the resolution softens (auto hardware scaling) */
  softFps?: number;
  /** below this, sustained, the world is too heavy for the device */
  minFps?: number;
  /** how long fps may stay below minFps before distress (ms) */
  distressMs?: number;
  /** shader-compilation warmup: distress never arms during this */
  distressGraceMs?: number;
  /** hard cap for the hardware-scaling multiplier */
  maxScale?: number;
  /** how hard one scaling step pushes (1.15 = +15% softer pixels) */
  scaleStep?: number;
  /** the engine's base hardware scaling level (1 / min(dpr, 2)) */
  baseScale?: number;
  /** minimum interval between two scaling decisions (ms) */
  decisionMs?: number;
}

export interface GovernorDecision {
  /** what the hardware-scaling level should become */
  newScale: number;
  /** true exactly once when the sustained-low-fps budget is spent */
  distress: boolean;
}

const DEFAULTS = {
  softFps: 25,
  minFps: 10,
  distressMs: 8000,
  /** shader-compilation warmup: distress never arms during this */
  distressGraceMs: 6000,
  maxScale: 3.6,
  scaleStep: 1.15,
  baseScale: 1,
  decisionMs: 400,
  windowMs: 1500,
};

/* ---------- the stage 15-D quality tier model ---------- */

export type QualityTier = 'weak' | 'standard' | 'rich';

/**
 * Tier thresholds (all measured on the governor's trailing fps):
 *
 *   boot            → 'weak' (proven nothing; current visuals exactly)
 *   weak → standard : fps ≥ 26 held for 2.5s   (well clear of the floor)
 *   standard → rich : fps ≥ 52 held for 4.0s   (real headroom, not a fluke)
 *   rich → standard : fps < 40                 (instant, headroom is gone)
 *   standard → weak : fps < 17 held for 3.0s   (shed the extras, recover)
 *
 * Hysteresis by design: the enter/exit bands never overlap
 * (26↔17, 52↔40), so a device sitting on a threshold cannot flap
 * its tier — and every transition is downward-cheap / upward-earned.
 */
export const TIER_THRESHOLDS = {
  standardFps: 26,
  standardHoldMs: 2500,
  richFps: 52,
  richHoldMs: 4000,
  richExitFps: 40,
  weakExitFps: 17,
  weakHoldMs: 3000,
} as const;

/** The hardware-scaling cap per tier — "how soft may the pixels go".
 *  weak keeps the historical 3.6 (the CI floor's proven lever);
 *  stronger tiers earn tighter (sharper) caps. */
export function maxScaleForTier(tier: QualityTier, weakMax: number): number {
  if (tier === 'rich') return Math.min(1.3, weakMax);
  if (tier === 'standard') return Math.min(2.4, weakMax);
  return weakMax;
}

/**
 * The pure tier decision (unit-pinned). `candidate`/`candidateSince`
 * carry the hold-time state between calls; returns the next tier and
 * the updated hold state.
 */
export function nextQualityTier(
  current: QualityTier,
  fps: number,
  candidate: QualityTier,
  candidateSince: number | null,
  now: number,
): { tier: QualityTier; candidate: QualityTier; candidateSince: number | null } {
  /* fps 0 = no data (boot/warmup) — hold everything */
  if (fps <= 0) return { tier: current, candidate, candidateSince };

  const T = TIER_THRESHOLDS;
  let want: QualityTier | null = null;

  if (current === 'weak') {
    if (fps >= T.standardFps) want = 'standard';
  } else if (current === 'standard') {
    if (fps >= T.richFps) want = 'rich';
    else if (fps < T.weakExitFps) want = 'weak';
  } else {
    /* rich */
    if (fps < T.richExitFps) want = 'standard';
  }

  if (want === null || want === current) {
    /* the candidate ledger clears as soon as fps leaves its band */
    return { tier: current, candidate: current, candidateSince: null };
  }
  if (candidate !== want || candidateSince === null) {
    return { tier: current, candidate: want, candidateSince: now };
  }
  const hold = want === 'rich' ? T.richHoldMs : want === 'standard' ? T.standardHoldMs : T.weakHoldMs;
  if (now - candidateSince >= hold) {
    return { tier: want, candidate: want, candidateSince: now };
  }
  return { tier: current, candidate: want, candidateSince };
}

export class FpsGovernor {
  private readonly softFps: number;
  private readonly minFps: number;
  private readonly distressMs: number;
  private readonly distressGraceMs: number;
  private readonly maxScale: number;
  private readonly scaleStep: number;
  private readonly baseScale: number;
  private readonly decisionMs: number;
  private readonly windowMs: number;

  private frames: Array<{ t: number; dt: number }> = [];
  private lastDecision = 0;
  private distressSince: number | null = null;
  private distressed = false;
  private firstFrameAt: number | null = null;
  private prevDecisionFps = 0;
  /** a known-heavy spectacle (the balloon vista) is airborne */
  private spectacle = false;

  /* the quality tier (stage 15-D) — boot weak, earned upward */
  private tier: QualityTier = 'weak';
  private tierCandidate: QualityTier = 'weak';
  private tierCandidateSince: number | null = null;

  constructor(opts: GovernorOptions = {}) {
    const o = { ...DEFAULTS, ...opts };
    this.softFps = o.softFps;
    this.minFps = o.minFps;
    this.distressMs = o.distressMs;
    this.distressGraceMs = o.distressGraceMs;
    this.maxScale = o.maxScale;
    this.scaleStep = o.scaleStep;
    this.baseScale = o.baseScale;
    this.decisionMs = o.decisionMs;
    this.windowMs = o.windowMs;
  }

  /** Feed one rendered frame (timestamps in ms, monotonic-ish). */
  push(now: number, dtMs: number): void {
    if (this.firstFrameAt === null) this.firstFrameAt = now;
    this.frames.push({ t: now, dt: Math.max(0.001, dtMs) });
    const cutoff = now - this.windowMs;
    while (this.frames.length > 0 && this.frames[0].t < cutoff) this.frames.shift();
  }

  /** Average fps over the trailing window (0 when not enough data). */
  fps(now: number): number {
    const cutoff = now - 1000;
    let dtSum = 0;
    let n = 0;
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i];
      if (f.t < cutoff) break;
      dtSum += f.dt;
      n++;
    }
    if (n === 0 || dtSum <= 0) return 0;
    return (1000 * n) / dtSum;
  }

  /** The current quality tier (changes only inside evaluateTier). */
  qualityTier(): QualityTier {
    return this.tier;
  }

  /**
   * Advance the quality tier from measured fps (call at decision
   * cadence — the same interval that drives evaluate()). Hysteresis
   * + hold times per TIER_THRESHOLDS; boot tier is 'weak'.
   */
  evaluateTier(now: number): QualityTier {
    const fps = this.fps(now);
    const next = nextQualityTier(this.tier, fps, this.tierCandidate, this.tierCandidateSince, now);
    this.tier = next.tier;
    this.tierCandidate = next.candidate;
    this.tierCandidateSince = next.candidateSince;
    return this.tier;
  }

  /**
   * Decide once per `decisionMs`. Returns the scale to apply and a
   * one-shot distress flag (false again until the fps recovers above
   * `minFps` and the budget is spent anew).
   *
   * `tier` (stage 15-D) only tightens the scaling CAP — pass nothing
   * (or 'weak') for the exact historical behavior.
   */
  evaluate(now: number, currentScale: number, tier: QualityTier = 'weak'): GovernorDecision {
    let newScale = currentScale;
    let distress = false;

    if (now - this.lastDecision < this.decisionMs) return { newScale, distress };

    const fps = this.fps(now);
    this.lastDecision = now;
    const tierCap = maxScaleForTier(tier, this.maxScale);

    if (fps > 0) {
      if (fps < this.softFps) {
        /* the first softening steps are BIG: a wide desktop viewport
           needs the pixel floor within a couple of decisions, not a
           12-rung 1.15 ladder (stage 15: the world grew, the ladder
           had to keep up) */
        const step = currentScale < 2 ? Math.max(this.scaleStep, 1.4) : this.scaleStep;
        newScale = Math.min(tierCap, currentScale * step);
      } else if (fps > 55 && currentScale > this.baseScale) {
        newScale = Math.max(this.baseScale, currentScale * 0.94);
      }
      /* a tier that climbed while the pixels were soft walks the
         resolution back toward its (tighter) cap one gentle step at
         a time — never a single-frame pixel-count jump */
      if (newScale > tierCap) {
        newScale = Math.max(tierCap, newScale / this.scaleStep);
      }
    }

    /* stage 15: distress arms only when the pixels are ALREADY as soft
       as the tier allows — softening is the kind lever, and a wide
       desktop viewport needs a beat on the floor before the verdict */
    const atResolutionFloor = newScale >= tierCap - 1e-6;
    if (!this.spectacle && atResolutionFloor && fps > 0 && fps < this.minFps && this.firstFrameAt !== null && now - this.firstFrameAt >= this.distressGraceMs) {
      /* recovery-aware distress (audit 9-b follow-up): a weak device that
         is CLIMBING out of the hole (wide canvas booted 4→10→13fps and was
         still killed mid-recovery) gets its budget paused while the trend
         is up — only a stalled or falling fps below the floor is distress. */
      const improving = this.prevDecisionFps > 0 && fps >= this.prevDecisionFps * 1.25;
      if (improving) {
        this.distressSince = null;
      } else {
        if (this.distressSince === null) this.distressSince = now;
        if (!this.distressed && now - this.distressSince >= this.distressMs) {
          this.distressed = true;
          distress = true;
        }
      }
    } else {
      this.distressSince = null;
      this.distressed = false;
    }

    if (fps > 0) this.prevDecisionFps = fps;
    return { newScale, distress };
  }

  /**
   * A known-heavy spectacle is running (the balloon vista flight):
   * the resolution still softens every decision, but the spectacle
   * itself is never judged "too heavy" — a 26-second promise to a
   * child is kept in full. Distress re-arms honestly once the feet
   * touch the ground (spectacle off).
   */
  setSpectacle(on: boolean): void {
    if (on) {
      this.distressSince = null;
      this.distressed = false;
    }
    this.spectacle = on;
  }

  /** Forget history (used on resume after a pause — the engine is warm).
   *  The quality tier keeps: a paused world resumes on the same device. */
  reset(): void {
    this.frames = [];
    this.lastDecision = 0;
    this.distressSince = null;
    this.distressed = false;
    this.firstFrameAt = null;
  }
}
