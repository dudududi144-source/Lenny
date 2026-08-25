/* ============================================================
 * ParticleBurst — a lightweight, reusable particle system.
 *
 * Why this exists: every game in the garden needs celebratory
 * effects (flowers blooming, stars sparkling, confetti). Instead
 * of re-implementing particles in each scene, we build ONE solid
 * system and reuse it everywhere.
 *
 * Design notes (the "exemplar" part):
 *  - Pure object pool: no allocations during gameplay.
 *  - Single Graphics object draws all particles (fast).
 *  - Config-driven: callers pass a BurstConfig, not code.
 *  - Deterministic-safe: works with any Phaser scene.
 * ============================================================ */

import Phaser from 'phaser';

export interface BurstConfig {
  x: number;
  y: number;
  count: number;
  colors: number[];
  /* initial speed range (px/sec) */
  speedMin: number;
  speedMax: number;
  /* particle radius range */
  sizeMin: number;
  sizeMax: number;
  /* seconds each particle lives */
  lifeMin: number;
  lifeMax: number;
  /* gravity pull (positive = down) */
  gravity?: number;
  /* if true, particles slow down over time */
  friction?: number;
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  life: number;
  maxLife: number;
}

export class ParticleBurst {
  private pool: Particle[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private capacity: number;

  constructor(scene: Phaser.Scene, capacity: number = 220) {
    this.capacity = capacity;
    this.graphics = scene.add.graphics();
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        alive: false, x: 0, y: 0, vx: 0, vy: 0,
        size: 1, color: 0xffffff, life: 0, maxLife: 1,
      });
    }
  }

  /** Fire a burst of particles using a declarative config. */
  emit(cfg: BurstConfig): void {
    const gravity = cfg.gravity ?? 0;
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= cfg.count) break;
      if (p.alive) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      p.alive = true;
      p.x = cfg.x;
      p.y = cfg.y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
      p.color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      p.maxLife = cfg.lifeMin + Math.random() * (cfg.lifeMax - cfg.lifeMin);
      p.life = p.maxLife;
      spawned++;
    }
    void gravity;
  }

  /** Advance simulation and draw all live particles. Call from scene update(). */
  update(dt: number, gravity: number = 0, friction: number = 1): void {
    const g = this.graphics;
    g.clear();
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += gravity * dt;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const alpha = Math.max(0, p.life / p.maxLife);
      g.fillStyle(p.color, alpha);
      g.fillCircle(p.x, p.y, p.size * alpha + 0.5);
    }
  }

  /** How many particles are currently alive. */
  activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.alive) n++;
    return n;
  }

  /** Clean up the graphics object. */
  destroy(): void {
    this.graphics.destroy();
  }
}

/* ---------- Preset configs for common garden effects ---------- */

export function bloomBurst(x: number, y: number): BurstConfig {
  return {
    x, y, count: 26,
    colors: [0xf2549a, 0xffd76a, 0x7dffb8, 0xfff6ec],
    speedMin: 40, speedMax: 150,
    sizeMin: 1.5, sizeMax: 4,
    lifeMin: 0.5, lifeMax: 1.1,
    gravity: 60, friction: 0.985,
  };
}

export function sparkleBurst(x: number, y: number): BurstConfig {
  return {
    x, y, count: 18,
    colors: [0xffd76a, 0xfff6ec],
    speedMin: 20, speedMax: 90,
    sizeMin: 1, sizeMax: 2.5,
    lifeMin: 0.4, lifeMax: 0.9,
    gravity: 0, friction: 0.98,
  };
}

export function confettiBurst(x: number, y: number): BurstConfig {
  return {
    x, y, count: 60,
    colors: [0xf2549a, 0x4dc9ff, 0xffd76a, 0x7dffb8, 0x7c4dff, 0xffa552],
    speedMin: 80, speedMax: 260,
    sizeMin: 2, sizeMax: 5,
    lifeMin: 0.8, lifeMax: 1.6,
    gravity: 180, friction: 0.99,
  };
}
