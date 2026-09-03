import { Container, Graphics } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';

/* old hitKite / hitShadow radius, verbatim */
const HIT_RADIUS = 42;
/* kite diamond half-extents, verbatim from drawKite/drawShadow */
const KITE_HALF_W = 20;
const KITE_HALF_H = 26;
/* palette verbatim from KiteMatchScene */
const PALETTE = [0xf2549a, 0x4dc9ff, 0xffd76a, 0x7dffb8, 0xffa552, 0xb39ddb];

interface Kite {
  x: number;
  y: number;
  color: number;
  shape: ShapeKind;
  matched: boolean;
  view: Container;
  halo: Graphics;
}

interface Shadow {
  x: number;
  y: number;
  color: number;
  shape: ShapeKind;
  rotDeg: number;
  matched: boolean;
  view: Container;
  fill: Graphics;
  ring: Graphics;
}

type ShapeKind = 'diamond' | 'circle' | 'triangle' | 'star';

const SHAPES: ShapeKind[] = ['diamond', 'circle', 'triangle', 'star'];
/* round C 'rotated-shapes' variant: one neutral dark for EVERY shadow —
   color can no longer key the answer, only the silhouette can */
const SHADOW_NEUTRAL = 0x3a3554;

type Hint = 'none' | 'gentle' | 'clear' | 'show';

function shade(hex: number, factor: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((hex & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/** Multiply-look shadow: a dark, low-saturation version of the color —
    the hue stays readable so color matching remains the puzzle. */
function shadowTint(hex: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const luma = 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (c: number): number => Math.round((c * 0.4 + luma * 0.6) * 0.62);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** The silhouette path for one shape, centered on the origin.
    Shared by kites, shadows and match rings (round C variants). */
function shapePath(g: Graphics, shape: ShapeKind): void {
  if (shape === 'diamond') {
    g.moveTo(0, -KITE_HALF_H);
    g.lineTo(KITE_HALF_W, 0);
    g.lineTo(0, KITE_HALF_H);
    g.lineTo(-KITE_HALF_W, 0);
    g.closePath();
  } else if (shape === 'circle') {
    g.circle(0, 0, 22);
  } else if (shape === 'triangle') {
    g.moveTo(0, -KITE_HALF_H);
    g.lineTo(KITE_HALF_W + 2, KITE_HALF_H - 6);
    g.lineTo(-KITE_HALF_W - 2, KITE_HALF_H - 6);
    g.closePath();
  } else {
    /* five-point star: outer 24, inner 10 */
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 24 : 10;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }
}

/**
 * KiteMatch — match each kite to its shadow (space-sky).
 * Ported 1:1 from the Phaser scene: tap kite then color-matching
 * shadow, TOTAL from spec.params.itemCount (else DDA 3+floor(level*5)
 * clamped to the palette), wrong tap = attempt(false) + errorKind +
 * suggestHint ladder, whole board = one DDA round judged in win().
 * Rendering is PixiJS (two-tone gradient diamond + tail bows; shadow
 * = dark desaturated silhouette of the same color).
 */
export class KiteMatchScene extends GameScene {
  private kites: Kite[] = [];
  private shadows: Shadow[] = [];
  private selectedKite: number | null = null;
  private matchedCount = 0;
  private TOTAL = 4;
  private wrongSinceLastMatch = 0;
  /* wrong taps across the whole board: the completion score's input */
  private wrongTapsTotal = 0;
  private lastHint: Hint = 'none';
  /* round C 'rotated-shapes': tier-2+ shadows are shape-keyed AND rotated */
  private shapesMode = false;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.build();
  }

  protected build(): void {
    this.matchedCount = 0;
    this.selectedKite = null;
    this.wrongSinceLastMatch = 0;
    this.wrongTapsTotal = 0;
    this.lastHint = 'none';
    /* a GameSpec variant authors the count; otherwise DDA adapts it:
       kites = 3 + floor(level * 5), clamped to the palette so every
       kite keeps a unique, matchable color */
    const spec = this.ctx.spec;
    this.TOTAL = spec?.params.itemCount
      ? Math.min(spec.params.itemCount, 6)
      : Math.min(3 + Math.floor(this.dda.level() * 5), PALETTE.length);
    this.shapesMode = spec?.params.extra?.variant === 'rotated-shapes';
    /* four unique silhouettes, no color cue — the board must stay
       unambiguous, so the variant caps the count */
    if (this.shapesMode) this.TOTAL = Math.min(this.TOTAL, SHAPES.length);

    this.say([
      this.shapesMode
        ? 'הַצְּלָלִים הִתְגַּלְגְּלוּ בַּשָּׁמַיִם! מְצְאוּ אֶת הַצּוּרָה'
        : 'הָעִפְעוֹפִים הִתְבַּלְבְּלוּ בַּשָּׁמַיִם',
    ]);
    this.buildBoard();
    if (this.shapesMode) {
      this.ctx.hud.mission?.('הִשְׁתַמְשׁוּ בַּצּוּרוֹת — הֵן הִתְגַּלְגְּלוּ!');
    }
  }

  /* ---------- board construction ---------- */

  private buildBoard(): void {
    const n = this.TOTAL;
    const topY = this.h * 0.22;
    const spanY = this.h * 0.56;
    const yFor = (k: number): number => topY + (n > 1 ? (k * spanY) / (n - 1) : 0);

    /* kites on the left */
    this.kites = [];
    for (let i = 0; i < n; i++) {
      const { view, halo } = this.buildKiteView(PALETTE[i % PALETTE.length], this.shapesMode ? SHAPES[i % SHAPES.length] : 'diamond');
      view.x = this.w * 0.25;
      view.y = yFor(i);
      this.root.addChild(view);
      this.kites.push({ x: this.w * 0.25, y: yFor(i), color: PALETTE[i % PALETTE.length], shape: this.shapesMode ? SHAPES[i % SHAPES.length] : 'diamond', matched: false, view, halo });
    }

    /* shadows on the right, shuffled order */
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.shadows = [];
    for (let i = 0; i < n; i++) {
      const shape = this.shapesMode ? SHAPES[i % SHAPES.length] : 'diamond';
      const { view, fill, ring } = this.buildShadowView(this.shapesMode ? SHADOW_NEUTRAL : PALETTE[i % PALETTE.length], shape);
      /* the variant's rotation: half right angles, half half-turns —
         deterministic per shuffled slot, never a wobble */
      const rotDeg = this.shapesMode ? (i % 2 === 0 ? 90 : 180) : 0;
      view.rotation = (rotDeg * Math.PI) / 180;
      view.x = this.w * 0.75;
      view.y = yFor(order[i]);
      this.root.addChild(view);
      this.shadows.push({
        x: this.w * 0.75,
        y: yFor(order[i]),
        color: this.shapesMode ? SHADOW_NEUTRAL : PALETTE[i % PALETTE.length],
        shape,
        rotDeg,
        matched: false,
        view,
        fill,
        ring,
      });
    }
  }

  private buildKiteView(color: number, shape: ShapeKind): { view: Container; halo: Graphics } {
    const view = new Container();

    /* halo while selected (old: gold disc alpha 0.2, radius 44) */
    const halo = new Graphics();
    halo.circle(0, 0, 44).fill({ color: 0xffd76a, alpha: 0.2 });
    halo.visible = false;
    view.addChild(halo);

    const diamond = new Graphics();
    shapePath(diamond, shape);
    diamond.fill({ color });
    /* lighter overlay = the original two-pass lightening (same path) */
    shapePath(diamond, shape);
    diamond.fill({ color: shade(color, 1.25), alpha: 0.5 });
    /* cross lines only on the diamond (the original kite) */
    if (shape === 'diamond') {
      diamond.moveTo(0, -KITE_HALF_H);
      diamond.lineTo(0, KITE_HALF_H);
      diamond.moveTo(-KITE_HALF_W, 0);
      diamond.lineTo(KITE_HALF_W, 0);
      diamond.stroke({ color: COLORS.cream, width: 1.5, alpha: 0.4 });
    }
    view.addChild(diamond);

    /* tail + bows */
    const tail = new Graphics();
    tail.moveTo(0, KITE_HALF_H);
    tail.lineTo(6, 40);
    tail.lineTo(-4, 52);
    tail.stroke({ color, width: 2, alpha: 0.7 });
    const bows: Array<[number, number]> = [[6, 40], [-4, 52]];
    for (const [bx, by] of bows) {
      tail.moveTo(bx, by - 4.5);
      tail.lineTo(bx + 4, by);
      tail.lineTo(bx, by + 4.5);
      tail.lineTo(bx - 4, by);
      tail.closePath();
      tail.fill({ color: shade(color, 0.85) });
    }
    view.addChild(tail);

    return { view, halo };
  }

  private buildShadowView(color: number, shape: ShapeKind): { view: Container; fill: Graphics; ring: Graphics } {
    const view = new Container();

    /* dark desaturated silhouette so the child can actually match
       by color (classic) — in the rotated-shapes variant every shadow
       shares one neutral dark, so only the silhouette can match */
    const fill = new Graphics();
    shapePath(fill, shape);
    fill.fill({ color: shadowTint(color) });
    view.addChild(fill);

    /* mint stroke once matched (verbatim from the old drawShadow) */
    const ring = new Graphics();
    shapePath(ring, shape);
    ring.stroke({ color: 0x7dffb8, width: 2, alpha: 0.8 });
    ring.visible = false;
    view.addChild(ring);

    return { view, fill, ring };
  }

  /* ---------- gameplay ---------- */

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    /* gentle sway, verbatim rhythm: sin(t*1.8 + i) * 4 — matched kites
       keep their docked position at the shadow */
    for (let i = 0; i < this.kites.length; i++) {
      const kite = this.kites[i];
      if (kite.matched || kite.view.destroyed) continue;
      kite.view.x = kite.x + Math.sin((this.t / 1000) * 1.8 + i) * 4;
    }
  }

  private refreshSelection(): void {
    for (let i = 0; i < this.kites.length; i++) {
      this.kites[i].halo.visible = i === this.selectedKite;
    }
  }

  private hitKite(px: number, py: number): number | null {
    for (let i = 0; i < this.kites.length; i++) {
      const k = this.kites[i];
      if (k.matched) continue;
      if (Math.hypot(px - k.x, py - k.y) < HIT_RADIUS) return i;
    }
    return null;
  }

  private hitShadow(px: number, py: number): number | null {
    for (let i = 0; i < this.shadows.length; i++) {
      const s = this.shadows[i];
      if (s.matched) continue;
      if (Math.hypot(px - s.x, py - s.y) < HIT_RADIUS) return i;
    }
    return null;
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished()) return false;

    /* tap a kite to select it */
    const ki = this.hitKite(x, y);
    if (ki !== null) {
      this.selectedKite = ki;
      this.refreshSelection();
      audio.play('pop', 1);
      this.say(['עַכְשָׁיו בּוֹא נִמְצָא אֶת הַצֵּל']);
      return true;
    }

    const hasSelection = this.selectedKite !== null;
    const kiteIndex = this.selectedKite;
    if (kiteIndex !== null) {
      /* tap a shadow while a kite is selected */
      const si = this.hitShadow(x, y);
      if (si !== null) {
        const kite = this.kites[kiteIndex];
        const shadow = this.shadows[si];
        if (!shadow.matched && (this.shapesMode ? kite.shape === shadow.shape : kite.color === shadow.color)) {
          kite.matched = true;
          shadow.matched = true;
          this.matchedCount++;
          this.selectedKite = null;
          this.refreshSelection();
          /* the kite FLIES to its shadow and docks — the payoff moment */
          this.anim.to(kite.view, { x: shadow.x, y: shadow.y - 6, rotation: 0 }, { durationMs: 720, ease: ease.inOutCubic });
          kite.view.alpha = 0.85;
          shadow.fill.alpha = 0.3;
          shadow.ring.visible = true;
          this.score.hit(20, { x: shadow.x, y: shadow.y });
          this.sparkle(shadow.x, shadow.y, [kite.color, COLORS.glow, 0xffffff]);
          audio.play('chime', kite.color % 4);
          this.ctx.hud.mission?.(
            this.matchedCount >= this.TOTAL ? 'כָּל הָעִפְּעוֹפִים נָחְתוּ!' : `נָחֲתוּ ${this.matchedCount} מִתּוֹךְ ${this.TOTAL}`,
          );
          /* a single match is NOT a DDA round: the round is the whole
             board, judged once in win(). Signals stay fine-grained. */
          this.signals.attempt('spatial.matching', true);
          this.wrongSinceLastMatch = 0;
          if (this.matchedCount >= this.TOTAL) {
            this.win();
          } else {
            this.say(['וָאו! הִתְאֲמָה מֻשְׁלֶמֶת!']);
          }
        } else {
          this.wrongSinceLastMatch++;
          this.wrongTapsTotal++;
          this.score.miss({ x, y });
          this.fx.flash(0xffffff, 140, 0.12);
          this.signals.attempt('spatial.matching', false);
          /* error taxonomy: a shadow tapped with no kite selected =
             shape confusion; with a kite selected = wrong shadow
             (this branch only runs with a selection, so the old
             'wrong-shape' arm stays unreachable, exactly as before) */
          this.signals.errorKind('spatial.matching', hasSelection ? 'wrong-shadow' : 'wrong-shape');
          /* visible, escalating help instead of a silent difficulty drop */
          const hint = this.suggestHint(this.wrongSinceLastMatch);
          this.lastHint = hint;
          this.say([
            hint === 'show'
              ? this.shapesMode
                ? 'מִצְאוּ צֵל בְּאוֹתָהּ צוּרָה — גַּם אִם הִיא הִתְגַּלְגְּלָה'
                : 'מִצְאוּ צֵל בְּאוֹתוֹ צֶבַע כְּמוֹ הָעִפְּעוֹף'
              : hint === 'clear'
                ? this.shapesMode
                  ? 'הִסְתַּכְּלוּ עַל הַצּוּרָה שֶׁל הָעִפְּעוֹף שֶׁנִּבְחַר'
                  : 'הִסְתַּכְּלוּ עַל הַצֶּבַע שֶׁל הָעִפְּעוֹף שֶׁנִּבְחַר'
                : 'נַסֶּה צֵל אַחֵר',
          ]);
        }
        return true;
      }
    }
    return false;
  }

  private win(): void {
    /* the whole board is one DDA round, scored by its cleanliness */
    this.dda.outcome(true, Math.max(0.3, 1 - this.wrongTapsTotal * 0.2));
    this.say(['וָאו, כָּל הַכָּבוֹד! הָעִפְעוֹפִים מָצְאוּ אֶת הַצְּלָלִים!']);
    audio.play('fanfare');
    this.fx.sparkleRain(this.particles, this.w);
    this.finishWithCeremony({ title: 'הַשָּׁמַיִם שָׁקְטִים' });
  }

  debugState(): Record<string, unknown> {
    const selected = this.selectedKite !== null ? this.kites[this.selectedKite] : null;
    return {
      kind: 'kite-match',
      variant: this.shapesMode ? 'rotated-shapes' : 'classic',
      kites: this.kites.map((k) => ({
        x: Math.round(k.x),
        y: Math.round(k.y),
        color: k.color,
        shape: k.shape,
        matched: k.matched,
      })),
      shadows: this.shadows.map((s) => ({
        x: Math.round(s.x),
        y: Math.round(s.y),
        color: s.color,
        shape: s.shape,
        rotDeg: s.rotDeg,
        matched: s.matched,
      })),
      selectedKind: selected ? selected.color : null,
      selected: this.selectedKite,
      wrongSinceLastMatch: this.wrongSinceLastMatch,
      wrongTotal: this.wrongTapsTotal,
      hint: this.lastHint,
      done: this.isFinished(),
    };
  }
}
