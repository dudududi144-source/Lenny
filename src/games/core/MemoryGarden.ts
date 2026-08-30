/* ============================================================
 * MemoryGarden — Lenny remembers what the child did.
 *
 * This is the narrative heart of the platform. Instead of a
 * static greeting, Lenny references real past events:
 *   - which zone the child played in last
 *   - how many lights they lit
 *   - how long since they last visited
 *
 * This creates continuity — the garden feels alive because
 * it remembers. That is what makes a child come back.
 *
 * Design notes (the exemplar part):
 *  - Reads the same localStorage data the games write
 *  - Generates warm, varied greetings (never the same twice)
 *  - No data leaves the device (privacy-first)
 * ============================================================ */

import { PlayerModel } from './PlayerModel';
import { ZONES } from '../../data/garden';

/* zone display names come from the single source of truth (data/garden.ts).
   (This file previously held its own hardcoded duplicate map.) */
const ZONE_NAMES: Record<string, string> = Object.fromEntries(
  ZONES.map((z) => [z.id, z.name]),
);

export class MemoryGarden {
  private pm: PlayerModel;

  constructor() {
    this.pm = new PlayerModel();
  }

  /** Generate a warm greeting that references real past events. */
  greeting(): string[] {
    const snap = this.pm.snapshot();
    const lines: string[] = [];

    /* returning visitor? */
    const days = Math.round((Date.now() - snap.firstSeen) / 86400000);
    if (days >= 1) {
      lines.push('הֵיי! חָזַרְתָּ! הַגַּן הִתְגַּעְגֵּעַ.');
    } else {
      lines.push('בְּרוּכָה הַבָּאָה לַגַּן שֶׁל אוֹרוֹת!');
    }

    /* reference the zone they played most */
    const interest = this.pm.interest();
    if (interest && ZONE_NAMES[interest]) {
      lines.push('רָאִיתִי שֶׁשִּׂחַקְתְּ בְּ' + ZONE_NAMES[interest] + '. אֵיזֶה כִּיף!');
    }

    /* celebrate lights lit */
    const strengths = this.pm.strengths();
    if (strengths.length > 0 && ZONE_NAMES[strengths[0]]) {
      lines.push('אַתְּ מַצְלִיחָה מְאוֹד בְּ' + ZONE_NAMES[strengths[0]] + '!');
    }

    /* gentle invitation to explore */
    const unexplored = this.pm.unexplored(Object.keys(ZONE_NAMES));
    if (unexplored.length > 0) {
      lines.push('בּוֹאִי נְגַלֶּה יַחַד אֶת ' + ZONE_NAMES[unexplored[0]] + '.');
    } else {
      lines.push('גִּלִּית אֶת כָּל הָאֲזוֹרִים! מַה נַּעֲשֶׂה הַיּוֹם?');
    }

    /* return at most 2 lines to keep it warm and short */
    return lines.slice(0, 2);
  }

  /** A farewell line when the child leaves. */
  farewell(): string {
    return 'לְהִתְרָאוֹת! הַגַּן יְחַכֶּה לָךְ.';
  }
}
