import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { softGlowTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { music } from '../../audio/MusicEngine';

const TAP_MIN_GAP_MS = 700;
const HIT_R = 44;

interface Lantern {
  baseX: number;
  baseY: number;
  lit: boolean;
  view: Container;
  halo: Sprite;
}

/**
 * BreathPool — calm lantern lighting (breath-pool).
 * Ported 1:1 from LennyStoryScene: taps faster than 700ms are ignored
 * (breathing pace), no DDA, no signals — a gentle regulating experience.
 */
export class BreathPoolScene extends GameScene {
  private lanterns: Lantern[] = [];
  private litCount = 0;
  private total = 3;
  private lastTap = -Infinity;
  private poolG: Graphics;
  private shimmerG: Graphics;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.poolG = new Graphics();
    this.shimmerG = new Graphics();
    this.root.addChild(this.poolG);
    this.root.addChild(this.shimmerG);
    this.build();
  }

  protected build(): void {
    this.total = this.ctx.spec?.params.itemCount ? Math.min(this.ctx.spec.params.itemCount, 5) : 3;

    /* calm pool */
    this.poolG.ellipse(this.w / 2, this.h * 0.62, this.w * 0.4, this.h * 0.08);
    this.poolG.fill({ color: 0x1a2a5a, alpha: 0.7 });

    for (let i = 0; i < this.total; i++) {
      const baseX = this.w * ((i + 1) / (this.total + 1));
      const baseY = this.h * 0.45;

      const halo = new Sprite(softGlowTexture());
      halo.anchor.set(0.5);
      halo.tint = COLORS.glow;
      halo.blendMode = 'add';
      halo.width = 110;
      halo.height = 110;
      halo.alpha = 0.18;

      const body = new Graphics();
      body.roundRect(-14, -22, 28, 44, 12);
      body.fill({ color: 0xffd76a });
      body.roundRect(-11, -19, 22, 38, 9);
      body.fill({ color: 0xffe9a6 });
      body.roundRect(-9, 14, 18, 6, 3).fill({ color: 0xff9e5e });
      body.roundRect(-10, -28, 20, 8, 4).fill({ color: 0xb3542e });

      const view = new Container();
      view.addChild(halo, body);
      view.x = baseX;
      view.y = baseY;
      this.root.addChild(view);

      this.lanterns.push({ baseX, baseY, lit: false, view, halo });
    }

    this.say([
      'בְּרֵכַת הַנְּשִׁימָה שְׁקֵטָה הַלַּיְלָה...',
      'בּוֹא נַדְלִיק אֶת הַפָּנָסִים בִּנְשִׁימוֹת רַכּוֹת.',
      'נִגְעוּ לְאַט בְּכָל פָּנָס.',
    ]);
    this.ctx.hud.ringCounts(0, this.total);
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished()) return false;
    /* encourage slow, calm taps: ignore taps faster than 700ms apart */
    if (this.t - this.lastTap < TAP_MIN_GAP_MS) return true;
    this.lastTap = this.t;

    for (const lantern of this.lanterns) {
      if (!lantern.lit && Math.hypot(x - lantern.view.x, y - lantern.view.y) < HIT_R) {
        lantern.lit = true;
        this.litCount++;
        this.ctx.hud.ringCounts(this.litCount, this.total);
        lantern.halo.alpha = 0.55;
        /* Stage 5: a lit lantern earns its real glow */
        this.glowOn(lantern.view, COLORS.glow, 2.1);
        this.sparkle(lantern.view.x, lantern.view.y);
        this.score.hit(15, { x: lantern.view.x, y: lantern.view.y });
        audio.play('chime', this.litCount % 4);
        /* Stage 6: each slow tap IS one breath — the melody layer enters
           only here, at the breath peak (night mood is pad-only otherwise) */
        music.breathPeak();
        this.ctx.hud.mission?.(`הֻדְלְקוּ ${this.litCount} מִתּוֹךְ ${this.total} פְּנָסִים`);
        this.ripple(lantern.view.x, this.h * 0.62, COLORS.sparkLight);
        if (this.litCount >= this.total) this.finale();
        return true;
      }
    }
    return false;
  }

  private finale(): void {
    this.say(['וָאו, כָּל הַכָּבוֹד!', 'הַפָּנָסִים מְאִירִים אֶת הַבְּרֵכָה.']);
    this.score.hit(30, { x: this.w / 2, y: this.h * 0.5 }, 'הַבְּרֵכָה זוֹהֶרֶת');
    audio.play('unlock');
    this.fx.sparkleRain(this.particles, this.w);
    this.finishWithCeremony({ title: 'הַבְּרֵכָה זוֹהֶרֶת', quiet: true });
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    const t = this.t / 1000;

    for (const lantern of this.lanterns) {
      const bob = Math.sin(t * 1.4 + lantern.baseX) * 5;
      lantern.view.y = lantern.baseY + bob;
      if (lantern.lit) {
        lantern.halo.alpha = 0.5 + 0.12 * Math.sin(t * 2 + lantern.baseX);
      }
    }

    /* water shimmer */
    this.shimmerG.clear();
    for (let i = 0; i < 5; i++) {
      const sx = this.w * (0.2 + i * 0.15) + Math.sin(t + i) * 6;
      this.shimmerG.moveTo(sx, this.h * 0.6);
      this.shimmerG.lineTo(sx + 20, this.h * 0.6);
      this.shimmerG.stroke({ color: 0x4dc9ff, width: 1.5, alpha: 0.25 });
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'lenny-story',
      lanterns: this.lanterns.map((l) => ({ x: Math.round(l.view.x), y: Math.round(l.view.y), lit: l.lit })),
      lit: this.litCount,
      total: this.total,
      done: this.isFinished(),
    };
  }
}
