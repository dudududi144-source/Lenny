import { Container, Sprite, Texture } from 'pixi.js';
import { confettiTexture, discTexture, softGlowTexture, sparkTexture } from './textures';
import { COLORS } from './theme';

/* GPU-batched particle engine. All particles share a handful of baked
   textures + additive blending, so Pixi renders them in single-digit
   draw calls — hundreds of simultaneous particles at 60fps. */

export interface EmitOptions {
  x: number;
  y: number;
  count: number;
  colors?: number[];
  textures?: Texture[];
  speedMin?: number;
  speedMax?: number;
  angleMin?: number;
  angleMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  lifeMin?: number;
  lifeMax?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  blend?: 'add' | 'normal';
  endScaleFactor?: number;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  maxLife: number;
  spin: number;
  baseScale: number;
  endScaleFactor: number;
  gravity: number;
  drag: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const DEFAULT_COLORS = [COLORS.glow, COLORS.glowSoft, COLORS.cream];

export class ParticleSystem {
  readonly container = new Container();
  private pool: Sprite[] = [];
  private live: Particle[] = [];
  private readonly capacity: number;

  constructor(capacity = 800) {
    this.capacity = capacity;
    this.container.eventMode = 'none';
  }

  emit(options: EmitOptions): void {
    const colors = options.colors ?? DEFAULT_COLORS;
    const textures = options.textures ?? [softGlowTexture()];
    const speedMin = options.speedMin ?? 40;
    const speedMax = options.speedMax ?? 140;
    const angleMin = options.angleMin ?? 0;
    const angleMax = options.angleMax ?? Math.PI * 2;
    const sizeMin = options.sizeMin ?? 6;
    const sizeMax = options.sizeMax ?? 16;
    const lifeMin = options.lifeMin ?? 500;
    const lifeMax = options.lifeMax ?? 1100;
    const blend = options.blend ?? 'add';

    let count = options.count;
    if (this.live.length + count > this.capacity) {
      count = Math.max(0, this.capacity - this.live.length);
    }

    for (let i = 0; i < count; i++) {
      const sprite = this.pool.pop() ?? new Sprite();
      sprite.texture = pick(textures);
      sprite.tint = pick(colors);
      sprite.blendMode = blend;
      sprite.anchor.set(0.5);
      sprite.rotation = rand(0, Math.PI * 2);
      sprite.visible = true;
      this.container.addChild(sprite);

      const angle = rand(angleMin, angleMax);
      const speed = rand(speedMin, speedMax);
      const size = rand(sizeMin, sizeMax);
      const baseScale = size / 128;

      sprite.x = options.x;
      sprite.y = options.y;
      sprite.alpha = 1;
      sprite.scale.set(baseScale);

      this.live.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        maxLife: rand(lifeMin, lifeMax),
        spin: options.spin ?? 0,
        baseScale,
        endScaleFactor: options.endScaleFactor ?? 0.2,
        gravity: options.gravity ?? 0,
        drag: options.drag ?? 0.4,
      });
    }
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 66) / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dtMs;
      if (p.age >= p.maxLife) {
        p.sprite.visible = false;
        this.container.removeChild(p.sprite);
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
        continue;
      }
      const dragF = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragF;
      p.vy = p.vy * dragF + p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (p.spin !== 0) p.sprite.rotation += p.spin * dt;

      const t = p.age / p.maxLife;
      p.sprite.alpha = 1 - t * t;
      const s = p.baseScale * (1 + (p.endScaleFactor - 1) * t);
      p.sprite.scale.set(s);
    }
  }

  activeCount(): number {
    return this.live.length;
  }

  /** Detach all sprites (the owning scene root destroys the container). */
  dispose(): void {
    this.live = [];
    this.pool = [];
    this.container.removeChildren();
  }
}

/* ---------- tuned presets (the shared celebration language) ---------- */

export const bursts = {
  sparkle(ps: ParticleSystem, x: number, y: number, colors: number[] = [COLORS.glow, COLORS.glowSoft, 0xffffff]): void {
    ps.emit({ x, y, count: 16, colors, textures: [sparkTexture(), softGlowTexture()], speedMin: 30, speedMax: 150, sizeMin: 8, sizeMax: 18, lifeMin: 450, lifeMax: 900 });
  },
  bloom(ps: ParticleSystem, x: number, y: number, color: number = COLORS.glow): void {
    ps.emit({ x, y, count: 22, colors: [color, COLORS.glowSoft], textures: [softGlowTexture(), discTexture()], speedMin: 20, speedMax: 110, sizeMin: 14, sizeMax: 34, lifeMin: 500, lifeMax: 1000, endScaleFactor: 0.4 });
  },
  confetti(ps: ParticleSystem, x: number, y: number): void {
    ps.emit({
      x, y, count: 60,
      colors: [COLORS.glow, COLORS.coral, COLORS.mint, COLORS.spark, COLORS.ember],
      textures: [confettiTexture(), discTexture()],
      speedMin: 90, speedMax: 260,
      angleMin: -Math.PI * 0.85, angleMax: -Math.PI * 0.15,
      sizeMin: 9, sizeMax: 17,
      lifeMin: 900, lifeMax: 1700,
      gravity: 380, drag: 0.6, spin: 6,
      blend: 'normal',
      endScaleFactor: 0.8,
    });
  },
};
