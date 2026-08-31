import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease, type TweenHandle } from '../engine/AnimationSystem';
import { discTexture, softGlowTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';

const ROUNDS = 3;
/* DragDropSystem grab radius, verbatim */
const GRAB_RADIUS = 42;
/* old drawAcorn drew the dragging acorn at size*7 instead of size*6 */
const DRAG_SCALE = 7 / 6;
/* below this pointer travel a press is a tap (tap-to-pick), not a drag */
const TAP_MOVE_EPS = 8;
/* rejected drops fly home (old 220ms snap-back, outBack per the port contract) */
const REJECT_HOME_MS = 340;
/* old scene: delayedCall(800) between rounds */
const ROUND_GAP_MS = 800;
const ACORN_BODY_HEX = 0xc8873a;
const ACORN_CAP_HEX = 0x8d5a3b;
const ACORN_STEM_HEX = 0x5a3a20;
const GHOST_ALPHA = 0.22;
const SLOT_RING_WIDTH = 2.5;
/* old drawAcorn radius: size * 6 (size = 1..N) */
const ACORN_UNIT = 6;

interface Acorn {
  id: string;
  sizeIndex: number;
  view: Container;
  halo: Sprite;
  homeX: number;
  homeY: number;
  placed: boolean;
  picked: boolean;
  tweens: TweenHandle[];
}

interface Slot {
  id: string;
  sizeIndex: number;
  x: number;
  y: number;
  radius: number;
  filled: boolean;
}

type Hint = 'none' | 'gentle' | 'clear' | 'show';

/**
 * AcornSort — drag-and-drop size ordering (thinking-forest).
 * Ported 1:1 from the Phaser scene: 3 rounds, acorn count from
 * spec.params.itemCount (else DDA: 4 + floor(level*6) clamped 8),
 * reject = attempt(false) + 'wrong-order' + hint ladder, round judged
 * once on completion. Rendering is PixiJS; a tap-to-pick/tap-to-place
 * interaction is added on top of drag for touch kids.
 */
export class AcornSortScene extends GameScene {
  private board = new Container();
  private slotG = new Graphics();
  private acorns: Acorn[] = [];
  private slots: Slot[] = [];
  private placedCount = 0;
  private round = 1;
  private readonly totalRounds = ROUNDS;
  private acornCount = 4;
  private rejectsThisRound = 0;
  private consecutiveMiss = 0;
  private lastHint: Hint = 'none';

  /* tap-pick / drag shared state */
  private held: Acorn | null = null;
  private dragging = false;
  private grabbedThisPress = false;
  private startX = 0;
  private startY = 0;
  private pressMoved = 0;
  private grabDX = 0;
  private grabDY = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.root.addChild(this.board);
    this.board.addChild(this.slotG);
    this.build();
  }

  protected build(): void {
    /* a GameSpec variant authors the count; otherwise DDA adapts it:
       acorns = 4 + floor(level * 6), clamped for layout sanity */
    const spec = this.ctx.spec;
    this.acornCount = spec?.params.itemCount
      ? Math.min(spec.params.itemCount, 5)
      : Math.min(4 + Math.floor(this.dda.level() * 6), 8);

    this.say([
      'הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים.',
      'גִּרְרוּ כָּל בְּלוּט לָעִגוּל שֶׁבַּגֹּדֶל שֶׁלּוֹ!',
    ]);
    this.spawnRound();
  }

  /* ---------- board construction ---------- */

  private spawnRound(): void {
    this.placedCount = 0;
    this.rejectsThisRound = 0;
    this.consecutiveMiss = 0;
    this.lastHint = 'none';
    this.held = null;
    this.dragging = false;
    this.ctx.hud.ringCounts(0, this.acornCount);

    for (const acorn of this.acorns) {
      this.killTweens(acorn);
      acorn.view.destroy({ children: true });
    }
    this.acorns = [];
    this.slots = [];

    /* scatter the acorns (shuffled) across the upper area */
    const xs: number[] = [];
    for (let i = 0; i < this.acornCount; i++) {
      xs.push(0.14 + (this.acornCount > 1 ? (i * 0.72) / (this.acornCount - 1) : 0.5));
    }
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    for (let s = 1; s <= this.acornCount; s++) {
      this.acorns.push(this.buildAcorn('acorn-' + s, s, this.w * xs[s - 1], this.h * 0.28));
    }

    /* drop circles along the bottom, left -> right = small -> large;
       radius shrinks with high counts so slots never overlap */
    const spacing = this.w * (this.acornCount > 1 ? 0.72 / (this.acornCount - 1) : 0.5);
    const slotR = Math.max(24, Math.min(44, Math.floor(spacing * 0.45)));
    for (let k = 1; k <= this.acornCount; k++) {
      const sx = 0.14 + (this.acornCount > 1 ? ((k - 1) * 0.72) / (this.acornCount - 1) : 0.5);
      this.slots.push({
        id: 'slot-' + k,
        sizeIndex: k,
        x: this.w * sx,
        y: this.h * 0.66,
        radius: slotR,
        filled: false,
      });
    }
  }

  private buildAcorn(id: string, sizeIndex: number, x: number, y: number): Acorn {
    const r = sizeIndex * ACORN_UNIT;
    const view = new Container();
    view.x = x;
    view.y = y;

    /* soft halo while the acorn is picked up */
    const halo = new Sprite(softGlowTexture());
    halo.anchor.set(0.5);
    halo.tint = COLORS.glow;
    halo.blendMode = 'add';
    halo.alpha = 0;
    halo.width = r * 5.2;
    halo.height = r * 5.2;
    view.addChild(halo);

    /* gradient disc body (baked disc texture, warm brown tint) */
    const body = new Sprite(discTexture());
    body.anchor.set(0.5);
    body.tint = ACORN_BODY_HEX;
    body.width = r * 1.6;
    body.height = r * 1.8;
    body.y = r * 0.2;
    view.addChild(body);

    /* layered highlight = the gradient */
    const sheen = new Sprite(softGlowTexture());
    sheen.anchor.set(0.5);
    sheen.tint = 0xffffff;
    sheen.alpha = 0.3;
    sheen.blendMode = 'add';
    sheen.width = r * 1.3;
    sheen.height = r * 1.1;
    sheen.y = -r * 0.3;
    view.addChild(sheen);

    /* darker cap arc */
    const cap = new Graphics();
    cap.ellipse(0, -r * 0.5, r * 0.85, r * 0.45).fill({ color: ACORN_CAP_HEX });
    view.addChild(cap);

    /* stem */
    const stem = new Graphics();
    stem.moveTo(0, -r * 0.9);
    stem.lineTo(0, -r * 1.1);
    stem.stroke({ color: ACORN_STEM_HEX, width: 2 });
    view.addChild(stem);

    this.board.addChild(view);
    return { id, sizeIndex, view, halo, homeX: x, homeY: y, placed: false, picked: false, tweens: [] };
  }

  /* ---------- slot layer (redrawn per frame, old update() shape) ---------- */

  private drawGhostAcorn(g: Graphics, x: number, y: number, r: number, alpha: number): void {
    g.ellipse(x, y + r * 0.2, r * 0.8, r * 0.9).fill({ color: ACORN_BODY_HEX, alpha });
    g.ellipse(x, y - r * 0.5, r * 0.85, r * 0.45).fill({ color: ACORN_CAP_HEX, alpha });
    g.moveTo(x, y - r * 0.9);
    g.lineTo(x, y - r * 1.1);
    g.stroke({ color: ACORN_STEM_HEX, width: 2, alpha });
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    const g = this.slotG;
    g.clear();

    /* drop circles with a faint size hint */
    const active = this.held !== null;
    for (const slot of this.slots) {
      g.circle(slot.x, slot.y, slot.radius).stroke({
        width: SLOT_RING_WIDTH,
        color: slot.filled ? 0x7dffb8 : 0xfff6ec,
        alpha: slot.filled ? 0.8 : (active ? 0.6 : 0.35),
      });
      if (!slot.filled) this.drawGhostAcorn(g, slot.x, slot.y, slot.sizeIndex * 3, GHOST_ALPHA);
    }
  }

  /* ---------- pick / drop ---------- */

  private killTweens(acorn: Acorn): void {
    for (const handle of acorn.tweens) handle.kill();
    acorn.tweens = [];
  }

  private lift(acorn: Acorn): void {
    this.killTweens(acorn);
    acorn.tweens = [
      this.anim.to(acorn.view.scale, { x: DRAG_SCALE, y: DRAG_SCALE }, { durationMs: 120, ease: ease.outQuad }),
      this.anim.to(acorn.halo, { alpha: 0.42 }, { durationMs: 120, ease: ease.outQuad }),
    ];
  }

  private settle(acorn: Acorn, snap: boolean): void {
    this.killTweens(acorn);
    if (snap) {
      acorn.view.scale.set(1);
      acorn.halo.alpha = 0;
      return;
    }
    acorn.tweens = [
      this.anim.to(acorn.view.scale, { x: 1, y: 1 }, { durationMs: 160, ease: ease.outQuad }),
      this.anim.to(acorn.halo, { alpha: 0 }, { durationMs: 160, ease: ease.outQuad }),
    ];
  }

  private pick(acorn: Acorn): void {
    this.held = acorn;
    acorn.picked = true;
    this.lift(acorn);
  }

  private freeAcornAt(x: number, y: number): Acorn | null {
    /* pick the top-most unplaced item under the pointer (radius 42) */
    for (let i = this.acorns.length - 1; i >= 0; i--) {
      const acorn = this.acorns[i];
      if (acorn.placed) continue;
      if (Math.hypot(x - acorn.view.x, y - acorn.view.y) < GRAB_RADIUS) return acorn;
    }
    return null;
  }

  private slotAt(x: number, y: number): Slot | null {
    return this.slots.find((s) => Math.hypot(x - s.x, y - s.y) < s.radius) ?? null;
  }

  onDragStart(x: number, y: number): void {
    if (this.isFinished()) return;
    if (this.held) {
      /* a held (tap-picked) acorn can start dragging from a new press */
      if (Math.hypot(x - this.held.view.x, y - this.held.view.y) <= GRAB_RADIUS + 6) {
        this.dragging = true;
        this.grabDX = this.held.view.x - x;
        this.grabDY = this.held.view.y - y;
        this.startX = x;
        this.startY = y;
        this.pressMoved = 0;
        this.grabbedThisPress = true;
      }
      return;
    }
    const acorn = this.freeAcornAt(x, y);
    if (!acorn) return;
    this.held = acorn;
    acorn.picked = true;
    this.grabDX = acorn.view.x - x;
    this.grabDY = acorn.view.y - y;
    this.startX = x;
    this.startY = y;
    this.pressMoved = 0;
    this.dragging = true;
    this.grabbedThisPress = true;
    this.lift(acorn);
  }

  onDragMove(x: number, y: number): void {
    if (!this.held || !this.dragging) return;
    this.pressMoved = Math.max(this.pressMoved, Math.hypot(x - this.startX, y - this.startY));
    this.held.view.x = x + this.grabDX;
    this.held.view.y = y + this.grabDY;
  }

  onDragEnd(x: number, y: number): void {
    if (!this.held || !this.dragging) return;
    this.dragging = false;
    if (this.pressMoved < TAP_MOVE_EPS) {
      /* tap, not drag: the acorn stays picked up (tap-to-pick) */
      return;
    }
    this.tryDrop(this.held, x, y);
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished()) return false;
    if (this.grabbedThisPress) {
      /* this press already grabbed/consumed by onDragStart */
      this.grabbedThisPress = false;
      return this.held !== null;
    }
    if (this.held) {
      /* tap-to-place: a tap on a circle drops the held acorn there */
      const slot = this.slotAt(x, y);
      if (slot) {
        this.tryDrop(this.held, x, y);
        return true;
      }
      /* tapping another free acorn switches the pick */
      const other = this.freeAcornAt(x, y);
      if (other && other !== this.held) {
        const prev = this.held;
        this.settle(prev, false);
        prev.picked = false;
        this.held = null;
        this.pick(other);
        return true;
      }
      /* open space while holding: keep holding (gentler than a reject) */
      return true;
    }
    const acorn = this.freeAcornAt(x, y);
    if (acorn) {
      this.pick(acorn);
      return true;
    }
    return false;
  }

  private tryDrop(acorn: Acorn, x: number, y: number): void {
    const slot = this.slotAt(x, y);
    if (slot && !slot.filled && slot.sizeIndex === acorn.sizeIndex) {
      slot.filled = true;
      acorn.placed = true;
      acorn.picked = false;
      this.held = null;
      this.dragging = false;
      acorn.view.x = slot.x;
      acorn.view.y = slot.y;
      this.settle(acorn, true);
      this.placedCount++;
      this.sparkle(slot.x, slot.y, [COLORS.glow, COLORS.glowSoft, 0xffffff]);
      this.ctx.hud.ringCounts(this.placedCount, this.acornCount);
      if (this.placedCount >= this.acornCount) {
        this.completeRound();
      } else {
        this.say(['כָּל הַכָּבוֹד! מַה הַבָּא?']);
      }
      return;
    }
    this.rejectDrop(acorn);
  }

  private rejectDrop(acorn: Acorn): void {
    this.rejectsThisRound++;
    this.consecutiveMiss++;
    /* a rejected drop is NOT a round loss: the round is one whole
       sort, judged once in completeRound. It feeds LearningSignals
       and the visible hint ladder instead. */
    this.signals.attempt('logic.ordering', false);
    /* error taxonomy: a rejected drop in a size-ordering game is
       an ordering mistake */
    this.signals.errorKind('logic.ordering', 'wrong-order');
    const hint = this.suggestHint(this.consecutiveMiss);
    this.lastHint = hint;
    this.say([
      hint === 'show'
        ? 'כָּל עִגוּל מְבַקֵּשׁ בְּלוּט גָּדוֹל מִשֶּׁל הָעִגּוּל שֶׁלִּפְנָיו'
        : hint === 'clear'
          ? 'סַדְּרוּ אֶת הַבְּלוּטִים מֵהַקָּטָן אֶל הַגָּדוֹל'
          : 'נַסּוּ שׁוּב — אֵיזֶה עִגוּל מַתְאִים?',
    ]);

    /* rejected drop: release + fly home (old snap-back, softened) */
    this.held = null;
    this.dragging = false;
    acorn.picked = false;
    this.settle(acorn, false);
    acorn.tweens.push(
      this.anim.to(acorn.view, { x: acorn.homeX, y: acorn.homeY }, { durationMs: REJECT_HOME_MS, ease: ease.outBack }),
    );
  }

  private completeRound(): void {
    /* a completed round = one DDA round; score reflects its cleanliness */
    this.consecutiveMiss = 0;
    this.dda.outcome(true, Math.max(0.3, 1 - this.rejectsThisRound * 0.2));
    this.signals.attempt('logic.ordering', true);
    if (this.round >= this.totalRounds) {
      this.win();
      return;
    }
    this.round++;
    this.say(['וָאו! עוֹד סִבּוּב!']);
    this.anim.after(ROUND_GAP_MS, () => {
      if (this.isFinished()) return;
      this.spawnRound();
    });
  }

  private win(): void {
    this.say(['וָאו, כָּל הַכָּבוֹד!', 'הַסְּנַאי מְאֻשָּׁר!']);
    /* finish() records the zone finish with the real elapsed seconds */
    this.finish(2600);
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'acorn-sort',
      round: this.round,
      totalRounds: this.totalRounds,
      acorns: this.acorns.map((a) => ({
        id: a.id,
        sizeIndex: a.sizeIndex,
        x: Math.round(a.view.x),
        y: Math.round(a.view.y),
        picked: a.picked,
        placed: a.placed,
      })),
      slots: this.slots.map((s) => ({
        x: Math.round(s.x),
        y: Math.round(s.y),
        sizeIndex: s.sizeIndex,
        filled: s.filled,
      })),
      rejects: this.rejectsThisRound,
      hint: this.lastHint,
      done: this.isFinished(),
    };
  }
}
