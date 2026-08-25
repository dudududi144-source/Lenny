/* ============================================================
 * DrumBeatScene — the ninth playable game.
 * Lives in Rhythm Square (zone: rhythm-square).
 *
 * The big drum stopped drumming. Notes fall toward the drum;
 * tap when a note reaches the glowing hit-zone. Timing is
 * judged by the reusable RhythmEngine (perfect / good / miss).
 *
 * Built on both exemplar systems:
 *   - RhythmEngine  (timing + judgment)
 *   - ParticleBurst (celebration effects)
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { RhythmEngine } from '../games/fx/RhythmEngine';
import { ParticleBurst, confettiBurst, sparkleBurst } from '../games/fx/ParticleBurst';

export class DrumBeatScene extends Phaser.Scene {
  private drumG!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private gradeText!: Phaser.GameObjects.Text;
  private engine!: RhythmEngine;
  private burst!: ParticleBurst;

  private started = false;
  private done = false;
  private perfects = 0;
  private goods = 0;
  private clock = 0;

  /* layout */
  private hitY = 0;
  private spawnY = 0;
  private readonly FALL_TIME = 2.2; /* seconds a note takes to fall */

  constructor() { super('drum-beat'); }

  preload(): void {
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    const w = this.scale.width, h = this.scale.height;

    /* rhythm square background */
    /* illustrated background */
    const _bg = this.add.image(w / 2, h / 2, 'garden-bg');
    _bg.setDisplaySize(w, h).setAlpha(0.5).setDepth(0);
    this.add.rectangle(w / 2, h / 2, w, h, 0x2a1a30, 0.45);

    this.drumG = this.add.graphics();
    this.burst = new ParticleBurst(this);

    this.hitY = h * 0.68;
    this.spawnY = h * 0.08;

    this.msgText = this.add.text(w / 2, h * 0.06, 'הַתֹּף הַגָּדוֹל הִפְסִיק לְתַפְתֵּף', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5);

    this.gradeText = this.add.text(w / 2, h * 0.5, '', {
      fontFamily: 'Heebo, Arial', fontSize: '22px', color: '#ffd76a',
    }).setOrigin(0.5);

    /* gentle tempo for kids */
    this.engine = new RhythmEngine({ bpm: 78, beats: 8, leadIn: 2.0 });

    this.msgText.setText('בּוֹא נַתְחִיל לְתַפְתֵּף!');
    this.time.delayedCall(1200, () => {
      this.started = true;
      this.engine.start(this.clock);
    });

    this.input.on('pointerdown', () => this.onTap());
  }

  private onTap(): void {
    if (!this.started || this.done) return;
    const j = this.engine.judge(this.clock);

    if (j.grade === 'perfect') {
      this.perfects++;
      this.showGrade('מֻשְׁלָם!', 0xffd76a);
      this.burst.emit(sparkleBurst(this.scale.width / 2, this.hitY));
    } else if (j.grade === 'good') {
      this.goods++;
      this.showGrade('יוֹפִי!', 0x7dffb8);
    } else {
      this.showGrade('נַסֶּה לְהַקְשִׁיב לַקֶּצֶב', 0xfff6ec);
    }

    /* drum pulse feedback */
    this.pulseDrum();

    if (this.engine.isDone(this.clock)) {
      this.finish();
    }
  }

  private showGrade(text: string, color: number): void {
    this.gradeText.setText(text);
    this.gradeText.setColor('#' + color.toString(16).padStart(6, '0'));
    this.tweens.add({
      targets: this.gradeText,
      alpha: { from: 1, to: 0 },
      duration: 600,
      delay: 400,
      onComplete: () => this.gradeText.setAlpha(1),
    });
  }

  private drumScale = 1;
  private pulseDrum(): void {
    this.drumScale = 1.12;
  }

  private finish(): void {
    this.done = true;
    const total = this.engine.total();
    const hits = this.engine.hits();
    this.msgText.setText('וָאו, כָּל הַכָּבוֹד! הַתֹּף חָזַר לְתַפְתֵּף!');
    this.burst.emit(confettiBurst(this.scale.width / 2, this.scale.height * 0.4));

        recordZoneFinish('rhythm-square');

    void total; void hits;
    this.time.delayedCall(2400, () => this.scene.start('portal'));
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    this.clock += dt;
    this.burst.update(dt, 120, 0.99);

    /* relax drum pulse */
    this.drumScale += (1 - this.drumScale) * Math.min(1, dt * 8);

    /* auto-finish when the pattern completes, even if the child stops tapping */
    if (this.started && !this.done && this.engine.isDone(this.clock)) {
      this.finish();
      return;
    }

    this.drawNotes();
    this.drawDrum(time * 0.001);
  }

  private drawNotes(): void {
    const g = this.drumG;
    const w = this.scale.width;
    if (!this.started) return;

    /* draw falling notes that are on screen */
    const t = this.engine.elapsed(this.clock);
    const beatInterval = 60 / 78;
    const leadIn = 2.0;
    for (let i = 0; i < 8; i++) {
      const beatT = leadIn + i * beatInterval;
      /* progress 0..1 of the fall */
      const p = 1 - (beatT - t) / this.FALL_TIME;
      if (p < 0 || p > 1.15) continue;
      const ny = this.spawnY + (this.hitY - this.spawnY) * p;
      const near = Math.abs(p - 1) < 0.08;
      g.fillStyle(near ? 0xffd76a : 0x7c4dff, 0.95);
      g.fillCircle(w / 2, ny, near ? 16 : 13);
      g.lineStyle(2, 0xfff6ec, 0.5);
      g.strokeCircle(w / 2, ny, near ? 16 : 13);
    }
  }

  private drawDrum(t: number): void {
    const g = this.drumG;
    const w = this.scale.width;
    const cx = w / 2;
    const cy = this.hitY + 55;
    const s = this.drumScale;

    /* hit zone ring */
    const glow = 0.5 + 0.5 * Math.sin(t * 3);
    g.lineStyle(3, 0xffd76a, 0.3 + glow * 0.3);
    g.strokeCircle(cx, this.hitY, 26);

    /* drum body */
    g.fillStyle(0xc2405e, 1);
    g.fillEllipse(cx, cy, 110 * s, 46 * s);
    g.fillStyle(0xf2549a, 1);
    g.fillEllipse(cx, cy - 18 * s, 110 * s, 46 * s);
    /* drum rim */
    g.lineStyle(3, 0xffd76a, 0.8);
    g.strokeEllipse(cx, cy - 18 * s, 110 * s, 46 * s);
    /* laces */
    g.lineStyle(2, 0xffd76a, 0.5);
    for (let i = -2; i <= 2; i++) {
      g.lineBetween(cx + i * 22, cy - 30 * s, cx + i * 22, cy + 10 * s);
    }
  }
}
