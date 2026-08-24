/* ============================================================
 * GalaxySystem — the home screen of 144 games
 * 9 orbital rings (one per category) x 16 stars (games).
 * Rings counter-rotate at gentle speeds. Unlocked stars glow;
 * locked stars are dormant embers. Touch = select & reveal.
 * ============================================================ */

import Phaser from 'phaser';
import { CATEGORIES, CATEGORY_ORDER, GAMES, GameDef } from '../data/games';
import { GALAXY, COLORS } from '../data/portalConfig';

interface OrbitStar {
  game: GameDef;
  angle: number;      /* current angular position */
  baseAngle: number;  /* starting offset */
}

interface Ring {
  category: (typeof CATEGORY_ORDER)[number];
  radius: number;
  speed: number;      /* radians/sec, signed for direction */
  stars: OrbitStar[];
}

export class GalaxySystem {
  private rings: Ring[] = [];
  private hoverGame: GameDef | null = null;

  constructor() {
    this.buildRings();
  }

  private buildRings(): void {
    for (let r = 0; r < CATEGORY_ORDER.length; r++) {
      const cat = CATEGORY_ORDER[r];
      const radius = GALAXY.baseRadius + r * GALAXY.ringGap;
      const direction = r % 2 === 0 ? 1 : -1;
      const speed = direction * GALAXY.orbitSpeed * (1 + r * 0.06);

      const gamesInCat = GAMES.filter((g) => g.category === cat);
      const stars: OrbitStar[] = gamesInCat.map((game, i) => ({
        game,
        baseAngle: (i / gamesInCat.length) * Math.PI * 2 + r * 0.7,
        angle: 0,
      }));

      this.rings.push({ category: cat, radius, speed, stars });
    }
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      for (const s of ring.stars) {
        s.angle = s.baseAngle + this.elapsed * ring.speed;
      }
    }
    this.elapsed += dt;
  }
  private elapsed = 0;

  /**
   * Draw the galaxy.
   * @param cx, cy center (usually screen center)
   * @param scale  fraction of min(w,h) multiplier
   */
  draw(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    minDim: number,
    t: number
  ): void {
    /* --- orbit guide rings --- */
    for (const ring of this.rings) {
      const rr = ring.radius * minDim;
      g.lineStyle(1, CATEGORIES[ring.category].color, 0.10);
      g.strokeCircle(cx, cy, rr);
    }

    /* --- stars --- */
    for (const ring of this.rings) {
      const meta = CATEGORIES[ring.category];
      const rr = ring.radius * minDim;
      for (const s of ring.stars) {
        const sx = cx + Math.cos(s.angle) * rr;
        const sy = cy + Math.sin(s.angle) * rr;
        const unlocked = s.game.unlocked;
        const isHover = this.hoverGame === s.game;

        if (unlocked) {
          const tw = 0.7 + 0.3 * Math.sin(t * 2 + s.baseAngle);
          /* glow */
          g.fillStyle(meta.color, 0.18 * tw);
          g.fillCircle(sx, sy, GALAXY.starSize * (isHover ? 3.2 : 2.2));
          /* body */
          g.fillStyle(meta.color, 0.95);
          g.fillCircle(sx, sy, GALAXY.starSize * (isHover ? 1.4 : 0.9) * tw);
          /* core */
          g.fillStyle(0xfff6ec, 0.8);
          g.fillCircle(sx, sy, GALAXY.starSize * 0.35);
        } else {
          /* dormant ember */
          const breathe = 0.5 + 0.15 * Math.sin(t * 0.8 + s.baseAngle);
          g.fillStyle(COLORS.locked, 0.5 * breathe);
          g.fillCircle(sx, sy, GALAXY.starSize * 0.6);
          g.lineStyle(1, meta.color, 0.12);
          g.strokeCircle(sx, sy, GALAXY.starSize * 0.9);
        }
      }
    }
  }

  /**
   * Hit-test a pointer against all stars.
   * Returns the game under the touch, or null.
   */
  hitTest(px: number, py: number, cx: number, cy: number, minDim: number): GameDef | null {
    let best: GameDef | null = null;
    let bestDist = Infinity;
    for (const ring of this.rings) {
      const rr = ring.radius * minDim;
      for (const s of ring.stars) {
        const sx = cx + Math.cos(s.angle) * rr;
        const sy = cy + Math.sin(s.angle) * rr;
        const d = Math.hypot(px - sx, py - sy);
        if (d < GALAXY.starSize * 2.6 && d < bestDist) {
          bestDist = d;
          best = s.game;
        }
      }
    }
    return best;
  }

  setHover(game: GameDef | null): void {
    this.hoverGame = game;
  }

  getHover(): GameDef | null {
    return this.hoverGame;
  }
}
