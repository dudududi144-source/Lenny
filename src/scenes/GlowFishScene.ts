/* ============================================================
 * GlowFishScene — upgraded to use the reusable fx library.
 * Lives in Attention Stream (zone: attention-stream).
 *
 * v2 changes:
 *   - ProgressRing shows how many glowing fish were found
 *   - DialogueBox gives Lenny a warm voice
 *   - ParticleBurst celebrates each find
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, sparkleBurst, confettiBurst } from '../games/fx/ParticleBurst';

interface Fish {
  x: number;
  y: number;
  baseY: number;
  speed: number;
  phase: number;
  color: number;
  glowing: boolean;
}

export class GlowFishScene extends Phaser.Scene {
  private fishG!: Phaser.GameObjects.Graphics;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  private fishes: Fish[] = [];
  private glowIdx = 0;
  private found = 0;
  private readonly TARGET = 5;
  private done = false;

  constructor() { super('glow-fish'); }

  preload(): void {
    showLoader(this);
    this.load.image('fish', 'art/fish.png');
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const bg = this.add.image(w / 2, h / 2, 'garden-bg');
    bg.setDisplaySize(w, h).setAlpha(0.5);

    /* illustrated fish mascot */
    const fish = this.add.image(w * 0.15, h * 0.12, 'fish');
    fish.setDisplaySize(70, 70);
    this.tweens.add({ targets: fish, y: fish.y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(w / 2, h / 2, w, h, 0x10243e, 0.45);
    this.fishG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* progress ring top-right */
    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });
    this.ring.setCounts(0, this.TARGET);

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.9, width: w * 0.85 });
    this.dialogue.say([
      'הַדָּגִים מְחַפְּשִׂים אֶת הַמַּנְגִּינָה.',
      'מִצְאוּ אֶת הַדָּג הַזּוֹהֵר!',
    ]);

    this.spawnFishes(w, h);
    this.pickGlowing();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private spawnFishes(w: number, h: number): void {
    const colors = [0x4dc9ff, 0x7dffb8, 0xffa552, 0xff8bd4, 0xb39ddb];
    this.fishes = [];
    for (let i = 0; i < 5; i++) {
      const baseY = h * 0.28 + (i / 4) * h * 0.45;
      this.fishes.push({
        x: Math.random() * w,
        y: baseY,
        baseY,
        speed: 30 + Math.random() * 40,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
        glowing: false,
      });
    }
  }

  private pickGlowing(): void {
    for (const f of this.fishes) f.glowing = false;
    this.glowIdx = Math.floor(Math.random() * this.fishes.length);
    this.fishes[this.glowIdx].glowing = true;
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    this.dialogue.skip();
    const idx = this.hitTest(p.x, p.y);
    if (idx === null) return;

    if (this.fishes[idx].glowing) {
      this.found++;
      this.ring.setCounts(this.found, this.TARGET);
      this.burst.emit(sparkleBurst(this.fishes[idx].x, this.fishes[idx].y));
      if (this.found >= this.TARGET) {
        this.win();
      } else {
        this.dialogue.say(['וָאו! מָצָאתָ אוֹתוֹ!']);
        this.pickGlowing();
      }
    } else {
      this.dialogue.say(['כִּמְעַט! נַסּוּ שׁוּב']);
    }
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.fishes.length; i++) {
      const f = this.fishes[i];
      if (Math.hypot(px - f.x, py - f.y) < 40) return i;
    }
    return null;
  }

  update(time: number, delta: number): void {
    const t = time * 0.001;
    const dt = delta / 1000;
    const w = this.scale.width;
    const g = this.fishG;
    g.clear();

    this.burst.update(dt, 0, 0.99);
    this.ring.update(dt);
    this.dialogue.update(dt);

    /* bubbles rising */
    for (let i = 0; i < 10; i++) {
      const bx = ((i * 73 + t * 10) % w);
      const by = this.scale.height - ((i * 97 + t * 30) % this.scale.height);
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(bx, by, 3 + (i % 3));
    }

    /* fishes swimming */
    for (const f of this.fishes) {
      f.x += f.speed * dt;
      if (f.x > w + 50) f.x = -50;
      f.y = f.baseY + Math.sin(t * 1.6 + f.phase) * 14;
      this.drawFish(g, f, t);
    }
  }

  private drawFish(g: Phaser.GameObjects.Graphics, f: Fish, t: number): void {
    const r = 20;
    if (f.glowing) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      g.fillStyle(0xffd76a, 0.18 * pulse);
      g.fillCircle(f.x, f.y, r * 2.4);
      g.fillStyle(0xffd76a, 0.3 * pulse);
      g.fillCircle(f.x, f.y, r * 1.6);
    }
    g.fillStyle(f.glowing ? 0xffd76a : f.color, 0.9);
    g.fillEllipse(f.x, f.y, r * 2, r * 1.3);
    const tail = Math.sin(t * 6 + f.phase) * 4;
    g.fillTriangle(
      f.x - r * 0.9, f.y,
      f.x - r * 1.6, f.y - 8 + tail,
      f.x - r * 1.6, f.y + 8 + tail
    );
    g.fillStyle(0xffffff, 1);
    g.fillCircle(f.x + r * 0.5, f.y - 3, 4);
    g.fillStyle(0x0a0416, 1);
    g.fillCircle(f.x + r * 0.55, f.y - 3, 2);
  }

  private win(): void {
    this.done = true;
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַדָּגִים מָצְאוּ אֶת הַמַּנְגִּינָה!']);
    this.burst.emit(confettiBurst(this.scale.width / 2, this.scale.height * 0.4));

        recordZoneFinish('attention-stream');

    this.time.delayedCall(2800, () => this.scene.start('portal'));
  }
}
