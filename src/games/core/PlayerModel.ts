/* ============================================================
 * PlayerModel — a persistent cognitive profile for each child.
 *
 * This is the layer above AdaptiveDifficulty. DDA answers
 * 'how hard should the next round be?' — PlayerModel answers
 * 'who is this child, what are they strong at, where do they
 * struggle, and what do they enjoy?'
 *
 * The model feeds two consumers:
 *  1. Content selection: surface zones the child needs, gently.
 *  2. ParentLens: honest insight for the parent dashboard.
 *
 * Design notes (the exemplar part):
 *  - Everything is stored locally (privacy-first, see ETHICS).
 *  - Strengths/gaps are per-zone EMA, not per-session snapshots.
 *  - Time-on-task is tracked to distinguish fast-accurate from
 *    slow-careful problem solvers.
 * ============================================================ */

const PM_KEY = 'lenny-player-v1';

export interface ZoneStat {
  /* rolling success rate 0..1 */
  success: number;
  /* rolling average seconds per round */
  avgTime: number;
  rounds: number;
}

export interface PlayerModelData {
  name: string;
  zones: Record<string, ZoneStat>;
  /* what the child chose to play, for interest inference */
  playOrder: string[];
  firstSeen: number;
  lastSeen: number;
}

export class PlayerModel {
  private data: PlayerModelData;

  private readonly EMA = 0.2;
  private readonly HISTORY = 12;

  constructor(name: string = '') {
    this.data = this.load(name);
  }

  /** Record a finished round in a zone. */
  recordRound(zone: string, win: boolean, seconds: number): void {
    const now = Date.now();
    const z = this.ensureZone(zone);
    const s = win ? 1 : 0;
    z.success += (s - z.success) * this.EMA;
    if (z.rounds === 0) z.avgTime = seconds;
    else z.avgTime += (seconds - z.avgTime) * this.EMA;
    z.rounds++;
    this.data.playOrder.push(zone);
    if (this.data.playOrder.length > this.HISTORY) this.data.playOrder.shift();
    this.data.lastSeen = now;
    this.save();
  }

  /** Zones the child is strongest in (highest success, >= 2 rounds). */
  strengths(): string[] {
    return this.rankBySuccess().filter((z) => this.data.zones[z].rounds >= 2 && this.data.zones[z].success >= 0.6);
  }

  /** Zones the child struggles with (lowest success, >= 2 rounds). */
  gaps(): string[] {
    return this.rankBySuccess().filter((z) => this.data.zones[z].rounds >= 2 && this.data.zones[z].success <= 0.4);
  }

  /** Zones the child has never tried. */
  unexplored(allZones: string[]): string[] {
    return allZones.filter((z) => !this.data.zones[z] || this.data.zones[z].rounds === 0);
  }

  /** Which zone type the child gravitates toward (interest signal). */
  interest(): string | null {
    if (this.data.playOrder.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const z of this.data.playOrder) counts[z] = (counts[z] || 0) + 1;
    let best: string | null = null;
    let bestN = 0;
    for (const k of Object.keys(counts)) {
      if (counts[k] > bestN) { bestN = counts[k]; best = k; }
    }
    return best;
  }

  /** Solver style hint: fast-accurate vs slow-careful. */
  tempo(zone: string): 'fast' | 'steady' | 'careful' | 'unknown' {
    const z = this.data.zones[zone];
    if (!z || z.rounds < 3) return 'unknown';
    if (z.avgTime < 6) return 'fast';
    if (z.avgTime < 12) return 'steady';
    return 'careful';
  }

  /** Snapshot for the ParentLens dashboard. */
  snapshot(): PlayerModelData {
    return JSON.parse(JSON.stringify(this.data));
  }

  private ensureZone(zone: string): ZoneStat {
    if (!this.data.zones[zone]) {
      this.data.zones[zone] = { success: 0.5, avgTime: 0, rounds: 0 };
    }
    return this.data.zones[zone];
  }

  private rankBySuccess(): string[] {
    return Object.keys(this.data.zones).sort(
      (a, b) => this.data.zones[b].success - this.data.zones[a].success,
    );
  }

  private load(name: string): PlayerModelData {
    try {
      const raw = localStorage.getItem(PM_KEY);
      if (raw) return JSON.parse(raw) as PlayerModelData;
    } catch { /* fresh start */ }
    return {
      name,
      zones: {},
      playOrder: [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };
  }

  private save(): void {
    try {
      localStorage.setItem(PM_KEY, JSON.stringify(this.data));
    } catch { /* noop */ }
  }
}
