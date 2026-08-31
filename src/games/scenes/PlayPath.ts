import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { softGlowTexture, sparkTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';

const GRAV = 1500;
const JUMP = -680;
const SPEED = 400;
const PLAT_W = 86;
const PLAT_H = 14;
const PLAYER_R = 16;
const STAR_CHANCE = 0.42;
const STAR_PICKUP = 44;
const HUES = [0x4dc9ff, 0xb18cff, 0xf2549a, 0xffd76a];

interface Platform {
  x: number;
  y: number;
  w: number;
  hue: number;
  view: Graphics;
}

interface Star {
  x: number;
  y: number;
  taken: boolean;
  view: Sprite;
}

/**
 * PlayPath — star-jump climber (light-path).
 * Ported from PlayScene: doodle-jump physics (GRAV 1500 / JUMP -680),
 * wrap-around horizontal, procedural platforms every 55-90px, stars
 * worth +50, score = max(starScore, heightScore), best in
 * localStorage 'lenny_best', garden progress only when starCount >= 1.
 * Steering: hold and drag anywhere (pointer eases the player toward
 * the finger), or arrow keys.
 */
export class PlayPathScene extends GameScene {
  private platforms: Platform[] = [];
  private stars: Star[] = [];
  private px = this.w / 2;
  private py = this.h - 100;
  private vy = JUMP;
  private cameraY = 0;
  private score = 0;
  private starCount = 0;
  private best = 0;
  private running = true;
  private pointerX: number | null = null;
  private keyLeft = false;
  private keyRight = false;
  private keyHandlers: Array<[string, (e: KeyboardEvent) => void]> = [];
  private player = new Container();
  private scoreLabel: Container;
  private platformLayer = new Container();
  private starLayer = new Container();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.best = parseInt(localStorage.getItem('lenny_best') ?? '0', 10) || 0;
    this.root.addChild(this.platformLayer);
    this.root.addChild(this.starLayer);
    this.build();
    this.scoreLabel = this.buildScoreHud();
  }

  private buildScoreHud(): Container {
    const hud = new Container();
    const star = new Sprite(sparkTexture());
    star.anchor.set(0.5);
    star.tint = COLORS.glow;
    star.blendMode = 'add';
    star.width = 30;
    star.height = 30;
    star.x = this.w / 2 - 56;
    star.y = 30;
    const label = this.label('0', 22, COLORS.cream, '700');
    label.x = this.w / 2 - 30;
    label.y = 30;
    hud.addChild(star, label);
    this.root.addChild(hud);
    return hud;
  }

  protected build(): void {
    /* player: a little glowing star-friend */
    const halo = new Sprite(softGlowTexture());
    halo.anchor.set(0.5);
    halo.tint = COLORS.glow;
    halo.blendMode = 'add';
    halo.width = 64;
    halo.height = 64;
    const body = new Sprite(sparkTexture());
    body.anchor.set(0.5);
    body.tint = COLORS.glow;
    body.width = 40;
    body.height = 40;
    this.player.addChild(halo, body);
    this.player.x = this.px;
    this.player.y = this.py;
    this.root.addChild(this.player);

    /* starting platforms + procedural climb */
    this.platforms = [];
    this.stars = [];
    for (let i = 0; i < 25; i++) {
      const y = this.h - 60 - i * 70;
      this.spawnPlatform(y);
    }

    /* keyboard steering (removed on destroy) */
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') this.keyLeft = true;
      if (e.key === 'ArrowRight') this.keyRight = true;
    };
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') this.keyLeft = false;
      if (e.key === 'ArrowRight') this.keyRight = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.keyHandlers = [['keydown', down], ['keyup', up]];

    this.say(['קְפִיצַת הַכּוֹכָבִים!', 'הַחֲזִיקִי וּגְרְרִי כְּדֵי לְהַגִּישׁ. אַסְפִּי כּוֹכָבִים!']);
  }

  private spawnPlatform(y: number): void {
    const x = 15 + Math.random() * (this.w - PLAT_W - 30);
    const hue = HUES[Math.floor(Math.random() * HUES.length)];
    const view = new Graphics();
    view.roundRect(0, 0, PLAT_W, PLAT_H, 7);
    view.fill({ color: hue, alpha: 0.9 });
    view.roundRect(0, 0, PLAT_W, PLAT_H / 2, 7);
    view.fill({ color: 0xffffff, alpha: 0.18 });
    view.y = y;
    view.x = x;
    this.platformLayer.addChild(view);
    this.platforms.push({ x, y, w: PLAT_W, hue, view });

    if (Math.random() < STAR_CHANCE) {
      const star = new Sprite(sparkTexture());
      star.anchor.set(0.5);
      star.tint = COLORS.glow;
      star.blendMode = 'add';
      star.width = 30;
      star.height = 30;
      star.x = x + PLAT_W / 2;
      star.y = y - 38;
      this.starLayer.addChild(star);
      this.stars.push({ x: star.x, y: star.y, taken: false, view: star });
    }
  }

  onDragStart(x: number, _y: number): void {
    this.pointerX = x;
  }

  onDragMove(x: number, _y: number): void {
    this.pointerX = x;
  }

  onDragEnd(): void {
    this.pointerX = null;
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    if (!this.running || this.isFinished()) return;
    const dt = Math.min(dtMs, 33) / 1000;

    /* steering: pointer target wins, then keyboard */
    let dir = 0;
    if (this.pointerX !== null) {
      dir = this.pointerX > this.px ? 1 : this.pointerX < this.px ? -1 : 0;
    } else if (this.keyLeft && !this.keyRight) dir = -1;
    else if (this.keyRight && !this.keyLeft) dir = 1;

    this.px += dir * SPEED * dt;
    this.vy += GRAV * dt;
    this.py += this.vy * dt;

    /* wrap-around like the original */
    if (this.px < -PLAYER_R) this.px = this.w + PLAYER_R;
    if (this.px > this.w + PLAYER_R) this.px = -PLAYER_R;

    /* bounce on platforms while falling */
    if (this.vy > 0) {
      for (const p of this.platforms) {
        if (
          this.px + PLAYER_R > p.x &&
          this.px - PLAYER_R < p.x + p.w &&
          this.py + PLAYER_R >= p.y &&
          this.py + PLAYER_R <= p.y + PLAT_H + this.vy * dt
        ) {
          this.py = p.y - PLAYER_R;
          this.vy = JUMP;
          this.sparkle(this.px, p.y, [p.hue, 0xffffff]);
          break;
        }
      }
    }

    /* star pickup */
    for (const s of this.stars) {
      if (!s.taken) {
        if (Math.hypot(this.px - s.x, this.py - s.y) < STAR_PICKUP) {
          s.taken = true;
          s.view.destroy();
          this.starCount++;
          this.score += 50;
          this.sparkle(s.x, s.y, [COLORS.glow, COLORS.glowSoft, 0xffffff]);
        }
      }
    }

    /* camera follows upward only */
    const targetCam = this.py - this.h * 0.4;
    if (targetCam < this.cameraY) this.cameraY = targetCam;

    const heightScore = Math.max(0, Math.floor(-(this.py - (this.h - 100)) / 10));
    this.score = Math.max(this.score, heightScore);

    /* keep the climb going */
    let minY = Math.min(...this.platforms.map((p) => p.y));
    while (minY > this.cameraY - 300) {
      minY -= 55 + Math.random() * 35;
      this.spawnPlatform(minY);
    }
    for (const p of [...this.platforms]) {
      if (p.y > this.cameraY + this.h + 100) {
        p.view.destroy();
        this.platforms = this.platforms.filter((q) => q !== p);
      }
    }
    for (const s of [...this.stars]) {
      if (s.y > this.cameraY + this.h + 100) {
        s.view.destroy();
        this.stars = this.stars.filter((q) => q !== s);
      }
    }

    /* render positions */
    this.player.x = this.px;
    this.player.y = this.py - this.cameraY;
    for (const p of this.platforms) p.view.y = p.y - this.cameraY;
    for (const s of this.stars) s.view.y = s.y - this.cameraY;

    const starIcon = this.scoreLabel.children[0] as Sprite;
    starIcon.rotation = Math.sin(this.t / 600) * 0.25;
    const count = this.scoreLabel.children[1] as import('pixi.js').Text;
    count.text = `${this.score}`;

    /* fell off the bottom -> run over */
    if (this.py - this.cameraY > this.h + 60) {
      this.endRun();
    }
  }

  private endRun(): void {
    this.running = false;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('lenny_best', String(this.best));
    }
    if (this.starCount >= 1) {
      this.say([`נִקּוּד: ${this.score}`, `שִׂיא: ${this.best}`]);
      this.finish(1800);
    } else {
      /* the original records garden progress only with at least one star */
      this.say([`נִקּוּד: ${this.score}`, 'אַסְפִּי לְפָחוֹת כּוֹכָב אֶחָד כְּדֵי לְהַדְלִיק אֶת הַשְּׁבִיל!']);
      this.exitSoon(1400);
    }
  }

  destroy(): void {
    for (const [name, handler] of this.keyHandlers) window.removeEventListener(name, handler as EventListener);
    this.keyHandlers = [];
    super.destroy();
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'play',
      score: this.score,
      starCount: this.starCount,
      best: this.best,
      player: { x: Math.round(this.px), y: Math.round(this.py - this.cameraY) },
      stars: this.stars.filter((s) => !s.taken).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y - this.cameraY) })),
      done: this.isFinished(),
    };
  }
}
