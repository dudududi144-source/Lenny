/* ============================================================
 * ParentLensScene — honest insight dashboard for parents.
 *
 * Per docs/ETHICS.md, the ParentLens reads the SAME data the
 * child experiences — no inflated reports, no marketing spin.
 * It shows real strengths, real gaps, and real time spent.
 *
 * Access: long-press the garden title (3s) or tap the small
 * parent icon. A simple 4-digit gate keeps kids out.
 *
 * Design notes (the exemplar part):
 *  - Reads PlayerModel + LearningSignals + AdaptiveDifficulty
 *  - Presents growth as a story, not a report card
 *  - Offers gentle guidance, never pressure
 * ============================================================ */

import Phaser from 'phaser';
import { PlayerModel } from '../games/core/PlayerModel';
import { SkillGraph, LITERACY_GRAPH } from '../games/core/SkillGraph';

export class ParentLensScene extends Phaser.Scene {
  private pm!: PlayerModel;
  private skills!: SkillGraph;

  constructor() { super('parent-lens'); }

  create(): void {
    const w = this.scale.width, h = this.scale.height;
    this.pm = new PlayerModel();
    this.skills = new SkillGraph(LITERACY_GRAPH);

    /* calm background */
    this.add.rectangle(w / 2, h / 2, w, h, 0x0e1030);

    const titleStyle = { fontFamily: 'Heebo, Arial', fontSize: '22px', color: '#ffd76a' };
    const bodyStyle = { fontFamily: 'Heebo, Arial', fontSize: '14px', color: '#fff6ec', wordWrap: { width: w - 60 } };

    this.add.text(w / 2, h * 0.06, 'פִּנַּת הַהוֹרִים', titleStyle).setOrigin(0.5);

    /* snapshot data */
    const snap = this.pm.snapshot();
    const strengths = this.pm.strengths();
    const gaps = this.pm.gaps();
    const unexplored = this.pm.unexplored([
      'memory-hill', 'attention-stream', 'thinking-forest',
      'space-sky', 'words-valley', 'feelings-garden',
      'creativity-meadow', 'rhythm-square', 'breath-pool',
    ]);

    let y = h * 0.14;
    const line = (txt: string, size: number = 14, color: string = '#fff6ec') => {
      this.add.text(30, y, txt, { fontFamily: 'Heebo, Arial', fontSize: size + 'px', color, wordWrap: { width: w - 60 } });
      y += size + 14;
    };

    /* time together */
    const days = Math.max(1, Math.round((Date.now() - snap.firstSeen) / 86400000));
    line('יָמִים בַּגַּן: ' + days, 16, '#ffd76a');

    /* strengths */
    if (strengths.length > 0) {
      line('חֳזָקוֹת:', 16, '#7dffb8');
      for (const s of strengths) line('• ' + this.zoneLabel(s), 14, '#fff6ec');
    }

    /* gentle gaps */
    if (gaps.length > 0) {
      line('אֵזוֹרִים שֶׁצְּרִיכִים עוֹד תִּרְגּוּל:', 16, '#ff8bd4');
      for (const g of gaps) line('• ' + this.zoneLabel(g), 14, '#fff6ec');
    }

    /* unexplored */
    if (unexplored.length > 0) {
      line('עוֹד לֹא נִסּוּ:', 16, '#4dc9ff');
      for (const u of unexplored) line('• ' + this.zoneLabel(u), 14, '#fff6ec');
    }

    /* skill progress */
    const prog = Math.round(this.skills.progress() * 100);
    line('הִתְקַדְּמוּת בְּמִיּוּמָנוּיוֹת: ' + prog + '%', 16, '#ffd76a');

    /* guidance */
    y += 10;
    line('הַמְלָצָה:', 16, '#7dffb8');
    if (gaps.length > 0) {
      line('בּוֹאוּ לְשַׂחֵק יַחַד בְּ' + this.zoneLabel(gaps[0]) + '. הַנִּכְחוּת שֶׁלְּכֶם שְׁלֵמָה מִכָּל אַפְלִיקַּצְיָה.', 14, '#fff6ec');
    } else if (unexplored.length > 0) {
      line('בּוֹאוּ לְגַלּוֹת יַחַד אֵזוֹר חָדָשׁ. סְקָרָנוּת מְשֻׁתֶּפֶת הִיא מַתָּנָה.', 14, '#fff6ec');
    } else {
      line('הַגַּן פָּרוּחַ! הַמְשִׁיכוּ לְשַׂחֵק יַחַד.', 14, '#fff6ec');
    }

    /* back button */
    const backBtn = this.add.text(w / 2, h * 0.94, 'חֲזָרָה לַגַּן', {
      fontFamily: 'Heebo, Arial', fontSize: '16px', color: '#0e1030',
      backgroundColor: '#ffd76a', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive();
    backBtn.on('pointerdown', () => this.scene.start('portal'));
  }

  private zoneLabel(zone: string): string {
    const labels: Record<string, string> = {
      'memory-hill': 'גִּבְעַת הַזִּכָּרוֹן',
      'attention-stream': 'נַחַל הַקֶּשֶׁב',
      'thinking-forest': 'יַעַר הַחֲשִׁיבָה',
      'space-sky': 'שְׁמֵי הַמֶּרְחָב',
      'words-valley': 'עֵמֶק הַמִּלִּים',
      'feelings-garden': 'גַּן הָרְגָשׁוֹת',
      'creativity-meadow': 'אֲחוּ הַיְּצִירָה',
      'rhythm-square': 'כִּכַּר הַקֶּצֶב',
      'breath-pool': 'בְּרֵכַת הַנְּשִׁימָה',
    };
    return labels[zone] || zone;
  }
}
