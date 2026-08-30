/* ============================================================
 * SkillGraph — unit tests.
 * Uses a small deterministic graph:
 *   a -> (b, c) -> d     (b and c require a; d requires b + c)
 * ============================================================ */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillGraph, SkillNode } from '../games/core/SkillGraph';

const GRAPH: SkillNode[] = [
  { id: 'a', label: 'a', prereqs: [] },
  { id: 'b', label: 'b', prereqs: ['a'] },
  { id: 'c', label: 'c', prereqs: ['a'] },
  { id: 'd', label: 'd', prereqs: ['b', 'c'] },
];

describe('SkillGraph', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a skill with no prereqs is ready; dependents are not', () => {
    const g = new SkillGraph(GRAPH);
    expect(g.isReady('a')).toBe(true);
    expect(g.isReady('b')).toBe(false);
    expect(g.isReady('d')).toBe(false);
  });

  it('isReady flips for dependents once the prereq is acquired', () => {
    const g = new SkillGraph(GRAPH);
    g.acquire('a');
    expect(g.isReady('b')).toBe(true);
    expect(g.isReady('c')).toBe(true);
    expect(g.isReady('d')).toBe(false); /* needs b AND c */
  });

  it('an already-acquired skill is never "ready" again', () => {
    const g = new SkillGraph(GRAPH);
    g.acquire('a');
    expect(g.isReady('a')).toBe(false);
    expect(g.isAcquired('a')).toBe(true);
  });

  it('frontier() returns exactly the workable skills', () => {
    const g = new SkillGraph(GRAPH);
    expect(g.frontier()).toEqual(['a']);
    g.acquire('a');
    expect(g.frontier().sort()).toEqual(['b', 'c']);
  });

  it('locked() returns only blocked skills', () => {
    const g = new SkillGraph(GRAPH);
    expect(g.locked().sort()).toEqual(['b', 'c', 'd']);
    g.acquire('a');
    expect(g.locked()).toEqual(['d']);
  });

  it('progress() is the acquired fraction of the graph', () => {
    const g = new SkillGraph(GRAPH);
    expect(g.progress()).toBe(0);
    g.acquire('a');
    g.acquire('b');
    expect(g.progress()).toBe(0.5);
  });

  it('unlocks() returns the children a skill opens', () => {
    const g = new SkillGraph(GRAPH);
    expect(g.unlocks('a').sort()).toEqual(['b', 'c']);
    g.acquire('b');
    g.acquire('c');
    /* b and c together unlock d; d remains un-acquired */
    expect(g.unlocks('b')).toEqual(['d']);
    g.acquire('d');
    expect(g.unlocks('b')).toEqual([]); /* nothing left to open */
  });

  it('acquiring an unknown node is a safe no-op', () => {
    const g = new SkillGraph(GRAPH);
    g.acquire('nope');
    expect(g.progress()).toBe(0);
  });

  it('persists acquisition across instances (localStorage)', () => {
    const g1 = new SkillGraph(GRAPH);
    g1.acquire('a');
    const g2 = new SkillGraph(GRAPH);
    expect(g2.isAcquired('a')).toBe(true);
    expect(g2.frontier().sort()).toEqual(['b', 'c']);
  });
});
