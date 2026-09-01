import { Container, Sprite, Texture } from 'pixi.js';
import { confettiTexture, discTexture, ringTexture, softGlowTexture, sparkTexture } from './textures';
import { COLORS } from './theme';

/* GPU-batched particle engine v2 (Stage 5). All particles share a
   handful of baked textures + additive blending, so Pixi renders them
   in single-digit draw calls — 500+ simultaneous particles at 60fps.

   v2 adds the commercial layer:
     trails              — particles leave fading wakes
     gravity wells       — attractors (fish drift toward food, sparks to lanterns)
     color over lifetime — birth→death tint gradient per particle
     size over lifetime  — grow / shrink / pulse curves
   while keeping every v1 option + preset exactly compatible. */

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
  /* ---- v2 (all optional, zero breaking changes) ---- */
  /** death tint — the particle's color fades birth→death toward it */
  colorFadeTo?: number;
  /** size curve over lifetime (endScaleFactor stays compatible) */
  sizeCurve?: 'shrink' | 'grow' | 'pulse';
  /** spawn a wake sprite every N ms (0/undefined = no trail) */
  trailEvery?: number;
  /** trail sprite size factor relative to the particle */
  trailScale?: number;
  /** trail sprite lifetime ms */
  trailLife?: number;
  /** initial pull toward the nearest well (0..1 — additive) */
  wellAffinity?: number;
}

export interface GravityWell {
  x: number;
  y: number;
  /** px/s² at the well's center (negative repels) */
  strength: number;
  /** beyond this radius the well has no effect */
  radius: number;
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
  /* v2 */
  tintFrom: number;
  tintTo: number;
  sizeCurve: 'shrink' | 'grow' | 'pulse';
  trailEvery: number;
  trailScale: number;
  trailLife: number;
  trailAcc: number;
  wellAffinity: number;
}

interface TrailSprite {
  sprite: Sprite;
  age: number;
  maxLife: number;
  baseScale: number;
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
  private trails: TrailSprite[] = [];
  private wells: GravityWell[] = [];
  private readonly capacity: number;

  constructor(capacity = 1400) {
    this.capacity = capacity;
    this.container.eventMode = 'none';
  }

  /** Replace the gravity wells (call per-frame or per-layout). */
  setWells(wells: GravityWell[]): void {
    this.wells = wells;
  }

  clearWells(): void {
    this.wells = [];
  }

  wellCount(): number {
    return this.wells.length;
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
    const sizeCurve = options.sizeCurve ?? 'shrink';

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
        tintFrom: sprite.tint,
        tintTo: options.colorFadeTo ?? sprite.tint,
        sizeCurve,
        trailEvery: options.trailEvery ?? 0,
        trailScale: options.trailScale ?? 0.7,
        trailLife: options.trailLife ?? 420,
        trailAcc: 0,
        wellAffinity: options.wellAffinity ?? 0,
      });
    }
  }

  /** Spawn one trail/wake sprite directly from the pool (no re-roll). */
  private spawnTrail(x: number, y: number, tint: number, scale: number, lifeMs: number, blend: 'add' | 'normal'): void {
    if (this.trails.length + this.live.length >= this.capacity) return;
    const sprite = this.pool.pop() ?? new Sprite();
    sprite.texture = softGlowTexture();
    sprite.tint = tint;
    sprite.blendMode = blend;
    sprite.anchor.set(0.5);
    sprite.rotation = 0;
    sprite.visible = true;
    sprite.x = x;
    sprite.y = y;
    sprite.alpha = 0.7;
    sprite.scale.set(scale);
    this.container.addChild(sprite);
    this.trails.push({ sprite, age: 0, maxLife: lifeMs, baseScale: scale });
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 66) / 1000;

    /* gravity wells pull (or push) live particles */
    const wells = this.wells;

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

      if (wells.length > 0 && p.wellAffinity > 0) {
        for (const well of wells) {
          const dx = well.x - p.sprite.x;
          const dy = well.y - p.sprite.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > well.radius * well.radius || d2 < 1) continue;
          const d = Math.sqrt(d2);
          const falloff = 1 - d / well.radius;
          const a = well.strength * falloff * p.wellAffinity;
          p.vx += (dx / d) * a * dt;
          p.vy += (dy / d) * a * dt;
        }
      }

      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (p.spin !== 0) p.sprite.rotation += p.spin * dt;

      const t = p.age / p.maxLife;
      p.sprite.alpha = 1 - t * t;

      /* size over lifetime — v1 endScaleFactor stays the shrink target */
      if (p.sizeCurve === 'grow') {
        const s = p.baseScale * (0.35 + 0.65 * t * (1 + (p.endScaleFactor - 1) * 0.2));
        p.sprite.scale.set(s);
      } else if (p.sizeCurve === 'pulse') {
        const s = p.baseScale * (1 + 0.22 * Math.sin(t * Math.PI * 3)) * (1 + (p.endScaleFactor - 1) * t);
        p.sprite.scale.set(s);
      } else {
        const s = p.baseScale * (1 + (p.endScaleFactor - 1) * t);
        p.sprite.scale.set(s);
      }

      /* color over lifetime — birth→death gradient */
      if (p.tintTo !== p.tintFrom) {
        p.sprite.tint = lerpTint(p.tintFrom, p.tintTo, t);
      }

      /* trails */
      if (p.trailEvery > 0) {
        p.trailAcc += dtMs;
        if (p.trailAcc >= p.trailEvery) {
          p.trailAcc = 0;
          this.spawnTrail(
            p.sprite.x,
            p.sprite.y,
            p.sprite.tint,
            p.sprite.scale.x * p.trailScale,
            p.trailLife,
            p.sprite.blendMode === 'add' ? 'add' : 'normal',
          );
        }
      }
    }

    /* trail sprites fade fast, no motion */
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.age += dtMs;
      if (tr.age >= tr.maxLife) {
        tr.sprite.visible = false;
        this.container.removeChild(tr.sprite);
        this.pool.push(tr.sprite);
        this.trails.splice(i, 1);
        continue;
      }
      const t = tr.age / tr.maxLife;
      tr.sprite.alpha = 0.7 * (1 - t);
      tr.sprite.scale.set(tr.baseScale * (1 - 0.35 * t));
    }
  }

  activeCount(): number {
    return this.live.length + this.trails.length;
  }

  /** Detach all sprites (the owning scene root destroys the container). */
  dispose(): void {
    this.live = [];
    this.trails = [];
    this.pool = [];
    this.wells = [];
    this.container.removeChildren();
  }
}

function lerpTint(from: number, to: number, t: number): number {
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return (r << 16) | (g << 8) | b;
}

/* ---------- tuned presets (the shared celebration language) ---------- */

export const bursts = {
  sparkle(ps: ParticleSystem, x: number, y: number, colors: number[] = [COLORS.glow, COLORS.glowSoft, 0xffffff]): void {
    ps.emit({ x, y, count: 16, colors, textures: [sparkTexture(), softGlowTexture()], speedMin: 30, speedMax: 150, sizeMin: 8, sizeMax: 18, lifeMin: 450, lifeMax: 900, colorFadeTo: COLORS.glow });
  },
  bloom(ps: ParticleSystem, x: number, y: number, color: number = COLORS.glow): void {
    ps.emit({ x, y, count: 22, colors: [color, COLORS.glowSoft], textures: [softGlowTexture(), discTexture()], speedMin: 20, speedMax: 110, sizeMin: 14, sizeMax: 34, lifeMin: 500, lifeMax: 1000, endScaleFactor: 0.4, colorFadeTo: color, sizeCurve: 'pulse' });
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
      trailEvery: 90, trailScale: 0.45, trailLife: 300,
    });
  },
  ripple(ps: ParticleSystem, x: number, y: number, color: number = COLORS.glow): void {
    ps.emit({ x, y, count: 14, colors: [color], textures: [ringTexture()], speedMin: 10, speedMax: 40, sizeMin: 18, sizeMax: 30, lifeMin: 420, lifeMax: 700, endScaleFactor: 2.6, colorFadeTo: color, sizeCurve: 'grow', blend: 'add' });
  },
  /** comet wake — the signature v2 trail preset */
  trail(ps: ParticleSystem, x: number, y: number, angle: number, color: number = COLORS.glow): void {
    ps.emit({
      x, y, count: 10, colors: [color, COLORS.glowSoft],
      textures: [sparkTexture()],
      speedMin: 120, speedMax: 240,
      angleMin: angle - 0.2, angleMax: angle + 0.2,
      sizeMin: 7, sizeMax: 13,
      lifeMin: 700, lifeMax: 1200,
      drag: 0.55, spin: 2,
      trailEvery: 40, trailScale: 0.75, trailLife: 520,
      colorFadeTo: COLORS.ember,
      sizeCurve: 'shrink',
    });
  },
};

/* ---------- per-world themed emitters (Stage 5) ----------
   Every game gets particles that BELONG to its world:
   water for the pond, leaves for the forest, stardust in space. */

export type ParticleTheme =
  | 'water'
  | 'forest'
  | 'night'
  | 'space'
  | 'garden'
  | 'music'
  | 'wind'
  | 'light';

export const themed = {
  /** ambient motes that drift forever (call once per scene) */
  ambient(ps: ParticleSystem, w: number, h: number, theme: ParticleTheme, countOverride?: number): void {
    const specs: Record<ParticleTheme, { colors: number[]; count: number; rise: number; sway: number }> = {
      water: { colors: [0x9adcff, COLORS.glowSoft, 0xffffff], count: 26, rise: -14, sway: 22 },
      forest: { colors: [0xbff0c9, 0xffe9a6, 0xd8f3a3], count: 22, rise: 16, sway: 30 },
      night: { colors: [COLORS.sparkLight, COLORS.spark, COLORS.glowSoft], count: 24, rise: -9, sway: 26 },
      space: { colors: [0xffffff, COLORS.glowSoft, COLORS.sparkLight], count: 30, rise: -6, sway: 12 },
      garden: { colors: [COLORS.coral, COLORS.glow, 0xfff0f6], count: 24, rise: -18, sway: 34 },
      music: { colors: [COLORS.glow, COLORS.sparkLight, 0xffffff], count: 22, rise: -24, sway: 18 },
      wind: { colors: [0xcfe8ff, 0xffffff, COLORS.mint], count: 26, rise: -6, sway: 44 },
      light: { colors: [COLORS.glow, COLORS.glowSoft, 0xffffff], count: 24, rise: -12, sway: 20 },
    };
    const spec = specs[theme];
    const count = Math.max(1, countOverride ?? spec.count);
    for (let i = 0; i < count; i++) {
      ps.emit({
        x: Math.random() * w,
        y: Math.random() * h,
        count: 1,
        colors: spec.colors,
        textures: [softGlowTexture()],
        speedMin: spec.rise - 4,
        speedMax: spec.rise + 6,
        angleMin: Math.PI / 2 - spec.sway / 100,
        angleMax: Math.PI / 2 + spec.sway / 100,
        sizeMin: 4,
        sizeMax: 11,
        lifeMin: 3200,
        lifeMax: 6400,
        gravity: 0,
        drag: 0.02,
        endScaleFactor: 0.3,
        sizeCurve: 'pulse',
        trailEvery: 0,
      });
    }
  },

  /** an event burst in the world's own language */
  celebrate(ps: ParticleSystem, x: number, y: number, theme: ParticleTheme): void {
    switch (theme) {
      case 'water':
        ps.emit({ x, y, count: 26, colors: [0x9adcff, 0xffffff, COLORS.glowSoft], textures: [discTexture(), softGlowTexture()], speedMin: 60, speedMax: 200, angleMin: -Math.PI * 0.9, angleMax: -Math.PI * 0.1, gravity: 300, sizeMin: 6, sizeMax: 14, lifeMin: 600, lifeMax: 1100, trailEvery: 55, trailScale: 0.5, colorFadeTo: 0x2f6f9f });
        break;
      case 'forest':
        ps.emit({ x, y, count: 24, colors: [0xbff0c9, 0xffe9a6], textures: [confettiTexture()], speedMin: 40, speedMax: 150, gravity: 90, drag: 0.7, spin: 4, sizeMin: 7, sizeMax: 14, lifeMin: 900, lifeMax: 1600, blend: 'normal', colorFadeTo: 0x6f9f4f });
        break;
      case 'night':
        ps.emit({ x, y, count: 22, colors: [COLORS.sparkLight, COLORS.spark, 0xffffff], textures: [sparkTexture(), softGlowTexture()], speedMin: 30, speedMax: 130, sizeMin: 6, sizeMax: 15, lifeMin: 700, lifeMax: 1400, colorFadeTo: COLORS.spark });
        break;
      case 'space':
        ps.emit({ x, y, count: 26, colors: [0xffffff, COLORS.glowSoft], textures: [sparkTexture()], speedMin: 50, speedMax: 190, sizeMin: 5, sizeMax: 12, lifeMin: 600, lifeMax: 1300, trailEvery: 48, trailScale: 0.6, colorFadeTo: COLORS.sparkLight });
        break;
      case 'garden':
        ps.emit({ x, y, count: 24, colors: [COLORS.coral, COLORS.glow, 0xfff0f6], textures: [confettiTexture(), discTexture()], speedMin: 40, speedMax: 160, gravity: 110, spin: 3, sizeMin: 7, sizeMax: 15, lifeMin: 800, lifeMax: 1500, blend: 'normal', colorFadeTo: COLORS.coral });
        break;
      case 'music':
        ps.emit({ x, y, count: 22, colors: [COLORS.glow, COLORS.sparkLight], textures: [sparkTexture(), softGlowTexture()], speedMin: 40, speedMax: 170, sizeMin: 6, sizeMax: 14, lifeMin: 600, lifeMax: 1200, colorFadeTo: COLORS.ember });
        break;
      case 'wind':
        ps.emit({ x, y, count: 24, colors: [0xcfe8ff, 0xffffff, COLORS.mint], textures: [softGlowTexture()], speedMin: 70, speedMax: 210, angleMin: -0.5, angleMax: 0.5, sizeMin: 5, sizeMax: 12, lifeMin: 500, lifeMax: 1000, trailEvery: 50, trailScale: 0.6, colorFadeTo: 0x6f9fcf });
        break;
      case 'light':
      default:
        ps.emit({ x, y, count: 24, colors: [COLORS.glow, COLORS.glowSoft, 0xffffff], textures: [sparkTexture(), softGlowTexture()], speedMin: 40, speedMax: 170, sizeMin: 6, sizeMax: 16, lifeMin: 650, lifeMax: 1300, colorFadeTo: COLORS.ember, trailEvery: 60, trailScale: 0.55 });
        break;
    }
  },
};
