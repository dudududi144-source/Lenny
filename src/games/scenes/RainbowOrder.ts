import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { bursts } from '../engine/ParticleSystem';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { stonesFor, type RainbowColor } from '../logic/rainbowOrder';
import { speak } from './speak';


interface Stone {
  slot: number; /* the rainbow position it must reach */
  color: RainbowColor;
  root: Container;
  glow: Sprite;
  baseX: number;
  baseY: number;
  placed: boolean;
  wobble: number;
}

/**
 * RainbowOrder — "גֶּשֶׁר הַקֶּשֶׁת".
 *
 * The arch waits with faint empty slots; stones rest in a mixed row
 * below. Tap the stone that comes NEXT in rainbow order and it flies
 * to its slot; each hit speaks its color name. The arch itself is the
 * teaching legend — the faded arc shows the order without one word.
 *
 * DDA: tier → stone count (4..6). Misses never punish — after the
 * hint ladder runs, the correct stone glows ('clear') or the slot
 * badges it ('show').
 */
export class RainbowOrderScene extends GameScene {
  private board = new Container();
  private stones: Stone[] = [];
  private arcY = 0;
  private nextSlot = 0;
  private round = 1;
  private totalRounds = 3;
  private consecutiveMiss = 0;
  private hint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private done = false;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.particleTheme = 'garden';
    this.root.addChild(this.board);
    this.build();
  }

  private get stonesToday(): RainbowColor[] {
    return stonesFor(this.dda.tier());
  }

  private build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 3;
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.ctx.hud.mission?.('סַדְרוּ אֶת הַקֶּשֶׁת');
    this.say(
      this.ctx.spec?.narrative.intro.length
        ? this.ctx.spec.narrative.intro
        : ['אַבְנֵי הַקֶּשֶׁת הִתְעָרְבוּ.', 'גַּעוּ בָּהֶן לְפִי סֵדֶר הַקֶּשֶׁת!'],
    );
    this.layout();
    this.anim.after(900, () => this.dealRound());
  }

  /* ---------- round ---------- */

  private dealRound(): void {
    if (this.done) return;
    this.nextSlot = 0;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.clearStones();
    const colors = this.stonesToday;
    const n = colors.length;
    const order: number[] = [];
    /* a deterministic-looking mixed row: slots in a rotated order */
    const shift = 1 + (this.round % Math.max(1, n - 1));
    for (let i = 0; i < n; i++) order.push((i + shift) % n);
    this.arcY = this.h * 0.34;
    const rowY = this.h * 0.76;
    const spanX = Math.min(this.w * 0.82, n * 92);
    for (let i = 0; i < n; i++) {
      const slot = order[i];
      this.buildStone(colors[slot], slot, n, this.w / 2 - spanX / 2 + (spanX / Math.max(1, n - 1)) * i, rowY);
    }
  }

  private buildStone(color: RainbowColor, slot: number, n: number, x: number, y: number): void {
    const root = new Container();
    const r = 34;
    const g = new Graphics();
    g.circle(0, 0, r).fill({ color: color.hex });
    g.circle(0, 0, r).stroke({ color: 0xffffff, width: 2.5, alpha: 0.55 });
    g.circle(-r * 0.3, -r * 0.34, r * 0.28).fill({ color: 0xffffff, alpha: 0.35 });
    root.addChild(g);
    this.glowOn(g, color.hex, 1.0, false);

    const name = this.label(color.name, 17, 0x101830, '700');
    root.addChild(name);

    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = color.hex;
    glow.blendMode = 'add';
    glow.width = 150;
    glow.height = 150;
    glow.visible = false;
    root.addChildAt(glow, 0);

    root.x = x;
    root.y = y + 30;
    root.scale.set(0);
    this.board.addChild(root);
    this.anim.to(root, { scale: 1, y }, { durationMs: 430, delayMs: slot * 70, ease: ease.outBack });

    this.stones.push({ slot, color, root, glow, baseX: x, baseY: y, placed: false, wobble: slot * 1.3 });
  }

  private clearStones(): void {
    for (const s of this.stones) if (!s.root.destroyed) s.root.destroy({ children: true });
    this.stones = [];
  }

  /** The faded arch: the legend of the order (rebuilt with the board). */
  private drawArc(): void {
    const arc = this.board.children[0] as Graphics | undefined;
    if (arc instanceof Graphics) arc.destroy();
    const g = new Graphics();
    const colors = this.stonesToday;
    const n = colors.length;
    const radius = this.w * 0.32;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const rr = radius - i * 7;
      g.arc(this.w / 2, this.arcY + 60, Math.max(40, rr), a + 0.02, a + (Math.PI / (n - 1)) - 0.04).stroke({
        color: colors[i].hex,
        width: 14,
        alpha: this.nextSlot > i ? 0.95 : 0.18,
      });
    }
    this.board.addChildAt(g, 0);
  }

  /* ---------- input ---------- */

  override onTap(x: number, y: number): boolean {
    if (this.done) return false;
    for (const s of this.stones) {
      if (s.placed) continue;
      if (Math.hypot(x - s.root.x, y - s.root.y) > 52) continue;
      if (s.slot === this.nextSlot) {
        this.hitStone(s);
      } else {
        this.missStone(s);
      }
      return true;
    }
    return false;
  }

  private hitStone(s: Stone): void {
    s.placed = true;
    this.nextSlot++;
    this.consecutiveMiss = 0;
    this.hint = 'none';
    this.score.hit(12, { x: s.root.x, y: s.root.y });
    this.sparkle(s.root.x, s.root.y, [s.color.hex, COLORS.glowSoft]);
    audio.play('chime', s.slot);
    speak(s.color.name);
    /* fly to its arc slot */
    const colors = this.stonesToday;
    const a = Math.PI + (s.slot / Math.max(1, colors.length - 1)) * Math.PI;
    const rr = Math.max(40, this.w * 0.32 - s.slot * 7);
    this.anim.to(
      s.root,
      {
        x: this.w / 2 + Math.cos(a) * rr,
        y: this.arcY + 60 + Math.sin(a) * rr,
        scale: 0.72,
      },
      {
        durationMs: 560,
        ease: ease.outBack,
        onDone: () => {
          if (this.tornDown) return;
          this.drawArc();
        },
      },
    );
    this.lennyCelebrate();
    if (this.nextSlot >= this.stones.length) {
      this.signals.attempt('logic.ordering', true);
      this.roundComplete();
    }
  }

  private missStone(s: Stone): void {
    this.dda.outcome(false);
    this.signals.attempt('logic.ordering', false);
    this.score.miss({ x: s.root.x, y: s.root.y });
    audio.play('softError');
    this.consecutiveMiss++;
    this.hint = this.suggestHint(this.consecutiveMiss);
    if (this.hint !== 'none') this.signals.hintUsed('logic.ordering');
    /* a gentle wobble — never a scold */
    this.anim.to(s.root, { x: s.baseX + 8 }, {
      durationMs: 70,
      ease: ease.outCubic,
      onDone: () => {
        this.anim.to(s.root, { x: s.baseX }, { durationMs: 160, ease: ease.outCubic });
      },
    });
    const next = this.stones.find((c) => c.slot === this.nextSlot);
    this.say([next ? `${s.color.name}... מִי בָּא אַחֲרֵי כָּךְ?` : this.ctx.spec?.narrative.encourage ?? 'בּוֹא נַמְשִׁיךְ.']);
  }

  private roundComplete(): void {
    this.ctx.hud.ringCounts(this.round, this.totalRounds);
    bursts.confetti(this.particles, this.w / 2, this.h * 0.4);
    this.dda.outcome(true, 1);
    audio.play('combo', Math.min(4, this.round));
    this.fx.announce('הַקֶּשֶׁת!', { y: this.h * 0.24, w: this.w, durMs: 1400 });
    if (this.round >= this.totalRounds) {
      this.done = true;
      this.anim.after(900, () => {
        if (!this.tornDown) this.finishWithCeremony({ title: 'הַקֶּשֶׁת שֶׁלְּךָ!' });
      });
    } else {
      this.round++;
      this.anim.after(1500, () => this.dealRound());
    }
  }

  /* ---------- frame ---------- */

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    for (const s of this.stones) {
      if (s.placed || s.root.destroyed) continue;
      s.root.y = s.baseY + Math.sin((this.t / 1500) * Math.PI * 2 + s.wobble) * 4;
      /* the hint ladder: 'clear' pulses the next stone, 'show' locks its glow on */
      const wantGlow = this.hint === 'clear' || this.hint === 'show';
      s.glow.visible = wantGlow && s.slot === this.nextSlot;
      s.glow.alpha = 0.4 + 0.3 * Math.sin(this.t / 160);
    }
  }

  protected override layout(): void {
    /* the arc + rows rebuild with the world size on resize.
       Guard (the MemoryPairs constellation pattern): the BASE
       constructor's first sizing pass runs before the subclass
       fields exist — build() draws the first arc itself. */
    const board = this.board as Container | undefined;
    if (!board) return;
    this.drawArc();
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'rainbow-order',
      round: this.round,
      totalRounds: this.totalRounds,
      nextSlot: this.nextSlot,
      hint: this.hint,
      done: this.done || this.isFinished(),
      stones: this.stones.map((s) => ({ slot: s.slot, name: s.color.name, placed: s.placed, x: Math.round(s.root.x), y: Math.round(s.root.y) })),
    };
  }

  override destroy(): void {
    this.clearStones();
    super.destroy();
  }
}
