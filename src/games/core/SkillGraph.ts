/* ============================================================
 * SkillGraph — a dependency-aware skill map.
 *
 * Cognitive skills are not independent. Recognizing the letter
 * bet comes before reading the word 'bayit'. Counting to 5 comes
 * before adding. The SkillGraph encodes these dependencies so the
 * platform always offers the *next reachable* skill, never one
 * the child is not ready for.
 *
 * Design notes (the exemplar part):
 *  - Graph is data-driven (nodes + edges), not hard-coded logic.
 *  - 'ready' = every prerequisite is acquired.
 *  - 'frontier' = the set of skills the child can work on now.
 *  - Progress is persisted so the graph survives sessions.
 * ============================================================ */

const SG_KEY = 'lenny-skillgraph-v1';

export interface SkillNode {
  id: string;
  label: string;      /* Hebrew label for the UI */
  prereqs: string[];  /* ids that must be acquired first */
}

export class SkillGraph {
  private nodes: Map<string, SkillNode> = new Map();
  private acquired: Set<string> = new Set();

  constructor(defs: SkillNode[]) {
    for (const n of defs) this.nodes.set(n.id, n);
    this.load();
  }

  /** Mark a skill as acquired. */
  acquire(id: string): void {
    if (!this.nodes.has(id)) return;
    this.acquired.add(id);
    this.save();
  }

  isAcquired(id: string): boolean {
    return this.acquired.has(id);
  }

  /** Is every prerequisite of this skill acquired? */
  isReady(id: string): boolean {
    const n = this.nodes.get(id);
    if (!n) return false;
    if (this.acquired.has(id)) return false; /* already done */
    return n.prereqs.every((p) => this.acquired.has(p));
  }

  /** Skills the child can work on right now (not yet acquired). */
  frontier(): string[] {
    const out: string[] = [];
    for (const n of this.nodes.values()) {
      if (!this.acquired.has(n.id) && this.isReady(n.id)) out.push(n.id);
    }
    return out;
  }

  /** Skills locked behind missing prerequisites. */
  locked(): string[] {
    const out: string[] = [];
    for (const n of this.nodes.values()) {
      if (!this.acquired.has(n.id) && !this.isReady(n.id)) out.push(n.id);
    }
    return out;
  }

  /** What this skill unlocks once acquired. */
  unlocks(id: string): string[] {
    const out: string[] = [];
    for (const n of this.nodes.values()) {
      if (n.prereqs.includes(id) && !this.acquired.has(n.id)) out.push(n.id);
    }
    return out;
  }

  /** Fraction of the whole graph acquired (0..1). */
  progress(): number {
    if (this.nodes.size === 0) return 0;
    return this.acquired.size / this.nodes.size;
  }

  getNode(id: string): SkillNode | undefined {
    return this.nodes.get(id);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SG_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        for (const id of arr) this.acquired.add(id);
      }
    } catch { /* fresh start */ }
  }

  private save(): void {
    try {
      localStorage.setItem(SG_KEY, JSON.stringify([...this.acquired]));
    } catch { /* noop */ }
  }
}

/* ---------- A starter graph for the garden's literacy path ---------- */
export const LITERACY_GRAPH: SkillNode[] = [
  { id: 'recognize-alef', label: 'לְזַהוֹת א', prereqs: [] },
  { id: 'recognize-bet', label: 'לְזַהוֹת ב', prereqs: [] },
  { id: 'sound-alef', label: 'הַצְּלִיל א', prereqs: ['recognize-alef'] },
  { id: 'sound-bet', label: 'הַצְּלִיל ב', prereqs: ['recognize-bet'] },
  { id: 'syllable-ba', label: 'הַהֲבָרָה בָּ', prereqs: ['sound-alef', 'sound-bet'] },
  { id: 'word-aba', label: 'הַמִּלָּה אַבָּא', prereqs: ['syllable-ba'] },
];
