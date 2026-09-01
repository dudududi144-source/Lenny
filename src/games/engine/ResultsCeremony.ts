import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { ease } from './AnimationSystem';
import { audio } from './AudioEngine';
import type { AnimationSystem } from './AnimationSystem';
import type { SessionStats } from './ScoreDirector';
import { softGlowTexture, sparkTexture } from './textures';
import { COLORS } from './theme';

export interface CeremonyActions {
  onReplay(): void;
  onExit(): void;
}

interface CeremonyState {
  visible: boolean;
  stars: number;
  replayHit: { x: number; y: number; w: number; h: number } | null;
  exitHit: { x: number; y: number; w: number; h: number } | null;
}

function bestKey(zone: string): string {
  return `lenny-best-${zone}`;
}

function loadBest(zone: string): number {
  try {
    return Number(localStorage.getItem(bestKey(zone)) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(zone: string, score: number): void {
  try {
    localStorage.setItem(bestKey(zone), String(score));
  } catch {
    /* ignore */
  }
}

/**
 * ResultsCeremony — the commercial session closer: star reveal,
 * stats panel, personal-record banner and replay/exit actions.
 * Rendered in-canvas; hit areas are exposed for the scene's onTap
 * and mirrored in debugState for e2e.
 */
export class ResultsCeremony {
  readonly root = new Container();
  private anim: AnimationSystem;
  private w: number;
  private h: number;
  private actions: CeremonyActions;
  private state: CeremonyState = { visible: false, stars: 0, replayHit: null, exitHit: null };
  private newRecord = false;

  constructor(anim: AnimationSystem, w: number, h: number, actions: CeremonyActions) {
    this.anim = anim;
    this.w = w;
    this.h = h;
    this.actions = actions;
    this.root.visible = false;
    this.root.eventMode = 'static';
  }

  isOpen(): boolean {
    return this.state.visible;
  }

  /** Silent close (auto-advance path) — no actions invoked. */
  dismiss(): void {
    this.state.visible = false;
    this.root.visible = false;
  }

  /** Show the ceremony. Returns the (possibly new) record flag. */
  show(zone: string, stats: SessionStats, title = 'כָּל הַכָּבוֹד!'): void {
    if (this.state.visible) return;
    this.state.visible = true;
    this.state.stars = stats.stars;

    const prevBest = loadBest(zone);
    this.newRecord = stats.score > prevBest && stats.score > 0;
    if (this.newRecord) saveBest(zone, stats.score);

    const W = this.w;
    const H = this.h;
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));

    const dim = new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: COLORS.void, alpha: 0.72 });
    this.root.addChild(dim);

    const panelW = Math.min(W * 0.86, 380);
    const panelH = Math.min(H * 0.62, 430);
    const panel = new Container();
    panel.x = W / 2;
    panel.y = H * 0.47;
    panel.alpha = 0;
    panel.scale.set(0.7);

    const bg = new Graphics()
      .roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 30)
      .fill({ color: 0x101632, alpha: 0.96 })
      .stroke({ width: 2, color: COLORS.glow, alpha: 0.65 });
    panel.addChild(bg);

    const titleT = new Text({
      text: this.newRecord ? 'שִׁיא חָדָשׁ!' : title,
      style: {
        fontFamily: 'Heebo, sans-serif',
        fontSize: 38,
        fontWeight: '900',
        fill: this.newRecord ? COLORS.glow : COLORS.cream,
        align: 'center',
      },
    });
    titleT.anchor.set(0.5);
    titleT.y = -panelH / 2 + 48;
    titleT.resolution = 2;
    panel.addChild(titleT);

    /* stars */
    for (let i = 0; i < 3; i++) {
      const earned = i < stats.stars;
      const glow = new Sprite(softGlowTexture());
      glow.anchor.set(0.5);
      glow.tint = COLORS.glow;
      glow.alpha = 0;
      glow.blendMode = 'add';
      const star = new Sprite(sparkTexture());
      star.anchor.set(0.5);
      star.scale.set(earned ? 1.5 : 0.9);
      star.tint = earned ? COLORS.glow : 0x2a3050;
      star.alpha = 0;
      const sx = (i - 1) * 74;
      star.x = sx;
      star.y = -panelH / 2 + 116;
      glow.x = sx;
      glow.y = star.y;
      panel.addChild(glow, star);
      if (earned) {
        this.anim.after(350 + i * 380, () => {
          audio.play('star', i);
          this.anim.to(glow, { alpha: 0.85, width: 130, height: 130 }, { durationMs: 300, ease: ease.outCubic });
          this.anim.to(star, { alpha: 1, scale: 1.35 }, { durationMs: 340, ease: ease.outBack });
        });
      } else {
        this.anim.after(350 + i * 380, () => {
          this.anim.to(star, { alpha: 0.7 }, { durationMs: 200 });
        });
      }
    }

    /* stats */
    const lines: Array<[string, string]> = [
      ['נְקֻדּוֹת', String(stats.score)],
      ['דִּיּוּק', `${Math.round(stats.accuracy * 100)}%`],
      ['קוֹמְבּוֹ שִׁיא', `x${Math.max(1, Math.floor(stats.bestCombo / 3) + 1) || 1} · ${stats.bestCombo}`],
    ];
    lines.forEach(([k, v], i) => {
      const key = new Text({
        text: k,
        style: { fontFamily: 'Heebo, sans-serif', fontSize: 20, fontWeight: '600', fill: 0x9aa3c7, align: 'right' },
      });
      key.x = panelW / 2 - 36;
      key.y = -panelH / 2 + 172 + i * 40;
      key.resolution = 2;
      const val = new Text({
        text: v,
        style: { fontFamily: 'Heebo, sans-serif', fontSize: 22, fontWeight: '800', fill: COLORS.cream, align: 'left' },
      });
      val.x = -panelW / 2 + 36;
      val.y = key.y - 2;
      val.resolution = 2;
      panel.addChild(key, val);
    });

    /* buttons */
    const mkButton = (label: string, cy: number, primary: boolean): { box: Container; hit: CeremonyState['replayHit'] } => {
      const bw = panelW - 90;
      const bh = 56;
      const box = new Container();
      const g = new Graphics()
        .roundRect(-bw / 2, -bh / 2, bw, bh, 18)
        .fill({ color: primary ? COLORS.glow : 0x232a4d })
        .stroke({ width: 1.5, color: primary ? COLORS.glow : 0x3c4577 });
      const t = new Text({
        text: label,
        style: {
          fontFamily: 'Heebo, sans-serif',
          fontSize: 22,
          fontWeight: '800',
          fill: primary ? 0x1a1030 : COLORS.cream,
          align: 'center',
        },
      });
      t.anchor.set(0.5);
      t.resolution = 2;
      box.addChild(g, t);
      box.x = 0;
      box.y = cy;
      panel.addChild(box);
      return { box, hit: { x: W / 2 - bw / 2, y: panel.y + cy - bh / 2, w: bw, h: bh } };
    };

    const exitBtn = mkButton('חֲזָרָה לַגַּן', panelH / 2 - 96, false);
    const replayBtn = mkButton('שִׁחֲקוּ שׁוּב', panelH / 2 - 34, true);
    this.state.exitHit = exitBtn.hit;
    this.state.replayHit = replayBtn.hit;

    for (const b of [exitBtn.box, replayBtn.box]) b.alpha = 0;
    this.anim.after(1400, () => {
      this.anim.to(exitBtn.box, { alpha: 1 }, { durationMs: 240 });
      this.anim.to(replayBtn.box, { alpha: 1 }, { durationMs: 240 });
      audio.play('fanfare');
    });

    this.root.addChild(panel);
    this.root.visible = true;
    audio.play('chime', 2);
    this.anim.to(panel, { alpha: 1, scale: 1 }, { durationMs: 420, ease: ease.outBack });
  }

  /** Scene tap routing while the ceremony is open. Returns true if consumed. */
  onTap(x: number, y: number): boolean {
    if (!this.state.visible) return false;
    const inBox = (b: CeremonyState['replayHit']): boolean =>
      !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (inBox(this.state.replayHit)) {
      audio.play('pop', 2);
      this.state.visible = false;
      this.root.visible = false;
      this.actions.onReplay();
      return true;
    }
    if (inBox(this.state.exitHit)) {
      audio.play('pop', 0);
      this.state.visible = false;
      this.root.visible = false;
      this.actions.onExit();
      return true;
    }
    return true; /* swallow all taps while open */
  }

  debugState(): Record<string, unknown> {
    return {
      ceremony: this.state.visible,
      stars: this.state.stars,
      newRecord: this.newRecord,
      replayHit: this.state.replayHit,
      exitHit: this.state.exitHit,
    };
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

export { loadBest as loadZoneBest };
