import { Container, Sprite } from 'pixi.js';
import { softGlowTexture, sparkTexture, verticalGradientTexture } from './textures';
import { COLORS } from './theme';

interface StarRec {
  sprite: Sprite;
  phase: number;
  speed: number;
  baseAlpha: number;
}

interface FireflyRec {
  sprite: Sprite;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  sx: number;
  sy: number;
  phase: number;
}

/** Shared scene background: deep-space gradient, drifting nebulae,
    twinkling star layers and wandering fireflies. Rich depth, zero
    image assets — everything baked from canvas gradients. */
export class GardenBackdrop {
  readonly container = new Container();
  private stars: StarRec[] = [];
  private fireflies: FireflyRec[] = [];
  private nebulas: Sprite[] = [];

  constructor(width: number, height: number) {
    this.container.eventMode = 'none';

    const sky = new Sprite(verticalGradientTexture('backdrop-void', [
      [0, '#1a1f3a'],
      [0.5, '#0a0f1e'],
      [1, '#050810'],
    ]));
    sky.width = width;
    sky.height = height;
    this.container.addChild(sky);

    const nebulaSpecs: Array<{ color: number; x: number; y: number; size: number; alpha: number }> = [
      { color: COLORS.spark, x: width * 0.22, y: height * 0.18, size: 320, alpha: 0.2 },
      { color: COLORS.coral, x: width * 0.85, y: height * 0.42, size: 260, alpha: 0.14 },
      { color: COLORS.mint, x: width * 0.5, y: height * 0.86, size: 300, alpha: 0.1 },
    ];
    for (const spec of nebulaSpecs) {
      const s = new Sprite(softGlowTexture());
      s.texture = softGlowTexture();
      s.tint = spec.color;
      s.anchor.set(0.5);
      s.x = spec.x;
      s.y = spec.y;
      s.width = spec.size;
      s.height = spec.size;
      s.alpha = spec.alpha;
      s.blendMode = 'add';
      this.nebulas.push(s);
      this.container.addChild(s);
    }

    for (let i = 0; i < 70; i++) {
      const star = new Sprite(sparkTexture());
      star.anchor.set(0.5);
      star.x = Math.random() * width;
      star.y = Math.random() * height * 0.82;
      const size = 4 + Math.random() * 9;
      star.width = size;
      star.height = size;
      star.tint = Math.random() < 0.75 ? 0xffffff : COLORS.glowSoft;
      star.blendMode = 'add';
      const rec: StarRec = {
        sprite: star,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
        baseAlpha: 0.25 + Math.random() * 0.6,
      };
      star.alpha = rec.baseAlpha;
      this.stars.push(rec);
      this.container.addChild(star);
    }

    const fireflyColors = [COLORS.glow, COLORS.mint, COLORS.glowSoft];
    for (let i = 0; i < 9; i++) {
      const f = new Sprite(softGlowTexture());
      f.anchor.set(0.5);
      f.tint = fireflyColors[i % fireflyColors.length];
      f.blendMode = 'add';
      const size = 10 + Math.random() * 14;
      f.width = size;
      f.height = size;
      const rec: FireflyRec = {
        sprite: f,
        cx: width * (0.12 + Math.random() * 0.76),
        cy: height * (0.3 + Math.random() * 0.55),
        rx: 24 + Math.random() * 60,
        ry: 16 + Math.random() * 44,
        sx: 0.3 + Math.random() * 0.5,
        sy: 0.24 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      };
      this.fireflies.push(rec);
      this.container.addChild(f);
    }
  }

  update(dtMs: number, elapsedMs: number): void {
    const t = elapsedMs / 1000;
    for (const rec of this.stars) {
      rec.sprite.alpha = rec.baseAlpha * (0.55 + 0.45 * Math.sin(t * rec.speed + rec.phase));
    }
    for (const rec of this.fireflies) {
      rec.sprite.x = rec.cx + Math.sin(t * rec.sx + rec.phase) * rec.rx;
      rec.sprite.y = rec.cy + Math.sin(t * rec.sy + rec.phase * 1.7) * rec.ry;
      rec.sprite.alpha = 0.35 + 0.3 * Math.sin(t * 1.3 + rec.phase);
    }
    for (let i = 0; i < this.nebulas.length; i++) {
      const n = this.nebulas[i];
      n.x += Math.sin(t * 0.08 + i * 2.1) * 0.04 * (dtMs / 16.7);
    }
  }
}
