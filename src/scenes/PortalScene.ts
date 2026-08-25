/* ============================================================
 * PortalScene — the gateway into the Garden.
 * States: VOID -> SPARK -> BREATH -> STORY -> GARDEN.
 * Warm, everyday Hebrew. Nothing hidden. Tap to skip ahead.
 * ============================================================ */

import Phaser from 'phaser';
import { PortalState, THETA, BREATH, TIMING, COLORS, LENNY, AFFIRMATIONS } from '../data/portalConfig';
import { ZONES, getZone, GARDEN_TEXT, ZoneId } from '../data/garden';
import { ThetaPulse } from '../portal/ThetaPulse';
import { BreathSystem } from '../portal/BreathSystem';
import { GardenSystem, GardenProgress, defaultProgress } from '../portal/GardenSystem';
import { AffirmationSystem } from '../portal/AffirmationSystem';

export class PortalScene extends Phaser.Scene {
  private mainG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;

  private theta!: ThetaPulse;
  private breath!: BreathSystem;
  private garden!: GardenSystem;
  private affirmation!: AffirmationSystem;

  private state: PortalState = 'VOID';
  private stateT = 0;
  private globalT = 0;

  private progress: GardenProgress = defaultProgress;

  private centerText!: Phaser.GameObjects.Text;
  private storyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private affirmationText!: Phaser.GameObjects.Text;

  private gardenReady = false;

  constructor() { super('portal'); }

  create(): void {
    this.mainG = this.add.graphics();
    this.fxG = this.add.graphics();

    this.theta = new ThetaPulse(THETA.freq);
    this.breath = new BreathSystem(BREATH);
    this.garden = new GardenSystem();

    /* load saved garden progress if any */
    this.loadProgress();

    const w = this.scale.width, h = this.scale.height;
    const heebo = { fontFamily: 'Heebo, Arial', color: '#fff6ec' };

    this.centerText = this.add.text(w / 2, h * 0.84, '', { ...heebo, fontSize: '22px' })
      .setOrigin(0.5).setAlpha(0.9);

    this.storyText = this.add.text(w / 2, h * 0.42, '', { ...heebo, fontSize: '20px', align: 'center' })
      .setOrigin(0.5).setAlpha(0);

    this.promptText = this.add.text(w / 2, h * 0.07, '', { ...heebo, fontSize: '17px' })
      .setOrigin(0.5).setAlpha(0.55);

    this.affirmationText = this.add.text(0, 0, '', { ...heebo, fontSize: '24px' })
      .setOrigin(0.5).setVisible(false);

    this.affirmation = new AffirmationSystem(this.affirmationText, () => this.time.now);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTouch(p));
  }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem('lenny-garden');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GardenProgress>;
        this.progress = { ...defaultProgress, ...parsed };
      }
    } catch {
      this.progress = defaultProgress;
    }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem('lenny-garden', JSON.stringify(this.progress));
    } catch {
      /* noop */
    }
  }

  private onTouch(p: Phaser.Input.Pointer): void {
    if (this.state === 'GARDEN') {
      this.handleGardenTap(p);
      return;
    }
    /* any tap during the intro fast-forwards into the garden */
    this.toState('GARDEN');
  }

  private handleGardenTap(p: Phaser.Input.Pointer): void {
    if (!this.gardenReady) return;
    const w = this.scale.width, h = this.scale.height;
    const zoneId = this.garden.hitTest(p.x, p.y, w, h);
    if (!zoneId) return;

    const zone = getZone(zoneId);
    if (!zone) return;

    if (this.progress.unlocked.includes(zoneId)) {
      this.progress.current = zoneId;
      this.saveProgress();
      /* for now, the first zone's playable game is Lenny Star Jump */
      if (zoneId === 'light-path') {
        this.showCenter(GARDEN_TEXT.playInvite);
        this.time.delayedCall(300, () => this.scene.start('play'));
      } else {
        this.showCenter(zone.mission);
      }
    } else {
      this.showCenter(GARDEN_TEXT.lockedSoon);
    }
  }

  private showCenter(msg: string): void {
    this.centerText.setText(msg);
    this.centerText.setAlpha(1);
    this.tweens.add({ targets: this.centerText, alpha: 0, duration: 1200, delay: 1400 });
  }

  private toState(next: PortalState): void {
    this.state = next;
    this.stateT = 0;
    if (next === 'GARDEN') {
      this.gardenReady = false;
      this.storyText.setAlpha(0);
      this.promptText.setText(GARDEN_TEXT.backLater);
      this.time.delayedCall(700, () => { this.gardenReady = true; });
    } else if (next === 'STORY') {
      this.promptText.setText('');
      this.showStory();
    } else {
      this.promptText.setText('');
    }
  }

  private showStory(): void {
    this.storyText.setText(GARDEN_TEXT.welcome);
    this.tweens.add({ targets: this.storyText, alpha: 1, duration: 800 });
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.033);
    this.globalT += dt;
    this.stateT += dt;
    this.theta.update(dt);
    this.breath.update(dt);
    this.affirmation.update();

    const w = this.scale.width, h = this.scale.height;
    this.mainG.clear();
    this.fxG.clear();

    switch (this.state) {
      case 'VOID': this.updateVoid(); break;
      case 'SPARK': this.updateSpark(w, h); break;
      case 'BREATH': this.updateBreath(w, h); break;
      case 'STORY': this.updateStory(w, h); break;
      case 'GARDEN': this.updateGarden(dt, w, h); break;
    }
  }

  private updateVoid(): void {
    this.centerText.setText('');
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

    this.mainG.fillStyle(COLORS.violet, 0.10);
    this.mainG.fillCircle(cx, cy, r * 1.5);
    this.mainG.lineStyle(2, COLORS.mint, 0.7);
    this.mainG.strokeCircle(cx, cy, r);
    this.mainG.fillStyle(COLORS.spark, 0.14);
    this.mainG.fillCircle(cx, cy, r);

    this.centerText.setText('בּוֹא נִנְשֹׁם רֶגַע יַחַד');

    if (this.stateT >= TIMING.breath) {
      this.centerText.setText('');
      this.toState('STORY');
    }
  }

  private updateStory(w: number, h: number): void {
    /* Lenny glows softly while telling the story */
    const cx = w / 2, cy = h * 0.62;
    const pulse = this.theta.getEased();
    this.mainG.fillStyle(LENNY.glow, 0.15 + pulse * 0.05);
    this.mainG.fillCircle(cx, cy, 34);
    this.mainG.fillStyle(LENNY.color, 1);
    this.mainG.fillCircle(cx, cy, 16);
    this.mainG.fillStyle(0xffffff, 1);
    this.mainG.fillCircle(cx - 5, cy - 3, 3.4);
    this.mainG.fillCircle(cx + 5, cy - 3, 3.4);
    this.mainG.fillStyle(0x0a0416, 1);
    this.mainG.fillCircle(cx - 5, cy - 3, 1.7);
    this.mainG.fillCircle(cx + 5, cy - 3, 1.7);

    if (this.stateT >= TIMING.story) this.toState('GARDEN');
  }

  private updateGarden(dt: number, w: number, h: number): void {
    this.garden.draw(this.mainG, w, h, this.globalT, this.progress);
  }
}
