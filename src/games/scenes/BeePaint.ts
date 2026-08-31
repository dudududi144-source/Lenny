import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  blendHex,
  colorHex,
  mixPrimaries,
  type MixedColor,
  type Primary,
} from '../fx/ColorMixSystem';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { discTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';

interface Petal {
  angle: number;      /* position around the flower center */
  color: number;      /* filled color, 0 = empty */
  filled: boolean;
}

interface ColorSpot<T> {
  x: number;
  y: number;
  color: T;
}

const PETALS = 5;
const PETAL_R = 55;
const PETAL_HIT = 40;
const WIN_GAP_MS = 2200;
const MIXED_ORDER: MixedColor[] = ['orange', 'green', 'purple'];

/* verbatim Hebrew color names from the old scene */
const COLOR_NAME_HE: Record<MixedColor, string> = {
  red: 'אָדֹם', yellow: 'צָהֹב', blue: 'כָּחֹל',
  orange: 'כָּתֹם', green: 'יָרֹק', purple: 'סָגֹל',
};

/**
 * BeePaint — paint the flower with REAL color mixing (creativity-meadow).
 * Ported 1:1 from the Phaser scene on ColorMixSystem: the bee only has
 * the primaries the DDA offers (2 + floor(level*2), capped at 3); tap
 * two primaries to mix orange / green / purple and the fresh mixed
 * color immediately fills the next empty petal (blendHex sheen layered
 * over the petal = the gradient look). A single primary tapped twice
 * selects the plain color — then a petal tap fills it, exactly like the
 * old scene. Open-ended: no wrong answer, one DDA outcome at completion.
 */
export class BeePaintScene extends GameScene {
  private petals: Petal[] = [];
  private primaries: Primary[] = ['red', 'yellow', 'blue'];
  private selectedColor = colorHex('red');
  private mixPick: Primary | null = null;
  private mixedUnlocked: MixedColor[] = [];
  private lastMixed: MixedColor | null = null;
  private primarySpots: ColorSpot<Primary>[] = [];
  private mixedSpots: ColorSpot<MixedColor>[] = [];
  private sheens: Sprite[] = [];

  private flowerG!: Graphics;
  private paletteG!: Graphics;
  private msgText!: Text;

  /* bee mascot: tween-driven anchor + bobbing vector body */
  private bee = new Container();
  private beeBody = new Container();
  private wingL!: Graphics;
  private wingR!: Graphics;
  private beeAnchor = { x: 0, y: 0 };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.build();
  }

  protected build(): void {
    this.petals = [];
    this.mixedUnlocked = [];
    this.mixPick = null;
    this.lastMixed = null;
    /* DDA adapts the palette: colors = 2 + floor(level * 2), capped at
       the 3 primaries (2 colors = simple mixing, 3 = full discovery) */
    const colorCount = Math.min(3, Math.max(2, 2 + Math.floor(this.dda.level() * 2)));
    this.primaries = this.primaries.slice(0, colorCount);

    this.msgText = this.label('הַדְּבוֹרָה רוֹצָה לְצַיֵּר פֶּרַח', 16, COLORS.cream);
    this.msgText.x = this.w / 2;
    this.msgText.y = this.h * 0.07;

    /* init petals empty */
    for (let i = 0; i < PETALS; i++) {
      this.petals.push({ angle: (i / PETALS) * Math.PI * 2, color: 0, filled: false });
    }

    /* primary palette (row 1), evenly spaced for the adaptive count */
    this.primarySpots = [];
    for (let i = 0; i < this.primaries.length; i++) {
      this.primarySpots.push({
        x: this.w * ((i + 1) / (this.primaries.length + 1)),
        y: this.h * 0.78,
        color: this.primaries[i],
      });
    }
    /* mixed-color slots (row 2), revealed as the child mixes */
    this.mixedSpots = [];
    for (let i = 0; i < MIXED_ORDER.length; i++) {
      this.mixedSpots.push({ x: this.w * (0.25 + i * 0.25), y: this.h * 0.9, color: MIXED_ORDER[i] });
    }

    /* layered blendHex sheen per petal (the gradient look) */
    this.sheens = this.petals.map(() => {
      const sheen = new Sprite(discTexture());
      sheen.anchor.set(0.5);
      sheen.alpha = 0.5;
      sheen.width = 62;
      sheen.height = 34;
      sheen.visible = false;
      return sheen;
    });

    this.flowerG = new Graphics();
    this.paletteG = new Graphics();
    this.buildBee();

    this.root.addChild(this.flowerG, ...this.sheens, this.bee, this.paletteG, this.msgText);

    const intro = this.ctx.spec?.narrative.intro ?? ['הַדְּבוֹרָה רוֹצָה לְצַיֵּר פֶּרַח'];
    this.say(intro);
  }

  /* ---------- layout helpers ---------- */

  private flowerCenter(): { x: number; y: number } {
    return { x: this.w / 2, y: this.h * 0.42 };
  }

  private petalPos(petal: Petal): { x: number; y: number } {
    const c = this.flowerCenter();
    return { x: c.x + Math.cos(petal.angle) * PETAL_R, y: c.y + Math.sin(petal.angle) * PETAL_R };
  }

  private colorNameHe(c: MixedColor): string {
    return COLOR_NAME_HE[c];
  }

  /* ---------- the bee ---------- */

  private buildBee(): void {
    const halo = this.glowSprite(0xffd76a, 92, 0.3);
    this.wingL = new Graphics();
    this.wingL.ellipse(0, 0, 6, 4).fill({ color: 0xffffff, alpha: 0.5 });
    this.wingL.x = -4;
    this.wingL.y = -12;
    this.wingR = new Graphics();
    this.wingR.ellipse(0, 0, 6, 4).fill({ color: 0xffffff, alpha: 0.5 });
    this.wingR.x = 4;
    this.wingR.y = -12;

    const body = new Graphics();
    body.ellipse(0, 0, 10, 7).fill({ color: 0xffd76a });
    const bodySheen = new Sprite(discTexture());
    bodySheen.anchor.set(0.5);
    bodySheen.tint = blendHex(0xffd76a, 0xffffff, 0.45);
    bodySheen.alpha = 0.5;
    bodySheen.width = 16;
    bodySheen.height = 10;
    bodySheen.y = -2;
    const stripes = new Graphics();
    stripes.rect(-5, -7, 3, 14).fill({ color: 0x0a0416, alpha: 0.8 });
    stripes.rect(2, -7, 3, 14).fill({ color: 0x0a0416, alpha: 0.8 });
    const head = new Graphics();
    head.circle(7, -2, 2).fill({ color: 0x0a0416 });

    this.beeBody.addChild(halo, this.wingL, this.wingR, body, bodySheen, stripes, head);
    this.bee.addChild(this.beeBody);
    const c = this.flowerCenter();
    this.bee.x = c.x + 60;
    this.bee.y = c.y - 90;
    this.beeAnchor = { x: this.bee.x, y: this.bee.y };

    this.anim.loop(() => {
      const flap = Math.sin(this.t * 0.018) * 4;
      this.wingL.y = -12 + flap;
      this.wingR.y = -12 - flap;
      /* gentle hover around the tweened anchor */
      this.beeBody.x = Math.sin(this.t / 800) * 3;
      this.beeBody.y = Math.cos(this.t / 650) * 3;
    });
  }

  /** The bee flies to the petal being filled (rendering only). */
  private beeFlyTo(px: number, py: number): void {
    this.beeAnchor = { x: px + 6, y: py - 30 };
    this.anim.to(this.bee, { x: this.beeAnchor.x, y: this.beeAnchor.y }, { durationMs: 640, ease: ease.outCubic });
  }

  /* ---------- gameplay ---------- */

  private setMsg(text: string): void {
    this.msgText.text = text;
  }

  private hitPetal(px: number, py: number): number | null {
    for (let i = 0; i < this.petals.length; i++) {
      const pos = this.petalPos(this.petals[i]);
      if (Math.hypot(px - pos.x, py - pos.y) < PETAL_HIT) return i;
    }
    return null;
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished()) return false;

    /* tap an unlocked mixed color -> select it */
    for (const spot of this.mixedSpots) {
      if (this.mixedUnlocked.includes(spot.color) && Math.hypot(x - spot.x, y - spot.y) < 30) {
        this.sparkle(spot.x, spot.y);
        this.selectedColor = colorHex(spot.color);
        this.mixPick = null;
        this.setMsg('צֶבַע מְעֹרָב! בּוֹא נְמַלֵּא עָלֶה');
        return true;
      }
    }

    /* tap a primary -> select, or mix with the previous pick */
    for (const spot of this.primarySpots) {
      if (Math.hypot(x - spot.x, y - spot.y) < 30) {
        this.sparkle(spot.x, spot.y);
        if (this.mixPick === null) {
          this.mixPick = spot.color;
          this.selectedColor = colorHex(spot.color);
          this.setMsg('בּוֹא נְעַרְבֵּב! בַּחֲרוּ עוֹד צֶבַע, אוֹ צַיְּרוּ עָלֶה');
        } else if (this.mixPick === spot.color) {
          this.mixPick = null;
          this.selectedColor = colorHex(spot.color);
          this.setMsg('צֶבַע יָפֶה! בּוֹא נְמַלֵּא עָלֶה');
        } else {
          const result = mixPrimaries(this.mixPick, spot.color);
          this.mixPick = null;
          this.selectedColor = colorHex(result);
          if (!this.mixedUnlocked.includes(result)) this.mixedUnlocked.push(result);
          this.bloom(spot.x, spot.y - 30, colorHex(result));
          this.setMsg('וָאו! יָצַרְנוּ ' + this.colorNameHe(result) + '!');
          this.lastMixed = result;
          /* the fresh mixed color immediately fills the next empty petal */
          this.fillNextPetal();
        }
        return true;
      }
    }

    /* tap a petal -> fill it with the selected color */
    const petalIdx = this.hitPetal(x, y);
    if (petalIdx !== null) {
      const petal = this.petals[petalIdx];
      if (!petal.filled) this.fillPetal(petal, true);
      return true;
    }
    return false;
  }

  private fillPetal(petal: Petal, announce: boolean): void {
    if (petal.filled) return;
    petal.filled = true;
    petal.color = this.selectedColor;
    const pos = this.petalPos(petal);
    this.bloom(pos.x, pos.y, petal.color);
    this.beeFlyTo(pos.x, pos.y);
    if (announce) this.setMsg('וָאו! הֶעָלֶה פּוֹרֵחַ!');
    this.ctx.hud.ringCounts(this.petals.filter((p) => p.filled).length, PETALS);
    this.checkComplete();
  }

  private fillNextPetal(): void {
    const petal = this.petals.find((p) => !p.filled);
    if (!petal) return;
    this.fillPetal(petal, false);
  }

  private checkComplete(): void {
    if (this.isFinished()) return;
    const allFilled = this.petals.every((pt) => pt.filled);
    if (!allFilled) return;

    const c = this.flowerCenter();
    this.setMsg('וָאו, כָּל הַכָּבוֹד! הַפֶּרַח פָּרַח!');
    this.sparkle(c.x, c.y, [COLORS.glow, 0xffa552, 0xffffff]);

    /* open-ended game: completion is the single DDA outcome */
    this.dda.outcome(true, 1);
    this.finish(WIN_GAP_MS);
  }

  /* ---------- drawing (same geometry as the Phaser Graphics) ---------- */

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    this.drawFlower();
    this.drawPalette();
  }

  private drawFlower(): void {
    const g = this.flowerG;
    const c = this.flowerCenter();
    const t = this.t / 1000;
    g.clear();

    /* stem */
    g.moveTo(c.x, c.y + 60)
      .lineTo(c.x + Math.sin(t * 1.2) * 3, this.h * 0.75)
      .stroke({ color: 0x4caf6e, width: 5 });

    /* petals */
    for (let i = 0; i < this.petals.length; i++) {
      const pt = this.petals[i];
      const pos = this.petalPos(pt);
      if (pt.filled) {
        g.ellipse(pos.x, pos.y, 35, 22).fill({ color: pt.color, alpha: 0.95 });
        g.ellipse(pos.x, pos.y, 35, 22).stroke({ color: 0xfff6ec, width: 2, alpha: 0.4 });
      } else {
        g.ellipse(pos.x, pos.y, 35, 22).stroke({ color: 0xfff6ec, width: 2, alpha: 0.4 });
      }
      const sheen = this.sheens[i];
      sheen.visible = pt.filled;
      sheen.x = pos.x;
      sheen.y = pos.y - 3;
      sheen.tint = blendHex(pt.color, 0xffffff, 0.4);
    }

    /* flower center */
    g.circle(c.x, c.y, 28).fill({ color: 0xffd76a });
    g.circle(c.x, c.y, 16).fill({ color: 0xffa552, alpha: 0.6 });
  }

  private drawPalette(): void {
    const g = this.paletteG;
    g.clear();

    /* primaries (row 1) */
    for (const spot of this.primarySpots) {
      const hex = colorHex(spot.color);
      const isSel = hex === this.selectedColor && this.mixPick === null;
      const isArmed = this.mixPick === spot.color;
      g.circle(spot.x, spot.y, isSel || isArmed ? 22 : 17).fill({ color: hex });
      if (isSel) g.circle(spot.x, spot.y, 25).stroke({ color: 0xfff6ec, width: 3, alpha: 0.9 });
      if (isArmed) {
        /* gentle pulsing ring shows this color is waiting to be mixed */
        const glow = blendHex(hex, 0xffffff, 0.5);
        g.circle(spot.x, spot.y, 26).stroke({ color: glow, width: 3, alpha: 0.9 });
      }
    }

    /* mixed colors (row 2) - revealed once discovered */
    for (const spot of this.mixedSpots) {
      const unlocked = this.mixedUnlocked.includes(spot.color);
      if (unlocked) {
        const hex = colorHex(spot.color);
        const isSel = hex === this.selectedColor;
        g.circle(spot.x, spot.y, isSel ? 20 : 15).fill({ color: hex });
        if (isSel) g.circle(spot.x, spot.y, 23).stroke({ color: 0xfff6ec, width: 3, alpha: 0.9 });
      } else {
        g.circle(spot.x, spot.y, 15).stroke({ color: 0xfff6ec, width: 2, alpha: 0.25 });
        g.circle(spot.x, spot.y, 3).fill({ color: 0xfff6ec, alpha: 0.25 });
      }
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'bee-paint',
      primariesOffered: this.primaries.length,
      petalsFilled: this.petals.filter((p) => p.filled).length,
      petalsTotal: PETALS,
      lastMixed: this.lastMixed,
      primarySpots: this.primarySpots.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), color: s.color })),
      mixedSpots: this.mixedSpots.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), color: s.color, unlocked: this.mixedUnlocked.includes(s.color) })),
      done: this.isFinished(),
    };
  }
}
