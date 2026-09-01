import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { radialGradientTexture, softGlowTexture, sparkTexture } from './textures';
import { COLORS } from './theme';

/* ============================================================
   GardenBackdrop v2 (Stage 5) — three-layer parallax skies.

   Every zone gets its own world with REAL depth:
     layer 1 (far)   radial gradient sky + stars/dots        — slowest
     layer 2 (mid)   big soft silhouettes (waves/trees/...)  — medium
     layer 3 (near)  sharp little lives (fish/flowers/...)   — fastest

   Layers drift at different speeds (the depth feel) and wrap.
   Rebuilt on resize like v1; GameScene.update contract unchanged.
   ============================================================ */

export type BackdropTheme =
  | 'dawn'
  | 'ocean'
  | 'night-forest'
  | 'forest'
  | 'sky'
  | 'valley'
  | 'garden'
  | 'meadow'
  | 'stage';

export function backdropThemeForZone(zone: string): BackdropTheme {
  switch (zone) {
    case 'attention-stream':
    case 'breath-pool':
      return 'ocean';
    case 'memory-hill':
      return 'night-forest';
    case 'thinking-forest':
      return 'forest';
    case 'space-sky':
      return 'sky';
    case 'words-valley':
      return 'valley';
    case 'feelings-garden':
      return 'garden';
    case 'creativity-meadow':
      return 'meadow';
    case 'rhythm-square':
      return 'stage';
    case 'light-path':
    default:
      return 'dawn';
  }
}

interface ThemeSpec {
  sky: Array<[number, string]>;
  /** layer-2 silhouette kind */
  mid: 'waves' | 'trees' | 'clouds' | 'hills' | 'bokeh';
  midTint: number[];
  /** layer-3 sharp lives */
  near: 'fish' | 'fairies' | 'fireflies' | 'flowers' | 'letters' | 'petals';
  nearTint: number[];
  starCount: number;
  starTint: number[];
}

const THEMES: Record<BackdropTheme, ThemeSpec> = {
  dawn: {
    sky: [[0, '#1a1f3a'], [0.5, '#0a0f1e'], [1, '#050810']],
    mid: 'clouds', midTint: [COLORS.spark, COLORS.coral, COLORS.glow],
    near: 'fairies', nearTint: [COLORS.glow, COLORS.mint, COLORS.glowSoft],
    starCount: 70, starTint: [0xffffff, COLORS.glowSoft],
  },
  ocean: {
    sky: [[0, '#123a5e'], [0.45, '#0a1f3d'], [1, '#040a18']],
    mid: 'waves', midTint: [0x2a6f97, 0x1f5f8b, 0x18496e],
    near: 'fish', nearTint: [0x9adcff, 0x7fd4e8, 0x5aa9c9],
    starCount: 34, starTint: [0xbfe8ff, 0x8fd0ff],
  },
  'night-forest': {
    sky: [[0, '#131030'], [0.5, '#0a0820'], [1, '#05040f']],
    mid: 'trees', midTint: [0x1c2a4a, 0x16213c, 0x121a30],
    near: 'fairies', nearTint: [COLORS.glow, COLORS.sparkLight, COLORS.glowSoft],
    starCount: 56, starTint: [0xffffff, COLORS.glowSoft, COLORS.sparkLight],
  },
  forest: {
    sky: [[0, '#14301f'], [0.5, '#0b1f16'], [1, '#050f0c']],
    mid: 'trees', midTint: [0x1e4630, 0x173a27, 0x12301f],
    near: 'fireflies', nearTint: [0xd8f3a3, 0xffe9a6, 0xbff0c9],
    starCount: 30, starTint: [0xe8ffe0, 0xfff6c9],
  },
  sky: {
    sky: [[0, '#2b1a5e'], [0.5, '#141040'], [1, '#070618']],
    mid: 'clouds', midTint: [COLORS.spark, 0x6f5fcf, 0x4a3f9f],
    near: 'petals', nearTint: [COLORS.glowSoft, 0xffffff, COLORS.coral],
    starCount: 66, starTint: [0xffffff, COLORS.glowSoft, COLORS.sparkLight],
  },
  valley: {
    sky: [[0, '#3a2a1a'], [0.5, '#1f1826'], [1, '#0d0a14']],
    mid: 'hills', midTint: [0x4a3a6f, 0x3a2d58, 0x2d2245],
    near: 'letters', nearTint: [COLORS.glow, COLORS.glowSoft, 0xffffff],
    starCount: 44, starTint: [0xfff3d6, 0xffffff],
  },
  garden: {
    sky: [[0, '#4a1f3a'], [0.5, '#2a1028'], [1, '#140818']],
    mid: 'hills', midTint: [0x6f2f56, 0x58254a, 0x45203c],
    near: 'flowers', nearTint: [COLORS.coral, COLORS.glow, 0xfff0f6],
    starCount: 38, starTint: [0xffe9f2, 0xffffff],
  },
  meadow: {
    sky: [[0, '#1f3a2a'], [0.5, '#12281e'], [1, '#081510']],
    mid: 'clouds', midTint: [0x2f5f46, 0x27503a, 0x1f4230],
    near: 'flowers', nearTint: [COLORS.glow, COLORS.mint, COLORS.coral],
    starCount: 34, starTint: [0xf0ffe8, 0xfff6c9],
  },
  stage: {
    sky: [[0, '#2a1a10'], [0.5, '#170f0c'], [1, '#0b0708']],
    mid: 'bokeh', midTint: [COLORS.glow, COLORS.coral, COLORS.spark],
    near: 'fireflies', nearTint: [COLORS.glow, COLORS.ember, 0xffffff],
    starCount: 40, starTint: [0xfff0d6, 0xffd76a, 0xffffff],
  },
};

/** drift speeds per layer (px/s in world units) — the depth feel */
const DRIFT = { far: 3.2, mid: 8.5, near: 16 } as const;

interface Drifter {
  node: Container;
  speed: number;
  margin: number;
  bobPhase: number;
  bobAmp: number;
  baseY: number;
}

interface StarRec {
  sprite: Sprite;
  phase: number;
  speed: number;
  baseAlpha: number;
}

export class GardenBackdrop {
  readonly container = new Container();
  private layerFar = new Container();
  private layerMid = new Container();
  private layerNear = new Container();
  private drifters: Drifter[] = [];
  private stars: StarRec[] = [];
  private theme: BackdropTheme;
  private w = 0;
  private h = 0;

  constructor(width: number, height: number, theme: BackdropTheme = 'dawn') {
    this.container.eventMode = 'none';
    this.theme = theme;
    this.layerFar.eventMode = 'none';
    this.layerMid.eventMode = 'none';
    this.layerNear.eventMode = 'none';
    this.container.addChild(this.layerFar, this.layerMid, this.layerNear);
    this.build(width, height);
  }

  /** Rebuild for a new world size (Arena responsive layout). */
  resize(width: number, height: number): void {
    this.build(width, height);
  }

  private clear(): void {
    this.drifters = [];
    this.stars = [];
    for (const layer of [this.layerFar, this.layerMid, this.layerNear]) {
      layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    }
  }

  private build(width: number, height: number): void {
    this.clear();
    this.w = width;
    this.h = height;
    const spec = THEMES[this.theme] ?? THEMES.dawn;

    /* ---------- layer 1: far radial sky + stars/dots ---------- */
    const sky = new Sprite(radialGradientTexture(`bd-sky-${this.theme}`, spec.sky));
    sky.width = width;
    sky.height = height;
    this.layerFar.addChild(sky);

    for (let i = 0; i < spec.starCount; i++) {
      const star = new Sprite(sparkTexture());
      star.anchor.set(0.5);
      star.x = Math.random() * width;
      star.y = Math.random() * height * 0.82;
      const size = 4 + Math.random() * 9;
      star.width = size;
      star.height = size;
      star.tint = spec.starTint[Math.floor(Math.random() * spec.starTint.length)];
      star.blendMode = 'add';
      const rec: StarRec = {
        sprite: star,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
        baseAlpha: 0.22 + Math.random() * 0.55,
      };
      star.alpha = rec.baseAlpha;
      this.stars.push(rec);
      this.layerFar.addChild(star);
    }

    /* ---------- layer 2: mid silhouettes (soft, slow) ---------- */
    const midCount = this.theme === 'stage' ? 9 : 6;
    for (let i = 0; i < midCount; i++) {
      const shape = new Container();
      const tint = spec.midTint[i % spec.midTint.length];
      switch (spec.mid) {
        case 'waves': {
          const g = new Graphics();
          g.ellipse(0, 0, 110 + Math.random() * 90, 26 + Math.random() * 16).fill({ color: tint, alpha: 0.3 });
          shape.addChild(g);
          break;
        }
        case 'trees': {
          const g = new Graphics();
          const th = 90 + Math.random() * 110;
          g.moveTo(0, 0).lineTo(-26 - Math.random() * 10, 0).lineTo(0, -th).lineTo(26 + Math.random() * 10, 0).closePath().fill({ color: tint, alpha: 0.5 });
          g.ellipse(0, -th * 0.92, 30 + Math.random() * 16, 22).fill({ color: tint, alpha: 0.5 });
          shape.addChild(g);
          break;
        }
        case 'clouds': {
          const s = new Sprite(softGlowTexture());
          s.tint = tint;
          s.alpha = 0.16;
          s.width = 200 + Math.random() * 160;
          s.height = 70 + Math.random() * 50;
          shape.addChild(s);
          break;
        }
        case 'hills': {
          const g = new Graphics();
          g.ellipse(0, 0, 150 + Math.random() * 120, 44 + Math.random() * 30).fill({ color: tint, alpha: 0.34 });
          shape.addChild(g);
          break;
        }
        case 'bokeh': {
          const s = new Sprite(softGlowTexture());
          s.tint = tint;
          s.alpha = 0.14;
          s.width = 90 + Math.random() * 120;
          s.height = s.width;
          shape.addChild(s);
          break;
        }
      }
      const baseY = this.midBaseY(spec.mid, height, i, midCount);
      shape.x = (width / (midCount - 1 || 1)) * i + (Math.random() * 60 - 30);
      shape.y = baseY;
      this.layerMid.addChild(shape);
      this.drifters.push({
        node: shape,
        speed: DRIFT.mid * (0.7 + Math.random() * 0.6),
        margin: 140,
        bobPhase: Math.random() * Math.PI * 2,
        bobAmp: 3 + Math.random() * 4,
        baseY,
      });
    }

    /* ---------- layer 3: near little lives (sharp, faster) ---------- */
    const nearCount = spec.near === 'letters' ? 7 : 10;
    for (let i = 0; i < nearCount; i++) {
      const tint = spec.nearTint[i % spec.nearTint.length];
      const node = this.buildNearLife(spec.near, tint, width, height);
      if (!node) continue;
      const baseY = node.y;
      this.layerNear.addChild(node);
      this.drifters.push({
        node,
        speed: DRIFT.near * (0.6 + Math.random() * 0.8) * (Math.random() < 0.3 ? -1 : 1),
        margin: 60,
        bobPhase: Math.random() * Math.PI * 2,
        bobAmp: 4 + Math.random() * 7,
        baseY,
      });
    }
  }

  private midBaseY(kind: ThemeSpec['mid'], h: number, i: number, count: number): number {
    if (kind === 'clouds' || kind === 'bokeh') return h * (0.12 + 0.5 * (i / Math.max(1, count - 1)));
    if (kind === 'trees') return h * (0.66 + Math.random() * 0.26);
    if (kind === 'waves') return h * (0.55 + 0.42 * (i / Math.max(1, count - 1)));
    return h * (0.68 + 0.28 * (i / Math.max(1, count - 1)));
  }

  private buildNearLife(kind: ThemeSpec['near'], tint: number, w: number, h: number): Container | null {
    const node = new Container();
    switch (kind) {
      case 'fish': {
        const g = new Graphics();
        g.ellipse(0, 0, 13, 7).fill({ color: tint, alpha: 0.85 });
        g.moveTo(11, 0).lineTo(20, -6).lineTo(20, 6).closePath().fill({ color: tint, alpha: 0.7 });
        g.circle(-6, -1.5, 1.6).fill({ color: 0x06121f });
        node.addChild(g);
        break;
      }
      case 'fairies':
      case 'fireflies': {
        const s = new Sprite(softGlowTexture());
        s.tint = tint;
        s.blendMode = 'add';
        s.width = 14 + Math.random() * 12;
        s.height = s.width;
        node.addChild(s);
        break;
      }
      case 'flowers': {
        const g = new Graphics();
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.circle(Math.cos(a) * 5, Math.sin(a) * 5, 3.4).fill({ color: tint, alpha: 0.9 });
        }
        g.circle(0, 0, 2.6).fill({ color: 0xfff3d6 });
        node.addChild(g);
        break;
      }
      case 'letters': {
        const glyphs = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש', 'ל'];
        const t = new Text({
          text: glyphs[Math.floor(Math.random() * glyphs.length)],
          style: { fontFamily: 'Heebo, sans-serif', fontSize: 20, fontWeight: '700', fill: tint },
        });
        t.alpha = 0.32;
        t.resolution = 2;
        node.addChild(t);
        break;
      }
      case 'petals': {
        const s = new Sprite(sparkTexture());
        s.tint = tint;
        s.width = 12 + Math.random() * 10;
        s.height = s.width;
        s.rotation = Math.random() * Math.PI;
        node.addChild(s);
        break;
      }
    }
    node.x = Math.random() * w;
    node.y = h * (0.18 + Math.random() * 0.72);
    return node;
  }

  update(dtMs: number, elapsedMs: number): void {
    const dt = Math.min(dtMs, 66) / 1000;
    const t = elapsedMs / 1000;

    for (const rec of this.stars) {
      rec.sprite.alpha = rec.baseAlpha * (0.55 + 0.45 * Math.sin(t * rec.speed + rec.phase));
    }

    for (const d of this.drifters) {
      d.node.x += d.speed * dt;
      const right = this.w + d.margin;
      const left = -d.margin;
      if (d.node.x > right) d.node.x = left;
      else if (d.node.x < left) d.node.x = right;
      d.node.y = d.baseY + Math.sin(t * 0.6 + d.bobPhase) * d.bobAmp;
    }
  }
}
