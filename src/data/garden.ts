import { GameCategory } from './games';

/* ============================================================
 * The Garden — a living world, not a menu.
 * Zones sit along a path. Each has a mission, an insight, and
 * an unlock rule. Language is warm and everyday (see ETHICS + GARDEN.md).
 * ============================================================ */

export type ZoneId =
  | 'light-path'
  | 'memory-hill'
  | 'attention-stream'
  | 'thinking-forest'
  | 'space-sky'
  | 'words-valley'
  | 'feelings-garden'
  | 'creativity-meadow'
  | 'rhythm-square'
  | 'breath-pool';

export type UnlockKind = 'open' | 'key' | 'bridge' | 'tunnel';

export interface UnlockRule {
  kind: UnlockKind;
  /* which zone must be completed first */
  from?: ZoneId;
  /* how many games to finish in the previous zone */
  gamesNeeded?: number;
}

export interface ZoneDef {
  id: ZoneId;
  name: string;        /* everyday Hebrew, with niqqud */
  desc: string;        /* short UI subtitle for the HTML garden map */
  mission: string;     /* the big mission of this zone */
  insight: string;     /* the little realization at the end */
  category: GameCategory;
  color: number;
  /* CSS hex color for the HTML garden map. Kept separate from `color`
     (canvas int) so the live map keeps its exact current visuals —
     the two intentionally differ for memory-hill and words-valley. */
  uiColor: string;
  icon: string;
  unlock: UnlockRule;
  /* Phaser scene to open when this zone is played (undefined = not built yet) */
  gameScene?: string;
}

export const ZONES: ZoneDef[] = [
  {
    id: 'light-path',
    gameScene: 'play',
    name: 'שְׁבִיל הָאוֹר',
    desc: 'הַמַּסָּע מַתְחִיל כָּאן',
    uiColor: '#ffd76a',
    mission: 'בּוֹא נַדְלִיק אֶת הַפָּנָסִים שֶׁל הַשְּׁבִיל!',
    insight: 'רָאִית? כָּל אוֹר קָטָן עוֹשֶׂה אֶת הַדֶּרֶךְ בְּהִירָה.',
    category: 'breath',
    color: 0xffd76a,
    icon: '✦',
    unlock: { kind: 'open' },
  },
  {
    id: 'memory-hill',
    gameScene: 'memory-pairs',
    name: 'גִּבְעַת הַזִּכָּרוֹן',
    desc: 'זִכְרוֹן וְהַתְאָמוֹת',
    uiColor: '#7c4dff',
    mission: 'הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ. בּוֹא נַעֲזֹר לוֹ!',
    insight: 'כְּשֶׁמִּתְרַכְּזִים, זוֹכְרִים יוֹתֵר טוֹב!',
    category: 'memory',
    color: 0xf2549a,
    icon: '❁',
    unlock: { kind: 'key', from: 'light-path', gamesNeeded: 1 },
  },
  {
    id: 'attention-stream',
    gameScene: 'glow-fish',
    name: 'נַחַל הַקֶּשֶׁב',
    desc: 'קֶשֶׁב וְרִכּוּז',
    uiColor: '#4dc9ff',
    mission: 'הַדָּגִים מְחַפְּשִׂים אֶת הַמַּנְגִּינָה. בּוֹא נַקְשִׁיב יַחַד!',
    insight: 'כְּשֶׁמַּקְשִׁיבִים, שׁוֹמְעִים דְּבָרִים יָפִים.',
    category: 'attention',
    color: 0x4dc9ff,
    icon: '≈',
    unlock: { kind: 'bridge', from: 'memory-hill', gamesNeeded: 1 },
  },
  {
    id: 'thinking-forest',
    gameScene: 'acorn-sort',
    name: 'יַעַר הַחֲשִׁיבָה',
    desc: 'הִגָּיוֹן וְסֵדֶר',
    uiColor: '#7dffb8',
    mission: 'הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים. בּוֹא נַחְשֹׁב יַחַד!',
    insight: 'לִפְעָמִים צָרִיךְ לְנַסּוֹת כַּמָּה דְּרָכִים עַד שֶׁמַּצְלִיחִים.',
    category: 'logic',
    color: 0x7dffb8,
    icon: '❋',
    unlock: { kind: 'tunnel', from: 'attention-stream', gamesNeeded: 1 },
  },
  {
    id: 'space-sky',
    gameScene: 'kite-match',
    name: 'שְׁמֵי הַמֶּרְחָב',
    desc: 'צוּרוֹת וּמֶרְחָב',
    uiColor: '#b39ddb',
    mission: 'הָעִפְעוֹפִים הִתְבַּלְבְּלוּ בַּשָּׁמַיִם. בּוֹא נְסַדֵּר אוֹתָם!',
    insight: 'גַּם כְּשֶׁמִּסְתַּבֵּךְ, אֶפְשָׁר לִמְצֹא אֶת הַמָּקוֹם.',
    category: 'spatial',
    color: 0xb39ddb,
    icon: '✧',
    unlock: { kind: 'key', from: 'thinking-forest', gamesNeeded: 1 },
  },
  {
    id: 'words-valley',
    gameScene: 'find-letter',
    name: 'עֵמֶק הַמִּלִּים',
    desc: 'אוֹתִיּוֹת וּמִלִּים',
    uiColor: '#f2549a',
    mission: 'הָאַרְנֶבֶת אִבְּדָה אֶת הָאוֹתִיּוֹת. בּוֹא נִמְצָא אוֹתָן!',
    insight: 'אוֹתִיּוֹת קְטַנּוֹת מִתְחַבְּרוֹת לְמִלִּים גְּדוֹלוֹת.',
    category: 'language',
    color: 0xffa552,
    icon: '✶',
    unlock: { kind: 'bridge', from: 'space-sky', gamesNeeded: 1 },
  },
  {
    id: 'feelings-garden',
    gameScene: 'emotion-face',
    name: 'גַּן הָרְגָשׁוֹת',
    desc: 'רְגָשׁוֹת וְאַמְפַּתְיָה',
    uiColor: '#ff8bd4',
    mission: 'הַצָּב עָצוּב וְלֹא יוֹדֵעַ לָמָּה. בּוֹא נְדַבֵּר אִתּוֹ!',
    insight: 'כָּל הָרְגָשׁוֹת הֵם בְּסֵדֶר. גַּם הָעֶצֶב.',
    category: 'emotion',
    color: 0xff8bd4,
    icon: '♥',
    unlock: { kind: 'key', from: 'words-valley', gamesNeeded: 1 },
  },
  {
    id: 'creativity-meadow',
    gameScene: 'bee-paint',
    name: 'אֲחוּ הַיְּצִירָה',
    desc: 'יְצִירָה חָפְשִׁית',
    uiColor: '#ffa552',
    mission: 'הַדְּבוֹרָה רוֹצָה לְצַיֵּר אֲבָל אֵין לָהּ צְבָעִים. בּוֹא נַעֲזֹר!',
    insight: 'אֵין דֶּרֶךְ אַחַת לְצַיֵּר. כָּל דֶּרֶךְ יָפָה.',
    category: 'creativity',
    color: 0xffa552,
    icon: '✿',
    unlock: { kind: 'tunnel', from: 'feelings-garden', gamesNeeded: 1 },
  },
  {
    id: 'rhythm-square',
    gameScene: 'drum-beat',
    name: 'כִּכַּר הַקֶּצֶב',
    desc: 'קֶצֶב וּתְנוּעָה',
    uiColor: '#52e0c4',
    mission: 'הַתֹּף הַגָּדוֹל הִפְסִיק לְתַפְתֵּף. בּוֹא נַחְזִיר לוֹ אֶת הַקֶּצֶב!',
    insight: 'כְּשֶׁזָּזִים בְּקֶצֶב, הַגּוּף וְהַלֵּב נִרְגָּעִים.',
    category: 'rhythm',
    color: 0x52e0c4,
    icon: '♪',
    unlock: { kind: 'key', from: 'creativity-meadow', gamesNeeded: 1 },
  },
  {
    id: 'breath-pool',
    gameScene: 'lenny-story',
    name: 'בְּרֵכַת הַנְּשִׁימָה',
    desc: 'נְשִׁימָה וּרְגִיעָה',
    uiColor: '#7c4dff',
    mission: 'הַבּוּעוֹת רוֹצוֹת לָעוּף לְאַט. בּוֹא נִנְשֹׁם אִתָּן!',
    insight: 'נְשִׁימָה אֲרוּכָּה עוֹשָׂה שֶׁקֶט בַּפְּנִים.',
    category: 'breath',
    color: 0x7c4dff,
    icon: '◌',
    unlock: { kind: 'open' },
  },
];

/* ---------- helpers ---------- */

export function getZone(id: ZoneId): ZoneDef | undefined {
  return ZONES.find((z) => z.id === id);
}

export function zonesByCategory(cat: GameCategory): ZoneDef[] {
  return ZONES.filter((z) => z.category === cat);
}

/* ---------- warm everyday UI lines (no biblical register) ---------- */
export const GARDEN_TEXT = {
  welcome: 'הַגַּן נִרְדָּם... בּוֹא נַעֲזֹר לוֹ לְהִתְעוֹרֵר?',
  firstLight: 'וָאו! הַפֶּרַח נִפְתַּח! תּוֹדָה לְךָ!',
  keepGoing: 'בּוֹא נִמְשִׁיךְ! יֵשׁ עוֹד מָה לְגַלּוֹת.',
  newZone: 'הַשַּׁעַר נִפְתַּח! בּוֹא נִרְאֶה מָה יֵשׁ שָׁם!',
  lockedSoon: 'עוֹד קְצָת וְגַם הַשַּׁעַר הַזֶּה יִפָּתַח.',
  backLater: 'אֶפְשָׁר לָחוֹז הַמָּקוֹם הַזֶּה מָתַי שֶׁבָּא לְךָ.',
  playInvite: 'בּוֹא נְשַׂחֵק!',
  wellDone: 'וָאו, כָּל הַכָּבוֹד!',
  tryAgain: 'לֹא נוֹרָא, בּוֹא נְנַסֶּה עוֹד פַּעַם.',
  giftIdea: 'אֶפְשָׁר לִשְׁלֹחַ מַתָּנָה לְחָבֵר!',
  lanternLit: 'עוֹד פָּנָס דּוֹלֵק לְאֹרֶךְ הַשְּׁבִיל.',
};

/* ---------- discovery-quest lines (critic round B, W2/W7) ----------
   Gender-neutral (the audits flagged masc/fem mixing): Lenny invites
   the child as a partner ("בוא נ..."), never commands a gendered verb. */
export const QUEST_TEXT = {
  /** wayfinding offer: composed with the landmark's own name */
  wayfinding: (place: string): string => `בּוֹא נֵלֵךְ אֶל ${place}!`,
  countingOffer: 'פְּרָחִים פְּרָחוּ כָּאן! קַשְׁתּוּ כָּל אֶחָד.',
  countingAsk: 'כַּמָּה פְּרָחִים הָיוּ כָּאן?',
  countingAgain: 'לֹא נוֹרָא — בּוֹא נִסְפּוֹר שׁוּב!',
  /** the counting walk (stage 15-C): composed with the thing's own name */
  walkCountOffer: (thing: string): string => `בַּדֶּרֶךְ אֶפְשָׁר לִרְאוֹת ${thing}! סִפְרוּ וּבַחֲרוּ מִסְפָּר.`,
  walkCountAgain: 'כִּמְעַט! בּוֹא נִסְפּוֹר שׁוּב לְאַט.',
  patternOffer: 'הָאֲבָנִים יוֹצְרוֹת סֵדֶר. אֵיזֶה צֶבַע מַמְשִׁיךְ?',
  patternAgain: 'טוֹב! נִנְסֶה שׁוּב.',
  done: 'וָאו! עוֹד גִּלּוּי הַושְׁלַם!',
  later: 'בְּסֵדֶר, נַמְשִׁיךְ אַחֲרֵי כָּךְ.',
  notYet: 'זֶה מָקוֹם יָפֶה! עוֹד קְצָת וְנַגִּיעַ.',
  foundAll: 'הַגַּן כֻּלּוֹ מֻכָּר לְךָ עַכְשָׁיו!',
  questChip: 'מְשִׂימַת גִּלּוּי',
};
