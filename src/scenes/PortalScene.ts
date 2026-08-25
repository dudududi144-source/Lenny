/* ============================================================
 * PortalScene — the gateway into the Garden.
 * States: VOID -> SPARK -> BREATH -> STORY -> GARDEN.
 * Warm, everyday Hebrew. Nothing hidden. Tap to skip ahead.
 * ============================================================ */

import Phaser from 'phaser';
import { GameFactory } from '../games/builder/GameFactory';
import { MemoryGarden } from '../games/core/MemoryGarden';
import { gamesInZone } from '../games/builder/GameRegistry';
import { PortalState, THETA, BREATH, TIMING, COLORS, LENNY, AFFIRMATIONS } from '../data/portalConfig';
import { ZONES, getZone, GARDEN_TEXT, ZoneId } from '../data/garden';
import { ThetaPulse } from '../portal/ThetaPulse';
import { BreathSystem } from '../portal/BreathSystem';
import { GardenSystem, GardenProgress, freshProgress } from '../portal/GardenSystem';
import { AffirmationSystem } from '../portal/AffirmationSystem';

export class PortalScene extends Phaser.Scene {
  private parentIcon!: Phaser.GameObjects.Text;
  private lennyImg!: Phaser.GameObjects.Image;
  private mainG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;

  private theta!: ThetaPulse;
  private breath!: BreathSystem;
  private garden!: GardenSystem;
  private affirmation!: AffirmationSystem;

  private state: PortalState = 'VOID';
  private stateT = 0;
  private globalT = 0;

  private progress: GardenProgress = freshProgress();

  private centerText!: Phaser.GameObjects.Text;
  private storyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private affirmationText!: Phaser.GameObjects.Text;

  private gardenReady = false;

  constructor() { super('portal'); }

  preload(): void {
    /* professional art assets */
    this.load.image('garden-bg', 'art/garden-bg.png');
    this.load.image('lenny', 'art/lenny.png');
  }

  create(): void {
    /* illustrated background — full presence, the art IS the world */
    const bgImg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'garden-bg');
    bgImg.setDisplaySize(this.scale.width, this.scale.height);
    bgImg.setAlpha(0.95);
    bgImg.setDepth(0);

    /* Lenny the star mascot — big, glowing, alive */
    const glow = this.add.ellipse(this.scale.width * 0.5, this.scale.height * 0.78, 230, 230, 0xffd76a, 0.16);
    glow.setDepth(4);
    this.tweens.add({ targets: glow, scaleX: 1.18, scaleY: 1.18, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lennyImg = this.add.image(this.scale.width * 0.5, this.scale.height * 0.78, 'lenny');
    this.lennyImg.setDisplaySize(150, 150);
    this.lennyImg.setDepth(5);
    this.tweens.add({ targets: this.lennyImg, y: this.lennyImg.y - 10, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.mainG = this.add.graphics();
    this.mainG.setDepth(2);
    this.fxG = this.add.graphics();
    this.fxG.setDepth(8);

    this.theta = new ThetaPulse(THETA.freq);
    this.breath = new BreathSystem(BREATH);
    this.garden = new GardenSystem();

    /* load saved garden progress if any */
    this.loadProgress();
    const opened = this.checkUnlocks();
    if (opened.length > 0 && this.progress.finished && Object.keys(this.progress.finished).length > 0) {
      this.time.delayedCall(600, () => this.celebrate(opened[opened.length - 1]));
    }

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

    /* Lenny's memory — greets based on real past events */
    const memory = new MemoryGarden();
    const greetLines = memory.greeting();
    if (greetLines.length > 0) {
      this.showCenter(greetLines[0]);
      if (greetLines.length > 1) {
        this.time.delayedCall(2500, () => this.showCenter(greetLines[1]));
      }
    }

    /* small parent icon top-left -> ParentLens */
    const w2 = this.scale.width;
    this.parentIcon = this.add.text(w2 - 24, 20, '⬤', {
      fontFamily: 'Arial', fontSize: '14px', color: '#3a3350',
    }).setOrigin(0.5).setInteractive();
    this.parentIcon.on('pointerdown', () => this.scene.start('parent-lens'));
  }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem('lenny-garden');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GardenProgress>;
        this.progress = { ...freshProgress(), ...parsed };
      }
    } catch {
      this.progress = freshProgress();
    }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem('lenny-garden', JSON.stringify(this.progress));
    } catch {
      /* noop */
    }
  }

  /* open any zone whose unlock condition is now met; returns opened zone names */
  private checkUnlocks(): string[] {
    const openedNames: string[] = [];
    for (const zone of ZONES) {
      if (this.progress.unlocked.includes(zone.id)) continue;
      const rule = zone.unlock;
      if (rule.kind === 'open') {
        this.progress.unlocked.push(zone.id);
        openedNames.push(zone.name);
        continue;
      }
      if (rule.from) {
        const done = this.progress.finished[rule.from] || 0;
        const need = rule.gamesNeeded ?? 1;
        if (done >= need) {
          this.progress.unlocked.push(zone.id);
          openedNames.push(zone.name);
        }
      }
    }
    if (openedNames.length > 0) this.saveProgress();
    return openedNames;
  }

  /* little celebration when a new zone opens */
  private celebrate(zoneName: string): void {
    const w = this.scale.width, h = this.scale.height;
    this.showCenter(GARDEN_TEXT.newZone + '\n' + zoneName);
    /* sparkle burst */
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 70;
      const sx = w / 2 + Math.cos(ang) * dist;
      const sy = h * 0.45 + Math.sin(ang) * dist;
      const dot = this.add.circle(w / 2, h * 0.45, 2.5, 0xffd76a, 1);
      this.tweens.add({
        targets: dot,
        x: sx, y: sy, alpha: 0,
        duration: 700 + Math.random() * 400,
        onComplete: () => dot.destroy(),
      });
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
      const zoneGames = gamesInZone(zoneId);
      if (zoneGames.length > 0) {
        this.showCenter(GARDEN_TEXT.playInvite);
        const spec = zoneGames[0];
        this.time.delayedCall(300, () => GameFactory.start(this, spec));
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
