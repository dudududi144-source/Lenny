import { Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { sparkTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';

/**
 * Graceful placeholder for zones whose PixiJS scene is not rebuilt yet.
 * Shows the living garden backdrop with a bobbing star; replaced by real
 * scenes as Stage 3 progresses (registry entries added per commit).
 */
export class ComingSoonScene extends GameScene {
  private taps = 0;
  private star: Sprite | null = null;
  private sinceBurst = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.build();
    this.say(['הַאֲזוֹר הַזֶּה מִתְעוֹרֵר... בּוֹא נָבוֹא שׁוּב מָהֵר!']);
  }

  protected build(): void {
    const star = new Sprite(sparkTexture());
    star.anchor.set(0.5);
    star.texture = sparkTexture();
    star.tint = COLORS.glow;
    star.blendMode = 'add';
    star.width = 84;
    star.height = 84;
    star.x = this.w / 2;
    star.y = this.h * 0.42;
    this.star = star;

    const halo = this.glowSprite(COLORS.glow, 190, 0.4);
    halo.x = star.x;
    halo.y = star.y;

    const title = this.label('בְּקָרוֹב...', 30, COLORS.cream, '700');
    title.y = this.h * 0.42 + 110;
    const sub = this.label('הַגַּן מִתְעוֹרֵר, פָּרִחַ אַחַר פֶּרַח', 17, COLORS.glowSoft, '500');
    sub.y = title.y + 34;

    this.root.addChild(halo, star, title, sub);

    const bob = { y: star.y };
    this.anim.loop((dt) => {
      void dt;
      star.y = bob.y + Math.sin(this.t / 700) * 9;
      halo.y = star.y;
      halo.alpha = 0.34 + 0.1 * Math.sin(this.t / 500);
    });
    this.anim.to(bob, { y: star.y }, { durationMs: 1 });
  }

  update(dtMs: number): void {
    super.update(dtMs);
    this.sinceBurst += dtMs;
    if (this.sinceBurst > 1500 && this.star) {
      this.sinceBurst = 0;
      const angle = Math.random() * Math.PI * 2;
      this.sparkle(
        this.star.x + Math.cos(angle) * 70,
        this.star.y + Math.sin(angle) * 70,
        [COLORS.glow, COLORS.mint, COLORS.cream],
      );
    }
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished()) return false;
    this.taps++;
    this.ripple(x, y, COLORS.mint);
    this.sparkle(x, y);
    const pop = { s: 1 };
    this.anim.to(pop, { s: 0.86 }, { durationMs: 120, ease: ease.outQuad, onDone: () => {
      this.anim.to(pop, { s: 1 }, { durationMs: 340, ease: ease.outBack });
    } });
    if (this.star) {
      this.anim.to(this.star, { width: 70, height: 70 }, { durationMs: 110, ease: ease.outQuad, onDone: () => {
        this.anim.to(this.star!, { width: 84, height: 84 }, { durationMs: 380, ease: ease.outElastic });
      } });
    }
    return true;
  }

  debugState(): Record<string, unknown> {
    return { kind: 'coming-soon', taps: this.taps };
  }
}
