import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';

interface Platform { x: number; y: number; w: number; hue: number; }
interface Star { x: number; y: number; taken: boolean; rot: number; }
interface BgStar { x: number; y: number; r: number; phase: number; }

export class PlayScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private gameG!: Phaser.GameObjects.Graphics;

  private px = 0; private py = 0;
  private vx = 0; private vy = 0;

  private platforms: Platform[] = [];
  private stars: Star[] = [];
  private bgStars: BgStar[] = [];

  private cameraY = 0;
  private score = 0;
  private best = 0;
  private starCount = 0;
  private state: 'menu' | 'play' | 'over' = 'menu';
  private inputDir = 0;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;

  private titleText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private hintL!: Phaser.GameObjects.Text;
  private hintR!: Phaser.GameObjects.Text;

  private readonly GRAV = 1500;
  private readonly JUMP = -680;
  private readonly SPEED = 400;
  private readonly PLAT_W = 84;
  private readonly PLAT_H = 14;
  private readonly PLAYER_R = 18;

  constructor() { super('play'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    this.bg = this.add.graphics();
    this.gameG = this.add.graphics();

    this.best = parseInt(localStorage.getItem('lenny_best') || '0', 10);

    this.bgStars = [];
    for (let i = 0; i < 40; i++) {
      this.bgStars.push({
        x: Math.random() * w,
        y: Math.random() * h * 2,
        r: 0.5 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2
      });
    }

    if (this.input.keyboard) {
      this.keyLeft = this.input.keyboard.addKey('LEFT');
      this.keyRight = this.input.keyboard.addKey('RIGHT');
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.state === 'menu') { this.startGame(); return; }
      if (this.state === 'over') { this.showMenu(); return; }
      this.inputDir = p.x < this.scale.width / 2 ? -1 : 1;
    });
    this.input.on('pointerup', () => { this.inputDir = 0; });

    // UI Texts
    this.titleText = this.add.text(w / 2, h * 0.22, 'לֶנִי', {
      fontFamily: 'Heebo, Arial', fontSize: '52px', color: '#FFD76A',
      stroke: '#7c4dff', strokeThickness: 6
    }).setOrigin(0.5);

    this.subText = this.add.text(w / 2, h * 0.32, 'קְפִיצַת הַכּוֹכָבִים', {
      fontFamily: 'Heebo, Arial', fontSize: '22px', color: '#FFF6EC'
    }).setOrigin(0.5);

    this.scoreText = this.add.text(w / 2, 30, '', {
      fontFamily: 'Heebo, Arial', fontSize: '28px', color: '#FFD76A',
      stroke: '#1a1040', strokeThickness: 4
    }).setOrigin(0.5, 0);

    this.hintL = this.add.text(30, h / 2, '◄', {
      fontFamily: 'Arial', fontSize: '40px', color: '#FFD76A'
    }).setOrigin(0.5).setAlpha(0.3);

    this.hintR = this.add.text(w - 30, h / 2, '►', {
      fontFamily: 'Arial', fontSize: '40px', color: '#FFD76A'
    }).setOrigin(0.5).setAlpha(0.3);

    this.showMenu();
  }

  private showMenu(): void {
    this.state = 'menu';
    this.resetWorld();
    this.titleText.setVisible(true);
    this.subText.setText('קְפִיצַת הַכּוֹכָבִים\n\nהִלְחֲצִי כְּדֵי לְהַתְחִיל').setVisible(true);
    this.scoreText.setText('');
    this.hintL.setVisible(false);
    this.hintR.setVisible(false);
  }

  private startGame(): void {
    this.state = 'play';
    this.score = 0;
    this.starCount = 0;
    this.resetWorld();
    this.titleText.setVisible(false);
    this.subText.setVisible(false);
    this.hintL.setVisible(true);
    this.hintR.setVisible(true);
  }

  private resetWorld(): void {
    const w = this.scale.width, h = this.scale.height;
    this.px = w / 2;
    this.py = h - 100;
    this.vx = 0;
    this.vy = this.JUMP;
    this.cameraY = 0;
    this.platforms = [];
    this.stars = [];
    this.inputDir = 0;

    this.platforms.push({ x: w / 2 - this.PLAT_W / 2, y: h - 60, w: this.PLAT_W, hue: 200 });

    let y = h - 60;
    for (let i = 0; i < 25; i++) {
      y -= 55 + Math.random() * 35;
      this.spawnPlatform(y);
    }
  }

  private spawnPlatform(y: number): void {
    const w = this.scale.width;
    const x = 15 + Math.random() * (w - this.PLAT_W - 30);
    const hue = [200, 280, 330, 45][Math.floor(Math.random() * 4)];
    this.platforms.push({ x, y, w: this.PLAT_W, hue });

    if (Math.random() < 0.42) {
      this.stars.push({ x: x + this.PLAT_W / 2, y: y - 38, taken: false, rot: Math.random() * Math.PI });
    }
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.033);
    const w = this.scale.width, h = this.scale.height;

    if (this.state === 'play') this.updatePlay(dt, w, h);

    this.render(time, w, h);
  }

  private updatePlay(dt: number, w: number, h: number): void {
    let dir = this.inputDir;
    if (this.keyLeft && this.keyLeft.isDown) dir = -1;
    if (this.keyRight && this.keyRight.isDown) dir = 1;

    this.vx = dir * this.SPEED;
    this.vy += this.GRAV * dt;
    this.px += this.vx * dt;
    this.py += this.vy * dt;

    if (this.px < -this.PLAYER_R) this.px = w + this.PLAYER_R;
    if (this.px > w + this.PLAYER_R) this.px = -this.PLAYER_R;

    if (this.vy > 0) {
      for (const p of this.platforms) {
        if (
          this.px + this.PLAYER_R > p.x &&
          this.px - this.PLAYER_R < p.x + p.w &&
          this.py + this.PLAYER_R >= p.y &&
          this.py + this.PLAYER_R <= p.y + this.PLAT_H + this.vy * dt
        ) {
          this.py = p.y - this.PLAYER_R;
          this.vy = this.JUMP;
          break;
        }
      }
    }

    for (const s of this.stars) {
      if (!s.taken) {
        const dx = this.px - s.x, dy = this.py - s.y;
        if (dx * dx + dy * dy < 44 * 44) {
          s.taken = true;
          this.starCount++;
          this.score += 50;
        }
      }
    }

    const targetCam = this.py - h * 0.4;
    if (targetCam < this.cameraY) this.cameraY = targetCam;

    const heightScore = Math.max(0, Math.floor(-(this.py - (h - 100)) / 10));
    this.score = Math.max(this.score, heightScore);

    let minY = Math.min(...this.platforms.map(p => p.y));
    while (minY > this.cameraY - 300) {
      minY -= 55 + Math.random() * 35;
      this.spawnPlatform(minY);
    }

    this.platforms = this.platforms.filter(p => p.y < this.cameraY + h + 100);
    this.stars = this.stars.filter(s => s.y < this.cameraY + h + 100);

    this.scoreText.setText(this.score + '  ⭐ ' + this.starCount);

    if (this.py > this.cameraY + h + 60) {
      this.state = 'over';
      this.recordGardenProgress();
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem('lenny_best', String(this.best));
      }
      this.titleText.setVisible(true);
      this.subText.setText('נִקּוּד: ' + this.score + '\nשִׂיא: ' + this.best + '\n\nהִלְחֲצִי לְשִׂחוּק חָדָשׁ').setVisible(true);
      this.hintL.setVisible(false);
      this.hintR.setVisible(false);
      this.scoreText.setText('');
    }
  }

  private render(time: number, w: number, h: number): void {
    const t = time * 0.001;
    this.drawBackground(t, w, h);
    this.drawGame(t, w, h);
  }

  private drawBackground(t: number, w: number, h: number): void {
    const g = this.bg;
    g.clear();

    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const r = Math.round(26 + f * 15);
      const gr = Math.round(16 + f * 8);
      const b = Math.round(64 + f * 30);
      g.fillStyle((r << 16) | (gr << 8) | b, 1);
      g.fillRect(0, (h / bands) * i, w, h / bands + 1);
    }

    for (const s of this.bgStars) {
      const sy = ((s.y - this.cameraY * 0.3) % (h * 1.5) + h * 1.5) % (h * 1.5) - h * 0.25;
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 2 + s.phase));
      g.fillStyle(0xFFFFFF, alpha);
      g.fillCircle(s.x, sy, s.r);
    }
  }

  private drawGame(t: number, w: number, h: number): void {
    const g = this.gameG;
    g.clear();
    const camOff = -this.cameraY;

    if (this.state === 'menu') {
      this.drawPlayer(g, w / 2, h * 0.5 + Math.sin(t * 2) * 12, t, 0);
      return;
    }

    for (const p of this.platforms) {
      const py = p.y + camOff;
      if (py < -50 || py > h + 50) continue;

      g.fillStyle(0x000000, 0.2);
      g.fillRoundedRect(p.x + 3, py + 3, p.w, this.PLAT_H, 7);

      const col = Phaser.Display.Color.HSLToColor(p.hue / 360, 0.65, 0.55).color;
      g.fillStyle(col, 1);
      g.fillRoundedRect(p.x, py, p.w, this.PLAT_H, 7);

      g.fillStyle(0xFFFFFF, 0.3);
      g.fillRoundedRect(p.x + 4, py + 2, p.w - 8, 4, 2);
    }

    for (const s of this.stars) {
      if (s.taken) continue;
      const sy = s.y + camOff;
      if (sy < -50 || sy > h + 50) continue;
      this.drawStar(g, s.x, sy, 10, 5, t + s.rot);
    }

    this.drawPlayer(g, this.px, this.py + camOff, t, this.vx);
  }

  private drawPlayer(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, vx: number): void {
    const r = this.PLAYER_R;

    g.fillStyle(0xFFD76A, 0.12);
    g.fillCircle(x, y, r * 2.2);

    g.fillStyle(0xFFD76A, 1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.5;
      const ang = (i * Math.PI) / 5 - Math.PI / 2;
      const sx = x + Math.cos(ang) * rad;
      const sy = y + Math.sin(ang) * rad;
      if (i === 0) g.moveTo(sx, sy);
      else g.lineTo(sx, sy);
    }
    g.closePath();
    g.fillPath();

    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(x - 5, y - 3, 4);
    g.fillCircle(x + 5, y - 3, 4);
    g.fillStyle(0x1a1040, 1);
    const look = Math.max(-2, Math.min(2, vx * 0.005));
    g.fillCircle(x - 5 + look, y - 3, 2);
    g.fillCircle(x + 5 + look, y - 3, 2);

    g.lineStyle(2, 0x1a1040, 1);
    g.beginPath();
    g.arc(x, y + 3, 5, 0.2, Math.PI - 0.2, false);
    g.strokePath();

    g.fillStyle(0xF2549A, 0.5);
    g.fillCircle(x - 9, y + 2, 3);
    g.fillCircle(x + 9, y + 2, 3);
  }

  private drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, outer: number, inner: number, rot: number): void {
    g.fillStyle(0xFFD76A, 0.2);
    g.fillCircle(x, y, outer + 4);

    g.fillStyle(0xFFD76A, 1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const ang = (i * Math.PI) / 5 + rot;
      const sx = x + Math.cos(ang) * rad;
      const sy = y + Math.sin(ang) * rad;
      if (i === 0) g.moveTo(sx, sy);
      else g.lineTo(sx, sy);
    }
    g.closePath();
    g.fillPath();
  }

  /* count this run toward the Light Path zone in the garden */
  private recordGardenProgress(): void {
    /* count any run with at least one star so the journey never stalls
       for young players (3-star gate previously blocked the whole chain) */
    if (this.starCount < 1) return;
    recordZoneFinish('light-path');
  }
}
