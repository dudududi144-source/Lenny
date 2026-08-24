/* ============================================================
 * PortalScene — the cognitive gateway
 * One scene, six states, zero cuts:
 *   VOID -> SPARK -> BREATH -> REVEAL -> MANDALA -> GALAXY
 * Conducts every portal subsystem into a single flow.
 * ============================================================ */

import Phaser from 'phaser';
import { PortalState, THETA, BREATH, TIMING, COLORS, SUBLIMINAL, LENNY } from '../data/portalConfig';
import { ThetaPulse } from '../portal/ThetaPulse';
import { BreathSystem } from '../portal/BreathSystem';
import { FractalBackground } from '../portal/FractalBackground';
import { MandalaSystem } from '../portal/MandalaSystem';
import { GalaxySystem } from '../portal/GalaxySystem';
import { SubliminalSystem } from '../portal/SubliminalSystem';

interface RevealParticle {
  x: number; y: number; vx: number; vy: number; life: number;
}

export class PortalScene extends Phaser.Scene {
  private bgG!: Phaser.GameObjects.Graphics;
  private mainG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;

  private theta!: ThetaPulse;
  private breath!: BreathSystem;
  private backdrop!: FractalBackground;
  private mandala!: MandalaSystem;
  private galaxy!: GalaxySystem;
  private subliminal!: SubliminalSystem;

  private state: PortalState = 'VOID';
  private stateT = 0;
  private globalT = 0;

  private breathText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private subliminalText!: Phaser.GameObjects.Text;

  private particles: RevealParticle[] = [];
  private galaxyReady = false;

  constructor() { super('portal'); }

  create(): void {
    this.bgG = this.add.graphics();
    this.mainG = this.add.graphics();
    this.fxG = this.add.graphics();

    this.theta = new ThetaPulse(THETA.freq);
    this.breath = new BreathSystem(BREATH);
    this.backdrop = new FractalBackground();
    this.mandala = new MandalaSystem();
    this.galaxy = new GalaxySystem();

    const w = this.scale.width, h = this.scale.height;

    this.breathText = this.add.text(w / 2, h * 0.82, '', {
      fontFamily: 'Heebo, Arial', fontSize: '20px', color: '#fff6ec',
    }).setOrigin(0.5).setAlpha(0.85);

    this.promptText = this.add.text(w / 2, h * 0.1, '', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#fff6ec',
    }).setOrigin(0.5).setAlpha(0.5);

    this.subliminalText = this.add.text(0, 0, '', {
      fontFamily: 'Heebo, Arial', fontSize: '14px', color: '#fff6ec',
    }).setOrigin(0.5).setVisible(false);
    this.subliminal = new SubliminalSystem(this.subliminalText, () => this.time.now);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTouch(p));
  }

  private onTouch(p: Phaser.Input.Pointer): void {
    if (this.state === 'GALAXY' && this.galaxyReady) {
      const w = this.scale.width, h = this.scale.height;
      const cx = w / 2, cy = h / 2;
      const minDim = Math.min(w, h);
      const hit = this.galaxy.hitTest(p.x, p.y, cx, cy, minDim);
      if (hit && hit.unlocked && hit.scene) {
        this.scene.start(hit.scene);
      }
    } else if (this.state === 'VOID' || this.state === 'SPARK') {
      /* tap to skip the opening for returning visitors */
      this.toState('BREATH');
    }
  }

  private toState(next: PortalState): void {
    this.state = next;
    this.stateT = 0;
    if (next === 'REVEAL') this.spawnParticles();
    if (next === 'GALAXY') {
      this.galaxyReady = false;
      this.time.delayedCall(800, () => { this.galaxyReady = true; });
    }
  }

  private spawnParticles(): void {
    const w = this.scale.width, h = this.scale.height;
    this.particles = [];
    for (let i = 0; i < 144; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 220;
      this.particles.push({
        x: w / 2, y: h / 2,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 1,
      });
    }
  }

  update(time: number): void {
    const dt = Math.min(this.game.loop.delta / 1000, 0.033);
    this.globalT += dt;
    this.stateT += dt;
    this.theta.update(dt);
    this.breath.update(dt);
    this.subliminal.update();

    const w = this.scale.width, h = this.scale.height;
    this.backdrop.draw(this.bgG, w, h, this.globalT, this.warmth(), this.theta.getEased() * 0.4);

    this.fxG.clear();
    this.mainG.clear();

    switch (this.state) {
      case 'VOID': this.updateVoid(); break;
      case 'SPARK': this.updateSpark(w, h); break;
      case 'BREATH': this.updateBreath(w, h); break;
      case 'REVEAL': this.updateReveal(dt); break;
      case 'MANDALA': this.updateMandala(w, h); break;
      case 'GALAXY': this.updateGalaxy(w, h); break;
    }
  }

  private warmth(): number {
    if (this.state === 'VOID') return 0;
    if (this.state === 'SPARK') return 0.2;
    if (this.state === 'BREATH') return 0.35;
    return 0.5;
  }

  private updateVoid(): void {
    this.breathText.setText('');
    /* pure darkness, handled by backdrop */
    if (this.stateT >= TIMING.void) this.toState('SPARK');
  }

  private updateSpark(w: number, h: number): void {
    const appear = Math.min(1, this.stateT / 0.8);
    const pulse = this.theta.getEased();
    const cx = w / 2, cy = h / 2;
    const r = 3 + appear * 10 + pulse * 6;

    this.mainG.fillStyle(COLORS.spark, 0.10 + pulse * 0.08);
    this.mainG.fillCircle(cx, cy, r * 5);
    this.mainG.fillStyle(COLORS.spark, 0.55 + pulse * 0.3);
    this.mainG.fillCircle(cx, cy, r);
    this.mainG.fillStyle(0xfff6ec, 0.9);
    this.mainG.fillCircle(cx, cy, r * 0.4);

    if (this.stateT >= TIMING.spark) this.toState('BREATH');
  }

  private updateBreath(w: number, h: number): void {
    const cx = w / 2, cy = h / 2;
    const scale = this.breath.getScale();
    const baseR = Math.min(w, h) * 0.16;
    const r = baseR * (0.45 + scale * 0.55);

    /* breathing circle */
    this.mainG.fillStyle(COLORS.violet, 0.10);
    this.mainG.fillCircle(cx, cy, r * 1.5);
    this.mainG.lineStyle(2, COLORS.mint, 0.7);
    this.mainG.strokeCircle(cx, cy, r);
    this.mainG.fillStyle(COLORS.spark, 0.14);
    this.mainG.fillCircle(cx, cy, r);

    this.breathText.setText(this.breath.getLabel());

    if (this.stateT >= TIMING.breath) {
      this.breathText.setText('');
      this.toState('REVEAL');
    }
  }

  private updateReveal(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= dt * 0.5;
      if (p.life > 0) {
        this.fxG.fillStyle(COLORS.spark, p.life * 0.8);
        this.fxG.fillCircle(p.x, p.y, 2 + p.life * 2);
      }
    }
    if (this.stateT >= TIMING.reveal) this.toState('MANDALA');
  }

  private updateMandala(w: number, h: number): void {
    this.mandala.update(this.game.loop.delta / 1000);
    const bloom = Math.min(1, this.stateT / 1.4);
    const eased = 1 - Math.pow(1 - bloom, 3);
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.3;
    this.mandala.draw(this.mainG, cx, cy, radius, this.globalT, eased);

    if (this.stateT >= TIMING.mandala) this.toState('GALAXY');
  }

  private updateGalaxy(w: number, h: number): void {
    this.galaxy.update(this.game.loop.delta / 1000);
    const cx = w / 2, cy = h / 2;
    const minDim = Math.min(w, h);
    this.galaxy.draw(this.mainG, cx, cy, minDim, this.globalT);
    this.drawLennyCore(cx, cy);

    if (this.galaxyReady) {
      this.promptText.setText('\u05d1\u05b0\u05bc\u05d7\u05b2\u05e8\u05b4\u05d9 \u05db\u05bc\u05d5\u05b9\u05db\u05b8\u05d1 \u05d6\u05b8\u05d4\u05d5\u05b9\u05d1');
    }
  }

  /* Lenny at the galaxy heart, breathing */
  private drawLennyCore(cx: number, cy: number): void {
    const b = 0.85 + 0.15 * Math.sin(this.globalT * LENNY.breathRate * Math.PI * 2);
    const r = 16 * b;
    this.mainG.fillStyle(LENNY.glow, 0.15);
    this.mainG.fillCircle(cx, cy, r * 2.4);
    this.mainG.fillStyle(LENNY.color, 1);
    this.mainG.fillCircle(cx, cy, r);
    /* eyes */
    this.mainG.fillStyle(0xffffff, 1);
    this.mainG.fillCircle(cx - 5, cy - 3, 3.4);
    this.mainG.fillCircle(cx + 5, cy - 3, 3.4);
    this.mainG.fillStyle(0x0a0416, 1);
    this.mainG.fillCircle(cx - 5, cy - 3, 1.7);
    this.mainG.fillCircle(cx + 5, cy - 3, 1.7);
  }
}
