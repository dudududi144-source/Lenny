import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { softGlowTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';

const DONE_HIT = 40;
const DRAW_BOTTOM = 0.82;

interface Disc {
  x: number;
  y: number;
  r: number;
  color: number;
  kind: 'color' | 'size';
  value: number;
  ring: Graphics;
}

/**
 * OpenCanvas — free drawing (creativity-meadow).
 * Ported from OpenEndedScene: 7-color palette, 3 brush sizes, smooth
 * strokes, process-focused praise every 4 strokes, done button.
 * No DDA, no signals — pure creation.
 */
export class OpenCanvasScene extends GameScene {
  private color: number = COLORS.coral;
  private brushSize = 8;
  private strokes = 0;
  private praisesGiven = 0;
  private strokesG: Graphics;
  private current: Graphics | null = null;
  private lastX = 0;
  private lastY = 0;
  private drawing = false;
  private discs: Disc[] = [];
  private doneBtn: Container;
  private readonly palette = [0xf2549a, 0xffd76a, 0x4dc9ff, 0x7dffb8, 0x7c4dff, 0xffa552, 0xfff6ec];
  private readonly sizes = [4, 8, 14];
  private readonly praises = [
    'אֲנִי רוֹאָה קַוִּים!',
    'מַה זֶּה שֶׁצִּיַּרְתָּ?',
    'צֶבַע יָפֶה בָּחַרְתָּ!',
    'תְּנוּעָה מְעַנְיֶּנֶת!',
    'סַפֵּר לִי עַל הַצִּיּוּר',
  ];

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.strokesG = new Graphics();
    this.root.addChild(this.strokesG);

    const glass = new Graphics();
    glass.rect(0, this.h * DRAW_BOTTOM, this.w, this.h * (1 - DRAW_BOTTOM));
    glass.fill({ color: 0x0e1030, alpha: 0.55 });
    this.root.addChild(glass);

    /* color discs */
    for (let i = 0; i < this.palette.length; i++) {
      const disc = this.makeDisc(this.w * (0.1 + i * 0.133), this.h * 0.9, 16, this.palette[i], 'color', this.palette[i]);
      this.discs.push(disc);
    }
    /* size discs */
    for (let i = 0; i < this.sizes.length; i++) {
      const r = this.sizes[i];
      const disc = this.makeDisc(26 + i * 40, this.h * 0.965, Math.max(9, r * 0.9), COLORS.cream, 'size', r);
      this.discs.push(disc);
    }

    /* done button (vector checkmark — no emoji) */
    this.doneBtn = new Container();
    const btnBg = new Graphics();
    btnBg.circle(0, 0, 26).fill({ color: COLORS.mint });
    btnBg.circle(0, 0, 26).stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
    const check = new Graphics();
    check.moveTo(-9, 1);
    check.lineTo(-2, 9);
    check.lineTo(11, -8);
    check.stroke({ color: 0x0e1030, width: 4, cap: 'round' });
    this.doneBtn.addChild(btnBg, check);
    this.doneBtn.x = this.w / 2;
    this.doneBtn.y = this.h * 0.045;
    this.root.addChild(this.doneBtn);
    const halo = new Sprite(softGlowTexture());
    halo.anchor.set(0.5);
    halo.tint = COLORS.mint;
    halo.blendMode = 'add';
    halo.width = 84;
    halo.height = 84;
    halo.alpha = 0.3;
    this.doneBtn.addChildAt(halo, 0);

    this.say(['בְּרוּכִים הַבָּאִים לַאֲחוּ הַיְּצִירָה!', 'בּוֹא נְצַיֵּר חָפְשִׁי, אֵין נָכוֹן וְלֹא נָכוֹן.']);
    this.selectColor(this.palette[0]);
  }

  protected build(): void {
    /* construction happens in the constructor (palette + done button
       need to exist before the first pointer event) */
  }

  private makeDisc(x: number, y: number, r: number, color: number, kind: 'color' | 'size', value: number): Disc {
    const view = new Graphics();
    view.circle(0, 0, r).fill({ color });
    view.circle(0, 0, r).stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 });
    view.x = x;
    view.y = y;
    this.root.addChild(view);
    const ring = new Graphics();
    ring.circle(0, 0, r + 5).stroke({ color: COLORS.glow, width: 2.5 });
    ring.x = x;
    ring.y = y;
    ring.visible = false;
    this.root.addChild(ring);
    return { x, y, r, color, kind, value, ring };
  }

  private selectColor(color: number): void {
    this.color = color;
    for (const disc of this.discs) {
      if (disc.kind === 'color') disc.ring.visible = disc.color === color;
    }
  }

  private selectSize(size: number): void {
    this.brushSize = size;
    for (const disc of this.discs) {
      if (disc.kind === 'size') disc.ring.visible = disc.value === size;
    }
  }

  private hitDisc(x: number, y: number): Disc | null {
    return this.discs.find((d) => Math.hypot(x - d.x, y - d.y) < d.r + 10) ?? null;
  }

  private hitDone(x: number, y: number): boolean {
    return Math.hypot(x - this.doneBtn.x, y - this.doneBtn.y) < DONE_HIT;
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished()) return false;
    if (this.hitDone(x, y)) {
      this.say(['יָפֶה מְאֹד!']);
      audio.play('fanfare');
      this.score.hit(20, { x: this.w / 2, y: this.h * 0.3 }, 'הַצִּיּוּר גָּמוּר');
      this.finishWithCeremony({ title: 'הַגַּלְרֵיהּ שֶׁלָּךְ' });
      return true;
    }
    const disc = this.hitDisc(x, y);
    if (!disc) return false;
    if (disc.kind === 'color') {
      this.selectColor(disc.color);
      this.sparkle(disc.x, disc.y, [disc.color]);
    } else {
      this.selectSize(disc.value);
      this.sparkle(disc.x, disc.y);
    }
    audio.play('tick');
    return true;
  }

  onDragStart(x: number, y: number): void {
    if (this.isFinished()) return;
    if (this.hitDone(x, y) || this.hitDisc(x, y)) return;
    if (y > this.h * DRAW_BOTTOM) return;
    this.drawing = true;
    this.lastX = x;
    this.lastY = y;
    this.current = new Graphics();
    this.strokesG.addChild(this.current);
  }

  onDragMove(x: number, y: number): void {
    if (!this.drawing || !this.current) return;
    /* smooth interpolated strokes: midpoint quadratic feel via short
       round-capped segments */
    this.current.moveTo(this.lastX, this.lastY);
    this.current.lineTo(x, y);
    this.current.stroke({ color: this.color, width: this.brushSize, cap: 'round', join: 'round' });
    this.lastX = x;
    this.lastY = y;
  }

  onDragEnd(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.current = null;
    this.strokes++;
    if (this.strokes % 4 === 0) {
      const msg = this.praises[Math.floor(Math.random() * this.praises.length)];
      this.praisesGiven++;
      this.say([msg]);
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'open-create',
      strokes: this.strokes,
      color: this.color,
      brushSize: this.brushSize,
      praisesGiven: this.praisesGiven,
      done: this.isFinished(),
    };
  }
}
