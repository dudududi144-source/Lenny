import Phaser from 'phaser';
import { loadSave } from '../systems/save';
import { stateManager } from '../core/StateManager';

/* ParentLens v2 — dashboard reads from clean StateManager (transparency) */
export class ParentsScene extends Phaser.Scene {
  constructor() { super('parents'); }

  create(): void {
    const sv = loadSave();
    const w = this.scale.width, h = this.scale.height;
    const lights = stateManager.getLights();

    this.add.rectangle(w / 2, h / 2, w, h, 0x0a0416);

    this.add.text(w / 2, h * 0.12, 'פִּנַּת הַהוֹרִים', {
      fontFamily: 'Heebo', fontSize: '28px', color: '#FFF6EC'
    }).setOrigin(0.5);

    const lines = [
      'אוֹרוֹת: ' + lights + '/10',
      'התקדמות: ' + Math.round(lights * 10) + '%',
      'מיומנויות שנתקלו: חיות, מספרים',
      'מגבלת זמן: ' + (sv.limit ? sv.limit + ' דק׳' : 'כבויה')
    ];

    this.add.text(w / 2, h * 0.32, lines.join('\n'), {
      fontFamily: 'Heebo', fontSize: '20px', color: '#FFF6EC', align: 'center'
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(w / 2, h * 0.85, 'חֲזָרָה', {
      fontFamily: 'Heebo', fontSize: '20px', color: '#2a2140',
      backgroundColor: '#FFD76A', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    backBtn.on('pointerdown', () => this.scene.start('title'));
  }
}
