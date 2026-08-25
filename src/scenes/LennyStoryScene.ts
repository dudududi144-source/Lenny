/* ============================================================
 * LennyStoryScene — the tenth playable experience.
 * Lives in Breath Pool (zone: breath-pool).
 *
 * This is the FIRST scene that demonstrates the full reusable
 * library working together:
 *   - DialogueBox  (Lenny tells the story)
 *   - ProgressRing (shows how many lights were lit)
 *   - ParticleBurst (celebration on each light + finale)
 *
 * The child helps Lenny light three lanterns by breathing
 * calmly (tapping slowly). A gentle, regulating experience.
 * ============================================================ */

import Phaser from 'phaser';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ProgressRing } from '../games/fx/ProgressRing';
import { ParticleBurst, sparkleBurst, confettiBurst } from '../games/fx/ParticleBurst';

interface Lantern {
  x: number;
  y: number;
  lit: boolean;
  glow: number;
}

export class LennyStoryScene extends Phaser.Scene {
  private storyG!: Phaser.GameObjects.Graphics;
  private dialogue!: DialogueBox;
  private ring!: ProgressRing;
  private burst!: ParticleBurst;
  private lanterns: Lantern[] = [];
  private litCount = 0;
  private readonly TOTAL = 3;
  private done = false;
  private lastTap = 0;

  constructor() { super('lenny-story'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* calm night pool background */
    this.add.rectangle(w / 2, h / 2, w, h, 0x0e1030);

    this.storyG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    /* three lanterns floating over the pool */
    for (let i = 0; i < this.TOTAL; i++) {
      this.lanterns.push({
        x: w * (0.25 + i * 0.25),
        y: h * 0.45,
        lit: false,
        glow: 0,
      });
    }

    /* progress ring top-right */
    this.ring = new ProgressRing(this, { x: w - 40, y: 60, radius: 20 });
    this.ring.setCounts(0, this.TOTAL);

    /* Lenny introduces the scene */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.82, width: w * 0.82 });
    this.dialogue.say([
      'בְּרֵכַת הַנְּשִׁימָה שְׁקֵטָה הַלַּיְלָה...',
      'בּוֹא נַדְלִיק אֶת הַפָּנָסִים בִּנְשִׁימוֹת רַכּוֹת.',
      'נִגְעוּ לְאַט בְּכָל פָּנָס.',
    ]);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.done) return;
    const now = this.time.now;
    /* encourage slow, calm taps: ignore taps faster than 700ms apart */
    if (now - this.lastTap < 700) return;
    this.lastTap = now;

    this.dialogue.skip();

    for (const l of this.lanterns) {
      if (!l.lit && Math.hypot(p.x - l.x, p.y - l.y) < 44) {
        l.lit = true;
        this.litCount++;
        this.ring.setCounts(this.litCount, this.TOTAL);
        this.burst.emit(sparkleBurst(l.x, l.y));
        if (this.litCount >= this.TOTAL) this.finale();
        return;
      }
    }
  }

  private finale(): void {
    this.done = true;
    const w = this.scale.width, h = this.scale.height;
    this.burst.emit(confettiBurst(w / 2, h * 0.4));
    this.dialogue.say([
      'וָאו, כָּל הַכָּבוֹד!',
      'הַפָּנָסִים מְאִירִים אֶת הַבְּרֵכָה.',
    ]);

    /* record progress for the garden */
    try {
      const raw = localStorage.getItem('lenny-garden');
      if (raw) {
        const prog = JSON.parse(raw);
        prog.finished = prog.finished || {};
        prog.finished['breath-pool'] = (prog.finished['breath-pool'] || 0) + 1;
        localStorage.setItem('lenny-garden', JSON.stringify(prog));
      }
    } catch { /* noop */ }

    this.time.delayedCall(3200, () => this.scene.start('portal'));
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    const t = time * 0.001;
    this.burst.update(dt, 0, 0.99);
    this.ring.update(dt);
    this.dialogue.update(dt);
    this.drawScene(t);
  }

  private drawScene(t: number): void {
    const g = this.storyG;
    g.clear();
    const w = this.scale.width, h = this.scale.height;

    /* pool water shimmer */
    g.fillStyle(0x1a2a5a, 0.7);
    g.fillEllipse(w / 2, h * 0.62, w * 0.8, h * 0.16);
    for (let i = 0; i < 5; i++) {
      const sx = w * (0.2 + i * 0.15) + Math.sin(t + i) * 6;
      g.lineStyle(1.5, 0x4dc9ff, 0.25);
      g.lineBetween(sx, h * 0.6, sx + 20, h * 0.6);
    }

    /* lanterns */
    for (const l of this.lanterns) {
      const bob = Math.sin(t * 1.4 + l.x) * 5;
      const ly = l.y + bob;
      if (l.lit) {
        l.glow = Math.min(1, l.glow + 0.02);
        g.fillStyle(0xffd76a, 0.15 * l.glow);
        g.fillCircle(l.x, ly, 36);
        g.fillStyle(0xffd76a, 0.9);
        g.fillRoundedRect(l.x - 12, ly - 16, 24, 30, 6);
        g.fillStyle(0xfff6ec, 0.95);
        g.fillCircle(l.x, ly, 6);
      } else {
        g.fillStyle(0x3a3350, 0.8);
        g.fillRoundedRect(l.x - 12, ly - 16, 24, 30, 6);
        g.lineStyle(1.5, 0xfff6ec, 0.3);
        g.strokeRoundedRect(l.x - 12, ly - 16, 24, 30, 6);
      }
      /* string */
      g.lineStyle(1, 0xfff6ec, 0.3);
      g.lineBetween(l.x, ly - 16, l.x, ly - 34);
    }
  }
}
