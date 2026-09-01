import { Container, FillGradient, Graphics, Sprite } from 'pixi.js';
import { ease, type AnimationSystem } from './AnimationSystem';
import { softGlowTexture } from './textures';
import { COLORS } from './theme';

/* ============================================================
   LennyActor v2 (Stage 5) — Lenny is now a living character.

   body     five-point star, warm gradient + real glow filter
   eyes     follow the pointer (2px range), lock & focus on
            success/failure moments, blink on their own
   mouth    three moods — neutral / happy / gentle-sad
   hands    tiny claps (3 taps) on celebration
   body     breathing (1→1.02→1, 3s) + idle dip every ~5s
   entrance bounce drop from the roof, 500ms easeOutBounce
   ============================================================ */

export type LennyMood = 'neutral' | 'happy' | 'sad';

export interface LennyOptions {
  /** star radius in world units */
  size?: number;
  /** attach a real glow filter to the body (GameScene.glowOn) */
  glow?: (target: Container) => void;
  /** last known pointer position in world units (for eye tracking) */
  pointer?: () => { x: number; y: number } | null;
}

interface Eye {
  white: Graphics;
  pupil: Graphics;
  /** pupil rest offset from the eye center */
  baseX: number;
  baseY: number;
}

const BREATH_MS = 3000;
const IDLE_EVERY_MS = 5000;
const BLINK_EVERY_MS = 3800;

export class LennyActor {
  readonly root = new Container();
  private anim: AnimationSystem;
  private size: number;
  private pointer: () => { x: number; y: number } | null;
  private body = new Container();
  private starG = new Graphics();
  private mouthG = new Graphics();
  private eyes: Eye[] = [];
  private hands: Graphics[] = [];
  private halo: Sprite;

  private mood: LennyMood = 'neutral';
  private age = 0;
  private idleTimer = 0;
  private blinkTimer = 2600;
  private blinkT = 0; /* >0 while a blink is running */
  private focusT = 0; /* >0 while eyes are locked */
  private clapT = 0; /* >0 while clapping */
  private destroyed = false;

  constructor(anim: AnimationSystem, opts: LennyOptions = {}) {
    this.anim = anim;
    this.size = opts.size ?? 54;
    this.pointer = opts.pointer ?? (() => null);
    this.root.eventMode = 'none';

    /* halo first (behind), then body, face, hands */
    this.halo = new Sprite(softGlowTexture());
    this.halo.anchor.set(0.5);
    this.halo.tint = COLORS.glow;
    this.halo.blendMode = 'add';
    this.halo.alpha = 0.5;
    const haloSize = this.size * 3.1;
    this.halo.width = haloSize;
    this.halo.height = haloSize;
    this.root.addChild(this.halo);

    this.drawStar();
    this.body.addChild(this.starG);

    /* eyes */
    const eyeY = -this.size * 0.16;
    const eyeDx = this.size * 0.26;
    for (const dx of [-eyeDx, eyeDx]) {
      const white = new Graphics().circle(0, 0, this.size * 0.13).fill({ color: 0xfffdf4 });
      const pupil = new Graphics().circle(0, 0, this.size * 0.06).fill({ color: 0x241a33 });
      white.x = dx;
      white.y = eyeY;
      pupil.x = dx;
      pupil.y = eyeY;
      this.body.addChild(white, pupil);
      this.eyes.push({ white, pupil, baseX: dx, baseY: eyeY });
    }

    /* mouth */
    this.mouthG.y = this.size * 0.2;
    this.body.addChild(this.mouthG);
    this.drawMouth();

    /* little hands */
    for (const dx of [-this.size * 0.62, this.size * 0.62]) {
      const hand = new Graphics().circle(0, 0, this.size * 0.11).fill({ color: 0xffe9a6 });
      hand.x = dx;
      hand.y = this.size * 0.3;
      this.body.addChild(hand);
      this.hands.push(hand);
    }

    this.root.addChild(this.body);

    /* real glow filter on the whole figure */
    try {
      opts.glow?.(this.root);
    } catch { /* degrade silently — halo still reads as glow */ }
  }

  /* ---------------- drawing ---------------- */

  private drawStar(): void {
    const R = this.size;
    const r = R * 0.5;
    const g = this.starG;
    g.clear();
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    let gradient: FillGradient | null = null;
    try {
      gradient = new FillGradient(0, -R, 0, R * 0.9);
      gradient.addColorStop(0, '#ffe9a6');
      gradient.addColorStop(0.45, '#ffd76a');
      gradient.addColorStop(0.78, '#ff9e5e');
      gradient.addColorStop(1, '#f2549a');
    } catch {
      gradient = null;
    }
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (gradient) {
      try {
        g.fill({ fill: gradient });
      } catch {
        g.fill({ color: COLORS.glow });
      }
    } else {
      g.fill({ color: COLORS.glow });
    }
    /* soft top light */
    g.circle(-R * 0.18, -R * 0.34, R * 0.34).fill({ color: 0xfffdf4, alpha: 0.28 });
  }

  private drawMouth(): void {
    const g = this.mouthG;
    g.clear();
    const w = this.size * 0.3;
    if (this.mood === 'happy') {
      g.moveTo(-w, -2).quadraticCurveTo(0, this.size * 0.22, w, -2);
      g.stroke({ color: 0xc2452f, width: this.size * 0.075, cap: 'round' });
    } else if (this.mood === 'sad') {
      g.moveTo(-w * 0.8, 3).quadraticCurveTo(0, -this.size * 0.1, w * 0.8, 3);
      g.stroke({ color: 0xc2452f, width: this.size * 0.07, cap: 'round' });
    } else {
      g.moveTo(-w * 0.7, 0).quadraticCurveTo(0, this.size * 0.09, w * 0.7, 0);
      g.stroke({ color: 0xc2452f, width: this.size * 0.07, cap: 'round' });
    }
  }

  /* ---------------- behavior ---------------- */

  moodNow(): LennyMood {
    return this.mood;
  }

  setMood(mood: LennyMood): void {
    if (this.mood === mood || this.destroyed) return;
    this.mood = mood;
    this.drawMouth();
  }

  /** Success moment: eyes lock, happy face, three little claps. */
  celebrate(): void {
    if (this.destroyed) return;
    this.setMood('happy');
    this.focusT = 1100;
    this.clapT = 560;
  }

  /** A miss happened: brief gentle-sad focus, then back to neutral. */
  empathize(): void {
    if (this.destroyed) return;
    this.setMood('sad');
    this.focusT = 900;
    this.anim.after(1300, () => this.setMood('neutral'));
  }

  /** Bounce drop from the roof (500ms easeOutBounce). */
  enter(fromY: number, toY: number): void {
    if (this.destroyed) return;
    this.root.y = fromY;
    this.anim.to(this.root, { y: toY }, { durationMs: 500, ease: ease.outBounce });
  }

  update(dtMs: number): void {
    if (this.destroyed) return;
    this.age += dtMs;

    /* breathing: 1 → 1.02 → 1 over 3s */
    const breath = 1 + 0.01 * Math.sin((this.age / BREATH_MS) * Math.PI * 2);
    this.body.scale.set(breath);
    this.halo.alpha = 0.42 + 0.1 * Math.sin((this.age / BREATH_MS) * Math.PI * 2);

    /* idle dip every ~5s */
    this.idleTimer += dtMs;
    if (this.idleTimer >= IDLE_EVERY_MS) {
      this.idleTimer = 0;
      this.anim.to(this.body, { y: this.size * 0.08 }, { durationMs: 420, ease: ease.inOutSine, onDone: () => {
        if (!this.destroyed) this.anim.to(this.body, { y: 0 }, { durationMs: 520, ease: ease.inOutSine });
      } });
    }

    /* blinking */
    if (this.blinkT > 0) {
      this.blinkT -= dtMs;
      const k = Math.max(0.12, Math.abs(Math.cos((1 - this.blinkT / 160) * Math.PI * 0.5)));
      for (const e of this.eyes) e.white.scale.set(1, k);
    } else {
      this.blinkTimer += dtMs;
      if (this.blinkTimer >= BLINK_EVERY_MS) {
        this.blinkTimer = 0;
        this.blinkT = 160;
      }
    }

    /* eye tracking — subtle 2px-range drift toward the pointer,
       locked center-focus while focusT is active */
    if (this.focusT > 0) this.focusT -= dtMs;
    const p = this.pointer();
    const focus = this.focusT > 0;
    for (const e of this.eyes) {
      let ox = 0;
      let oy = 0;
      if (focus) {
        ox = 0;
        oy = this.size * 0.012;
      } else if (p) {
        const dx = p.x - this.root.x;
        const dy = p.y - this.root.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const range = this.size * 0.045; /* ≈2px at default size */
        ox = (dx / d) * Math.min(range, Math.abs(dx) > 0 ? range : 0);
        oy = (dy / d) * Math.min(range, Math.abs(dy) > 0 ? range : 0);
      }
      e.pupil.x = e.baseX + ox;
      e.pupil.y = e.baseY + oy;
    }

    /* clapping: hands meet and part, 3 taps */
    if (this.clapT > 0) {
      this.clapT -= dtMs;
      const phase = Math.sin((this.clapT / 560) * Math.PI * 6); /* 3 taps */
      const spread = this.size * 0.62 * (1 - 0.45 * Math.max(0, phase));
      this.hands[0].x = -spread;
      this.hands[1].x = spread;
      this.hands[0].rotation = -0.4 * Math.max(0, phase);
      this.hands[1].rotation = 0.4 * Math.max(0, phase);
    } else if (this.hands[0].x !== -this.size * 0.62) {
      for (const [i, hand] of this.hands.entries()) {
        hand.x = (i === 0 ? -1 : 1) * this.size * 0.62;
        hand.rotation = 0;
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.root.destroy({ children: true });
  }
}
