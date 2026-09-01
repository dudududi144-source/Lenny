/* ============================================================
   AudioEngine — fully procedural WebAudio. Zero assets.
   Every sound is synthesized (oscillators + noise + envelopes):
   safe, tiny, instant. Music = quiet generative pentatonic pad.
   Mute state persists at `lenny-muted` (additive key).
   ============================================================ */

type SfxName =
  | 'pop'
  | 'chime'
  | 'whoosh'
  | 'softError'
  | 'combo'
  | 'fanfare'
  | 'tick'
  | 'splash'
  | 'shuffle'
  | 'unlock'
  | 'star';

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('lenny-muted') === '1';
    } catch {
      /* private mode: default unmuted */
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Lazily create the context (must follow a user gesture). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.05;
      this.musicGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('lenny-muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ---------------- low-level voices ---------------- */

  private tone(freq: number, durMs: number, opts: { type?: OscillatorType; vol?: number; slideTo?: number; delayMs?: number } = {}): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delayMs ?? 0) / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.slideTo), t0 + durMs / 1000);
    const vol = (opts.vol ?? 0.25) * 0.6;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  }

  private noise(durMs: number, opts: { vol?: number; freq?: number; delayMs?: number; q?: number } = {}): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delayMs ?? 0) / 1000;
    const len = Math.max(1, Math.floor((this.ctx.sampleRate * durMs) / 1000));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.freq ?? 900;
    filter.Q.value = opts.q ?? 1.2;
    const gain = this.ctx.createGain();
    gain.gain.value = (opts.vol ?? 0.18) * 0.5;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  /* ---------------- public SFX ---------------- */

  play(name: SfxName, variant = 0): void {
    if (!this.ctx) return;
    switch (name) {
      case 'pop':
        this.tone(420 + variant * 70, 90, { type: 'triangle', vol: 0.3, slideTo: 720 + variant * 90 });
        this.noise(50, { vol: 0.1, freq: 1600 });
        break;
      case 'chime':
        this.tone(PENTATONIC[variant % PENTATONIC.length], 420, { vol: 0.22 });
        this.tone(PENTATONIC[(variant + 2) % PENTATONIC.length] * 2, 300, { vol: 0.1, delayMs: 60 });
        break;
      case 'whoosh':
        this.noise(240, { vol: 0.22, freq: 500, q: 0.6 });
        break;
      case 'softError':
        this.tone(220, 160, { type: 'sine', vol: 0.14, slideTo: 170 });
        break;
      case 'combo':
        this.tone(PENTATONIC[Math.min(7, 3 + variant)] ?? 523, 140, { type: 'triangle', vol: 0.26 });
        this.tone((PENTATONIC[Math.min(7, 3 + variant)] ?? 523) * 1.5, 120, { vol: 0.14, delayMs: 40 });
        break;
      case 'fanfare': {
        const notes = [0, 2, 4, 7];
        notes.forEach((semi, i) => {
          const f = 329.63 * Math.pow(2, semi / 12);
          this.tone(f, 260, { type: 'triangle', vol: 0.24, delayMs: i * 110 });
          this.tone(f * 2, 200, { vol: 0.08, delayMs: i * 110 + 30 });
        });
        break;
      }
      case 'tick':
        this.tone(880, 40, { type: 'square', vol: 0.06 });
        break;
      case 'splash':
        this.noise(300, { vol: 0.25, freq: 700, q: 0.5 });
        this.tone(300, 220, { type: 'sine', vol: 0.1, slideTo: 120 });
        break;
      case 'shuffle':
        for (let i = 0; i < 5; i++) this.noise(60, { vol: 0.1, freq: 1200 + i * 250, delayMs: i * 55 });
        break;
      case 'unlock':
        this.tone(392, 200, { type: 'triangle', vol: 0.24 });
        this.tone(587.33, 240, { vol: 0.2, delayMs: 130 });
        this.tone(783.99, 320, { vol: 0.18, delayMs: 260 });
        break;
      case 'star': {
        const base = 523.25 + variant * 120;
        this.tone(base, 200, { type: 'triangle', vol: 0.26 });
        this.tone(base * 1.26, 180, { vol: 0.16, delayMs: 70 });
        break;
      }
    }
  }

  /* ---------------- generative ambience ---------------- */

  startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicTimer !== null) return;
    const step = (): void => {
      if (!this.ctx || this.muted) return;
      const idx = [0, 2, 4, 2, 5, 4, 2, 0][this.musicStep % 8];
      const f = PENTATONIC[idx] / 2;
      this.padTone(f, 1900);
      if (this.musicStep % 4 === 0) this.padTone(f / 2, 2600, 0.06);
      this.musicStep++;
    };
    step();
    this.musicTimer = window.setInterval(step, 2100);
  }

  private padTone(freq: number, durMs: number, vol = 0.08): void {
    if (!this.ctx || !this.musicGain || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const det = this.ctx.createOscillator();
    det.type = 'sine';
    det.frequency.value = freq * 1.004;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + durMs * 0.0006);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain);
    det.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t0);
    det.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.1);
    det.stop(t0 + durMs / 1000 + 0.1);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  destroy(): void {
    this.stopMusic();
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
  }
}

/** Shared engine instance — audio state (mute) is app-wide by design. */
export const audio = new AudioEngine();
