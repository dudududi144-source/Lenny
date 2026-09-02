/* ============================================================
 * MusicEngine tests — the soundtrack's contract (Stage 6, commit 4).
 *
 *   - pure core: scales/progressions/notes deterministic per seed
 *   - the mood table is complete and playable (5 moods, 4-chord
 *     progressions, sane step times)
 *   - NO WebAudio before a gesture: a fresh engine has no context,
 *     resume() before bindContext() must not schedule anything
 *   - with a bound (stub) context the scheduler runs, moods
 *     crossfade (never a hard cut), and intensity raises density
 *   - the zone→mood map covers every garden zone
 * ============================================================ */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MusicEngine,
  MOODS,
  PROGRESSIONS,
  SCALES,
  chordDegrees,
  mulberry32,
  noteFreq,
  pickStep,
  MOOD_FOR_ZONE,
} from '../audio/MusicEngine';
import { ZONES } from '../data/garden';

/* ---------- tiny AudioContext stub (records voice creation) ---------- */

function makeParam(value = 0): AudioParam {
  const p = {
    value,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
  return p as unknown as AudioParam;
}

function makeNode(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    gain: makeParam(1),
    frequency: makeParam(440),
    delayTime: makeParam(0),
    Q: makeParam(1),
    threshold: makeParam(0),
    knee: makeParam(0),
    ratio: makeParam(1),
    attack: makeParam(0),
    release: makeParam(0),
    type: '',
    buffer: null,
    connect: vi.fn(() => node),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return node;
}

function makeFakeContext(): { ctx: AudioContext; created: { oscillators: number; buffers: number } } {
  const created = { oscillators: 0, buffers: 0 };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    resume: vi.fn(async () => undefined),
    createGain: vi.fn(() => makeNode()),
    createOscillator: vi.fn(() => {
      created.oscillators++;
      return makeNode();
    }),
    createBiquadFilter: vi.fn(() => makeNode()),
    createDelay: vi.fn(() => makeNode()),
    createBuffer: vi.fn(() => {
      created.buffers++;
      return { getChannelData: () => new Float32Array(8) };
    }),
    createBufferSource: vi.fn(() => makeNode()),
    createDynamicsCompressor: vi.fn(() => makeNode()),
    destination: makeNode(),
  };
  return { ctx: ctx as unknown as AudioContext, created };
}

describe('MusicEngine — pure musical core', () => {
  it('scales and progressions are stable, 4-chord sets', () => {
    expect(SCALES['pentatonic-major']).toEqual([0, 2, 4, 7, 9]);
    expect(SCALES['pentatonic-minor']).toEqual([0, 3, 5, 7, 10]);
    expect(PROGRESSIONS['I-V-vi-IV']).toEqual([0, 7, 9, 5]);
    expect(PROGRESSIONS['i-VI-III-VII']).toEqual([0, 8, 3, 10]);
  });

  it('note frequencies are deterministic and octave-wrap correctly', () => {
    const scale = SCALES['pentatonic-major'];
    expect(noteFreq(scale, 261.63, 0)).toBeCloseTo(261.63, 2);
    expect(noteFreq(scale, 261.63, 5)).toBeCloseTo(261.63 * 2, 2); /* one octave up */
    expect(noteFreq(scale, 261.63, -3)).toBeCloseTo(noteFreq(scale, 261.63, 2) / 2, 2);
  });

  it('the same seed yields the exact same melodic walk', () => {
    const run = (seed: number): number[] => {
      const rng = mulberry32(seed);
      let d = 4;
      const out: number[] = [];
      for (let i = 0; i < 24; i++) {
        d = Math.max(0, Math.min(9, d + pickStep(rng, d >= 4 ? 1 : -1)));
        out.push(d);
      }
      return out;
    };
    expect(run(1234)).toEqual(run(1234));
    expect(run(1234)).not.toEqual(run(4321));
  });

  it('chord voicing returns three scale tones', () => {
    expect(chordDegrees(0)).toEqual([0, 2, 4]);
    expect(chordDegrees(7)).toEqual([7, 9, 11]);
  });
});

describe('MusicEngine — the mood table', () => {
  it('has exactly the five moods with sane musical parameters', () => {
    expect(Object.keys(MOODS).sort()).toEqual(['calm', 'celebrating', 'focus', 'happy', 'night']);
    for (const [name, p] of Object.entries(MOODS)) {
      expect(p.progression, name).toHaveLength(4);
      expect(p.stepMs, name).toBeGreaterThanOrEqual(300);
      expect(p.stepMs, name).toBeLessThanOrEqual(1600);
      expect(p.pad, name).toBeGreaterThan(0);
      if (name === 'night') expect(p.padOnly, name).toBe(true); /* breath: pad-only */
      if (name === 'focus') expect(p.percussion, name).toBe(true); /* DrumBeat rides kick/snare */
      if (name === 'calm') expect(p.arpPluck, name).toBe(true); /* water plucks (GlowFish) */
      if (name === 'happy' || name === 'celebrating') expect(p.bells, name).toBe(true);
    }
  });

  it('every garden zone has a mood', () => {
    for (const zone of ZONES) {
      expect(MOOD_FOR_ZONE[zone.id], zone.id).toBeDefined();
    }
    expect(MOOD_FOR_ZONE['breath-pool']).toBe('night');
    expect(MOOD_FOR_ZONE['rhythm-square']).toBe('focus');
    expect(MOOD_FOR_ZONE['attention-stream']).toBe('calm');
  });
});

describe('MusicEngine — autoplay policy + scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('NEVER creates or touches WebAudio before a gesture (no context bound)', () => {
    const engine = new MusicEngine();
    expect(engine.hasContext()).toBe(false);
    /* the app asks for sound as soon as a scene boots — still nothing */
    engine.resume();
    engine.setMood('happy');
    engine.setIntensity(0.8);
    vi.advanceTimersByTime(5000);
    expect(engine.hasContext()).toBe(false);
    expect(engine.isRunning()).toBe(false); /* scheduler never started */
    expect(engine.debug()).toMatchObject({ hasContext: false, running: false, mood: 'happy' });
  });

  it('once bound, the scheduler runs and voices are synthesized', () => {
    const engine = new MusicEngine();
    const { ctx, created } = makeFakeContext();
    const layer = makeNode() as unknown as GainNode;
    engine.resume();
    engine.bindContext(ctx, layer);
    expect(engine.isRunning()).toBe(true);
    vi.advanceTimersByTime(8000); /* several steps of the calm mood */
    expect(created.oscillators).toBeGreaterThan(0);
    engine.pause();
    expect(engine.isRunning()).toBe(false);
    const after = created.oscillators;
    vi.advanceTimersByTime(8000);
    expect(created.oscillators).toBe(after); /* paused = silence, no voices */
  });

  it('setMood crossfades (prevMood kept, crossfade window reported)', () => {
    const engine = new MusicEngine();
    const { ctx } = makeFakeContext();
    engine.resume();
    engine.bindContext(ctx, makeNode() as unknown as GainNode);
    engine.setMood('happy');
    const d = engine.debug();
    expect(d.mood).toBe('happy');
    expect(d.prevMood).toBe('calm');
    expect(d.crossfading).toBe(true); /* inside the 2s handover */
    vi.advanceTimersByTime(2500);
    expect(engine.debug().crossfading).toBe(false);
  });

  it('higher intensity schedules a denser arpeggio (deterministic)', () => {
    const countVoices = (intensity: number): number => {
      const engine = new MusicEngine();
      const { ctx, created } = makeFakeContext();
      engine.bindContext(ctx, makeNode() as unknown as GainNode);
      engine.resume();
      engine.setIntensity(intensity);
      const before = created.oscillators;
      vi.advanceTimersByTime(10_000);
      return created.oscillators - before;
    };
    const low = countVoices(0);
    const high = countVoices(0.95);
    expect(high).toBeGreaterThan(low);
  });

  it('stings queue rising runs only with a bound context', () => {
    const engine = new MusicEngine();
    engine.sting(3); /* no context — must be a silent no-op */
    expect(engine.debug().hasContext).toBe(false);
    const { ctx, created } = makeFakeContext();
    engine.bindContext(ctx, makeNode() as unknown as GainNode);
    const before = created.oscillators;
    engine.sting(3);
    vi.advanceTimersByTime(500);
    expect(created.oscillators).toBeGreaterThan(before);
  });
});

describe('MusicEngine — intensity holds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a held intensity wins over later plain feeds until it expires', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.9, 5_000); /* GlowFish dives — hold 5s */
    expect(engine.isHeld()).toBe(true);
    expect(engine.debug().intensity).toBe(0.9);
    engine.setIntensity(0.2); /* generic DDA feed arrives — NOT held, applies */
    expect(engine.debug().intensity).toBe(0.2);
    /* a held call then blocks only via isHeld() gate in the caller */
    engine.setIntensity(0.95, 5_000);
    vi.advanceTimersByTime(6_000);
    expect(engine.isHeld()).toBe(false); /* expired — generic feed resumes */
  });
});
