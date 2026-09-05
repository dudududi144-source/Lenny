/* stage 19 — the reload contract of the self-updating site.
   Only a non-empty STRING stamp that differs from the running one
   may trigger a reload; anything a hostile/middlebox server throws
   at us (null, numbers, objects, empty strings) keeps the session. */
import { describe, expect, it } from 'vitest';
import { versionReloadDecision } from '../versionWatch';

describe('versionReloadDecision', () => {
  it('keeps the session when the served stamp equals the running one', () => {
    expect(versionReloadDecision('abc123-2026', 'abc123-2026')).toBe(false);
  });

  it('reloads when the server serves a different build', () => {
    expect(versionReloadDecision('old-2026', 'new-2027')).toBe(true);
  });

  it('never reloads on a failed/odd payload', () => {
    expect(versionReloadDecision('abc', null)).toBe(false);
    expect(versionReloadDecision('abc', undefined)).toBe(false);
    expect(versionReloadDecision('abc', 42)).toBe(false);
    expect(versionReloadDecision('abc', { id: 'abc' })).toBe(false);
    expect(versionReloadDecision('abc', ['abc'])).toBe(false);
  });

  it('never reloads on an empty-string stamp', () => {
    expect(versionReloadDecision('abc', '')).toBe(false);
  });

  it('reloads even when the running stamp is empty (defensive build)', () => {
    expect(versionReloadDecision('', 'something')).toBe(true);
  });
});
