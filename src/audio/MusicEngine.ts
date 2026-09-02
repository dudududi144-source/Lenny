/* ============================================================
 * MusicEngine — a living soundtrack, synthesized. Zero assets.
 *
 * Stage 6, commit 4. Three layers (pad / arpeggio / melody) built
 * from oscillators, filters and LFOs only — no mp3, no ogg, no
 * samples. Five moods cover the whole day in the garden, and a
 * crossfade (2s) moves between them without cutting the air.
 *
 *   calm        — the garden (pentatonic major, C)
 *   happy       — games in flow (pentatonic major, C5, arpeggio-forward)
 *   celebrating — ceremonies (major, C5, brighter + melody)
 *   focus       — harder games (minor pentatonic, A, steady)
 *   night       — end of session / breath (pentatonic minor, F, pad-only)
 *
 * Autoplay policy: the engine NEVER touches the WebAudio API before
 * AudioEngine.unlock() hands it a context — and unlock only happens
 * inside a real user gesture (first pointerdown/keydown anywhere).
 *
 * Determinism: all "random" choices come from a seeded mulberry32
 * RNG. The pure helpers (scales, chords, note picking) are exported
 * for unit tests — same seed in, same soundtrack out.
 * ============================================================ */

/* ---------- pure musical core (exported for tests) ---------- */

export type ScaleName = 'pentatonic-major' | 'pentatonic-minor' | 'major' | 'minor';

export const SCALES: Record<ScaleName, readonly number[]> = {
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Progression = chord roots as semitone offsets from the key root. */
export type Progression = readonly [number, number, number, number];

export const PROGRESSIONS: Record<string, Progression> = {
  'I-V-vi-IV': [0, 7, 9, 5],
  'i-VI-III-VII': [0, 8, 3, 10],
  'I-IV-V-I': [0, 5, 7, 0],
  'i-VII-VI-V': [0, 10, 8, 7],
};

/** mulberry32 — tiny deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Frequency for a scale degree + octave. degree walks the scale. */
export function noteFreq(scale: readonly number[], rootHz: number, degree: number): number {
  const len = scale.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return rootHz * Math.pow(2, (scale[idx] + 12 * octave) / 12);
}

/** Deterministic walk: mostly steps, occasionally a skip, never wild. */
export function pickStep(rng: Rng, drift: number): number {
  const r = rng();
  if (r < 0.42) return drift >= 0 ? 1 : -1; /* keep direction */
  if (r < 0.72) return rng() < 0.5 ? 1 : -1; /* coin step */
  if (r < 0.9) return rng() < 0.5 ? 2 : -2; /* gentle skip */
  return 0; /* repeat */
}

/** Chord voicing for a progression root (three scale tones). */
export function chordDegrees(root: number): [number, number, number] {
  return [root, root + 2, root + 4] as [number, number, number];
}

/* ---------- the mood table ---------- */

export type Mood = 'calm' | 'happy' | 'celebrating' | 'focus' | 'night';

export interface MoodParams {
  scale: ScaleName;
  rootHz: number;
  progression: Progression;
  stepMs: number;
  /* layer mix (0..1) */
  pad: number;
  arpeggio: number;
  melody: number;
  /* instrument flavor */
  arpWave: OscillatorType;
  arpPluck: boolean; /* short pitch drop = water pluck */
  bells: boolean; /* add a soft harmonic = bell tones */
  percussion: boolean; /* kick/snare pattern (DrumBeat) */
  padOnly: boolean; /* night / breath: arpeggio silent */
}

export const MOODS: Record<Mood, MoodParams> = {
  calm: {
    scale: 'pentatonic-major',
    rootHz: 261.63,
    progression: PROGRESSIONS['I-V-vi-IV'],
    stepMs: 940,
    pad: 0.9,
    arpeggio: 0.5,
    melody: 0.15,
    arpWave: 'sine',
    arpPluck: true, /* water pluck — GlowFish */
    bells: false,
    percussion: false,
    padOnly: false,
  },
  happy: {
    scale: 'pentatonic-major',
    rootHz: 523.25, /* C5 — the chime table (C pentatonic) harmonizes */
    progression: PROGRESSIONS['I-IV-V-I'],
    stepMs: 520,
    pad: 0.55,
    arpeggio: 0.85,
    melody: 0.2,
    arpWave: 'triangle',
    arpPluck: false,
    bells: true, /* MemoryPairs bell tones */
    percussion: false,
    padOnly: false,
  },
  celebrating: {
    scale: 'major',
    rootHz: 523.25, /* C5 — ceremonies sing with the chimes */
    progression: PROGRESSIONS['I-V-vi-IV'],
    stepMs: 420,
    pad: 0.6,
    arpeggio: 0.95,
    melody: 0.5,
    arpWave: 'triangle',
    arpPluck: false,
    bells: true,
    percussion: false,
    padOnly: false,
  },
  focus: {
    scale: 'pentatonic-minor',
    rootHz: 220.0,
    progression: PROGRESSIONS['i-VI-III-VII'],
    stepMs: 620,
    pad: 0.7,
    arpeggio: 0.6,
    melody: 0.1,
    arpWave: 'square',
    arpPluck: false,
    bells: false,
    percussion: true, /* DrumBeat kick/snare ride along */
    padOnly: false,
  },
  night: {
    scale: 'pentatonic-minor',
    rootHz: 174.61,
    progression: PROGRESSIONS['i-VII-VI-V'],
    stepMs: 1400,
    pad: 1,
    arpeggio: 0,
    melody: 0.3, /* only on breath peaks */
    arpWave: 'sine',
    arpPluck: false,
    bells: false,
    percussion: false,
    padOnly: true,
  },
};

export const CROSSFADE_MS = 2000;

/* ---------- the engine ---------- */

interface MusicContext {
  ctx: AudioContext;
  layerGain: GainNode; /* engine-wide music voice gain (under AudioEngine's music bus) */
  arpDelay: DelayNode;
  arpDelayWet: GainNode;
  arpDelayFb: GainNode;
}

export class MusicEngine {
  private m: MusicContext | null = null;
  private wantedMood: Mood = 'calm';
  private intensity = 0.35;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private rng: Rng = mulberry32(20260901);
  private degree = 4;
  private desiredRunning = false;
  private crossfadeUntil = 0;
  private prevMood: Mood | null = null;
  private peakQueued = false;

  /* ---------- context plumbing (no API calls before a gesture) ---------- */

  /** AudioEngine.unlock() hands over the live context + buses. */
  bindContext(ctx: AudioContext, layerGain: GainNode): void {
    if (this.m) return;
    let arpDelay: DelayNode;
    let arpDelayWet: GainNode;
    let arpDelayFb: GainNode;
    try {
      arpDelay = ctx.createDelay(1);
      arpDelay.delayTime.value = 0.28;
      arpDelayWet = ctx.createGain();
      arpDelayWet.gain.value = 0.32;
      arpDelayFb = ctx.createGain();
      arpDelayFb.gain.value = 0.34;
      arpDelay.connect(arpDelayFb).connect(arpDelay);
      arpDelay.connect(arpDelayWet).connect(layerGain);
    } catch {
      arpDelay = ctx.createDelay(1);
      arpDelayWet = ctx.createGain();
      arpDelayFb = ctx.createGain();
    }
    this.m = { ctx, layerGain, arpDelay, arpDelayWet, arpDelayFb };
    if (this.desiredRunning) this.startScheduler();
  }

  hasContext(): boolean {
    return this.m !== null;
  }

  /* ---------- transport ---------- */

  /** Ask for sound (idempotent). Actual start waits for a bound context. */
  resume(): void {
    this.desiredRunning = true;
    if (this.m && this.timer === null) {
      if (this.m.ctx.state === 'suspended') void this.m.ctx.resume();
      this.startScheduler();
    }
  }

  pause(): void {
    this.desiredRunning = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  /* ---------- mood + intensity ---------- */

  /** Crossfade to a mood (2s, no cut): the previous pad tails out while
   *  the new chord fades in, and the arpeggio lane ramps through. */
  setMood(mood: Mood): void {
    if (mood === this.wantedMood) return;
    this.prevMood = this.wantedMood;
    this.wantedMood = mood;
    this.crossfadeUntil = Date.now() + CROSSFADE_MS;
    this.rng = mulberry32(0x5eed + mood.length * 7919); /* fresh deterministic voice per mood */
    if (this.m) {
      const now = this.m.ctx.currentTime;
      /* smooth handover on the shared delay-wet lane */
      try {
        this.m.arpDelayWet.gain.setTargetAtTime(0.1, now, 0.35);
        this.m.arpDelayWet.gain.setTargetAtTime(0.32, now + 0.9, 0.5);
      } catch {
        /* param automation unavailable — the mood still switches */
      }
    }
  }

  /** DDA feeds this: higher difficulty = denser arpeggio + extra pulse. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  /** Melody enters only on special moments (breath peak). */
  breathPeak(): void {
    this.peakQueued = true;
  }

  /**
   * SequenceEcho: crystals ARE scale notes — the playback and the
   * child's echo tap ring the SAME bell in the live mood's scale, so
   * the correct sound is literally the correct note (built-in audio
   * hint, no extra UI).
   */
  playEchoNote(index: number): void {
    const p = MOODS[this.wantedMood];
    const degree = 3 + ((index % 6) * 2); /* spread cells across the scale */
    this.pluck(noteFreq(SCALES[p.scale], p.rootHz, degree), { ...p, bells: true, arpPluck: false }, 0.22);
  }

  debug(): {
    mood: Mood;
    intensity: number;
    running: boolean;
    hasContext: boolean;
    crossfading: boolean;
    prevMood: Mood | null;
  } {
    return {
      mood: this.wantedMood,
      intensity: Number(this.intensity.toFixed(3)),
      running: this.isRunning(),
      hasContext: this.hasContext(),
      crossfading: this.crossfadeUntil > Date.now(),
      prevMood: this.prevMood,
    };
  }

  /* ---------- the scheduler (one step per tick) ---------- */

  private startScheduler(): void {
    if (this.timer !== null || !this.m) return;
    const tick = (): void => {
      if (!this.desiredRunning || !this.m) return;
      this.fireStep(MOODS[this.wantedMood]);
      this.step++;
    };
    tick();
    this.timer = setInterval(tick, MOODS[this.wantedMood].stepMs);
  }

  private retuneTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.startScheduler();
  }

  private fireStep(p: MoodParams): void {
    const m = this.m;
    if (!m) return;
    const bar = Math.floor(this.step / 8) % p.progression.length;
    const chordRoot = p.progression[bar];
    const scale = SCALES[p.scale];
    const rootOct = p.rootHz / 2; /* pad sits an octave down */

    /* PAD — every 8 steps: detuned sine+triangle chord through a lowpass */
    if (p.pad > 0 && this.step % 8 === 0) {
      const voicing = chordDegrees(chordRoot);
      for (const d of voicing) {
        this.padTone(noteFreq(scale, rootOct, d), 4200, 0.05 * p.pad);
        this.padTone(noteFreq(scale, rootOct, d) * 1.004, 4200, 0.035 * p.pad); /* detune */
      }
    }

    /* ARPEGGIO — plucky steps, density follows intensity */
    if (!p.padOnly && p.arpeggio > 0) {
      const density = 0.3 + this.intensity * 0.55;
      if (this.rng() < density) {
        this.degree += pickStep(this.rng, this.degree >= 4 ? 1 : -1);
        this.degree = Math.max(0, Math.min(9, this.degree));
        this.pluck(noteFreq(scale, p.rootHz, this.degree), p, 0.16 * p.arpeggio);
      }
      /* PERCUSSION — focus mood rides a kick/snare pattern */
      if (p.percussion) {
        const beat = this.step % 4;
        if (beat === 0 || beat === 2) this.kick();
        if (beat === 1 || beat === 3) this.snare();
      }
      /* INTENSITY PULSE — extra low pulse above 0.6 (DDA) */
      if (this.intensity > 0.6 && this.step % 8 === 4) {
        this.kick(0.6 + this.intensity * 0.4);
      }
    }

    /* MELODY — rare, only when intensity is high or on a breath peak */
    const wantMelody = this.peakQueued || (p.melody > 0.25 && this.intensity > 0.75 && this.rng() < 0.2);
    if (wantMelody && p.melody > 0 && (!p.padOnly || this.peakQueued)) {
      const d = 6 + Math.floor(this.rng() * 4);
      this.lead(noteFreq(scale, p.rootHz, d), 900, 0.2 * p.melody);
      this.peakQueued = false;
    } else if (p.padOnly) {
      this.peakQueued = false;
    }

    /* retune the interval when the mood (stepMs) changed mid-flight */
    if (MOODS[this.wantedMood].stepMs !== p.stepMs && this.crossfadeUntil < Date.now()) {
      this.retuneTimer();
    }
  }

  /* ---------- voices ---------- */

  private padTone(freq: number, durMs: number, vol: number): void {
    const m = this.m;
    if (!m) return;
    const ctx = m.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = freq * 0.999;
    const triGain = ctx.createGain();
    triGain.gain.value = 0.35;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, t0);
    filter.frequency.linearRampToValueAtTime(900, t0 + durMs / 2000);
    filter.frequency.linearRampToValueAtTime(420, t0 + durMs / 1000);
    const gain = ctx.createGain();
    /* slow attack + release — the pad never clicks */
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + durMs / 3000);
    gain.gain.linearRampToValueAtTime(vol * 0.7, t0 + (durMs * 0.6) / 1000);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(filter);
    tri.connect(triGain).connect(filter);
    filter.connect(gain).connect(m.layerGain);
    osc.start(t0);
    tri.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.1);
    tri.stop(t0 + durMs / 1000 + 0.1);
  }

  private pluck(freq: number, p: MoodParams, vol: number): void {
    const m = this.m;
    if (!m) return;
    const ctx = m.ctx;
    const t0 = ctx.currentTime;
    const durMs = p.arpPluck ? 260 : 420;
    const osc = ctx.createOscillator();
    osc.type = p.arpWave;
    osc.frequency.setValueAtTime(p.arpPluck ? freq * 1.5 : freq, t0);
    if (p.arpPluck) osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.09); /* water pluck */
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain);
    gain.connect(m.layerGain);
    gain.connect(m.arpDelay); /* echo lane */
    if (p.bells) {
      const bell = ctx.createOscillator();
      bell.type = 'sine';
      bell.frequency.value = freq * 2.76; /* inharmonic partial = bell */
      const bellGain = ctx.createGain();
      bellGain.gain.setValueAtTime(0.0001, t0);
      bellGain.gain.exponentialRampToValueAtTime(vol * 0.18, t0 + 0.02);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      bell.connect(bellGain).connect(m.layerGain);
      bell.start(t0);
      bell.stop(t0 + 0.55);
    }
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  }

  private lead(freq: number, durMs: number, vol: number): void {
    const m = this.m;
    if (!m) return;
    const ctx = m.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.06);
    gain.gain.setValueAtTime(vol, t0 + durMs / 2000);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain).connect(m.layerGain);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  }

  private kick(strength = 1): void {
    const m = this.m;
    if (!m) return;
    const ctx = m.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(46, t0 + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22 * strength, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(gain).connect(m.layerGain);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  private snare(): void {
    const m = this.m;
    if (!m) return;
    const ctx = m.ctx;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, Math.max(1, len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.1;
    src.connect(filter).connect(gain).connect(m.layerGain);
    src.start(t0);
  }

  /* ---------- stings (combo payoff — rising scale runs) ---------- */

  /** Combo x2 = 2-note run, x3 = 3-note run, x4+ = 4-note run. */
  sting(combo: number): void {
    const m = this.m;
    if (!m) return;
    const p = MOODS[this.wantedMood];
    const scale = SCALES[p.scale];
    const runLen = Math.max(2, Math.min(4, combo));
    const base = 4 + Math.min(4, combo - 2);
    for (let i = 0; i < runLen; i++) {
      const f = noteFreq(scale, p.rootHz * 2, base + i);
      setTimeout(() => this.pluck(f, { ...p, bells: true, arpPluck: false }, 0.2), i * 90);
    }
  }
}

/** Shared engine instance — one soundtrack for the whole app. */
export const music = new MusicEngine();

/* ---------- zone → mood (the garden's musical geography) ---------- */

export const MOOD_FOR_ZONE: Record<string, Mood> = {
  'light-path': 'calm',
  'attention-stream': 'calm', /* water plucks (GlowFish) */
  'memory-hill': 'happy', /* bell tones (MemoryPairs) */
  'thinking-forest': 'focus',
  'space-sky': 'happy',
  'words-valley': 'happy',
  'feelings-garden': 'calm',
  'creativity-meadow': 'happy',
  'rhythm-square': 'focus', /* percussion-forward (DrumBeat) */
  'breath-pool': 'night', /* pad-only, melody on peaks (BreathPool) */
};
