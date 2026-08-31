import { Container, Text } from 'pixi.js';
import { audio } from './AudioEngine';
import { ease, type AnimationSystem } from './AnimationSystem';
import { COLORS } from './theme';

export interface SessionStats {
  score: number;
  bestCombo: number;
  hits: number;
  attempts: number;
  accuracy: number;
  secs: number;
  stars: number;
}

/**
 * ScoreDirector — commercial game-feel scoring:
 * points with combo multipliers, floating feedback text, accuracy
 * tracking and 1–3 star ceremony rating. Child-positive: every
 * finished session earns at least one star.
 */
export class ScoreDirector {
  readonly layer = new Container();
  private anim: AnimationSystem | null = null;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private comboWindowMs = 2600;
  private comboExpiresAt = 0;
  private hits = 0;
  private attempts = 0;
  private startedAt = performance.now();
  private onComboChange: ((combo: number, mult: number) => void) | null = null;

  bind(anim: AnimationSystem, onComboChange: (combo: number, mult: number) => void): void {
    this.anim = anim;
    this.onComboChange = onComboChange;
  }

  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.hits = 0;
    this.attempts = 0;
    this.startedAt = performance.now();
    this.comboExpiresAt = 0;
    this.onComboChange?.(0, 1);
  }

  get points(): number {
    return this.score;
  }

  multiplier(): number {
    return 1 + Math.min(4, Math.floor(this.combo / 3));
  }

  /** Register a successful action. `points` is the base value. */
  hit(basePoints: number, at?: { x: number; y: number }, label?: string): number {
    this.hits++;
    this.attempts++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboExpiresAt = performance.now() + this.comboWindowMs;
    const mult = this.multiplier();
    const gained = basePoints * mult;
    this.score += gained;
    audio.play('pop', Math.min(4, this.combo));
    if (this.combo >= 3) audio.play('combo', Math.min(4, Math.floor(this.combo / 3) - 1));
    if (at) this.float(`+${gained}`, at.x, at.y, mult > 1 ? COLORS.glow : COLORS.cream);
    if (label && at) this.float(label, at.x, at.y - 46, COLORS.mint, 900);
    this.onComboChange?.(this.combo, mult);
    return gained;
  }

  /** Register a miss — breaks the combo, gentle audio only. */
  miss(at?: { x: number; y: number }): void {
    this.attempts++;
    if (this.combo >= 2 && at) this.float('נִשְׁבַּר…', at.x, at.y, COLORS.coral, 700);
    this.combo = 0;
    audio.play('softError');
    this.onComboChange?.(0, 1);
  }

  /** Combo decay call from the scene tick. */
  update(): void {
    if (this.combo > 0 && performance.now() > this.comboExpiresAt) {
      this.combo = 0;
      this.onComboChange?.(0, 1);
    }
  }

  /** Floating +N text that rises and fades (auto-destroyed). */
  float(text: string, x: number, y: number, color: number = COLORS.cream, durMs = 1000): void {
    if (!this.anim) return;
    const rise = Math.round(durMs * 0.4);
    const fade = Math.round(durMs * 0.6);
    const t = new Text({
      text,
      style: {
        fontFamily: 'Heebo, sans-serif',
        fontSize: 26,
        fontWeight: '800',
        fill: color,
        align: 'center',
        stroke: { color: 0x050810, width: 4 },
      },
    });
    t.anchor.set(0.5);
    t.resolution = 2;
    t.x = x;
    t.y = y;
    t.alpha = 0;
    this.layer.addChild(t);
    this.anim.to(t, { y: y - 64, alpha: 1 }, { durationMs: rise, ease: ease.outBack, onDone: () => {
      this.anim?.to(t, { alpha: 0, y: y - 96 }, { durationMs: fade, ease: ease.inOutCubic, onDone: () => t.destroy() });
    } });
  }

  /** 1–3 stars: accuracy + best combo, floored at 1 (child-positive). */
  private starRating(): number {
    const acc = this.attempts > 0 ? this.hits / this.attempts : 1;
    let stars = 1;
    if (acc >= 0.6 || this.bestCombo >= 4) stars = 2;
    if (acc >= 0.8 && this.bestCombo >= 6) stars = 3;
    return stars;
  }

  stats(): SessionStats {
    const acc = this.attempts > 0 ? this.hits / this.attempts : 1;
    return {
      score: this.score,
      bestCombo: this.bestCombo,
      hits: this.hits,
      attempts: this.attempts,
      accuracy: acc,
      secs: Math.max(1, Math.round((performance.now() - this.startedAt) / 1000)),
      stars: this.starRating(),
    };
  }

  destroy(): void {
    this.layer.destroy({ children: true });
  }
}
