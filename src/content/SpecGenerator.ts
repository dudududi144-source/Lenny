/* ============================================================
 * SpecGenerator — the 144-name seed becomes a living catalog.
 *
 * data/games.ts holds the 144 Hebrew names (9 categories × 16,
 * 4 tiers × 4 games). This module derives a playable GameSpec
 * from EVERY name, using the 11 builder templates (GameKind).
 *
 *   memory      -> memory-pairs                (16)
 *   attention   -> find-target                 (16)
 *   logic       -> sort-order + sequence-echo  (8+8)
 *   spatial     -> match-shadow                (16)
 *   language    -> letter-find                 (16)
 *   emotion     -> emotion-name                (16)
 *   creativity  -> paint-fill + open-create    (8+8)
 *   rhythm      -> rhythm-tap                  (16)
 *   breath      -> breath-guide                (16)
 *
 * Everything is deterministic: same seed names in, same 144
 * specs out — no randomness, no clock, no storage.
 *
 * Params are tuned so every tier-0 spec behaves EXACTLY like the
 * hand-written seed specs the e2e suite grew up on (item counts,
 * round counts, speeds) — the catalog grows without moving the
 * ground under existing games.
 * ============================================================ */

import { GAMES, CATEGORY_ORDER, type GameCategory } from '../data/games';
import type { GameKind, GameNarrative, GameParams, GameSpec } from '../games/builder/GameSpec';
import type { ZoneId } from '../data/garden';

/* ---------- category -> garden zone ---------- */

export const ZONE_FOR_CATEGORY: Record<GameCategory, ZoneId> = {
  memory: 'memory-hill',
  attention: 'attention-stream',
  logic: 'thinking-forest',
  spatial: 'space-sky',
  language: 'words-valley',
  emotion: 'feelings-garden',
  creativity: 'creativity-meadow',
  rhythm: 'rhythm-square',
  breath: 'breath-pool',
};

/* ---------- category -> template(s) ---------- */

/** 16 names = 4 tiers × 4; two-kind categories split 2+2 within each tier. */
export const KINDS_FOR_CATEGORY: Record<GameCategory, [GameKind] | [GameKind, GameKind]> = {
  memory: ['memory-pairs'],
  attention: ['find-target'],
  logic: ['sort-order', 'sequence-echo'],
  spatial: ['match-shadow'],
  language: ['letter-find'],
  emotion: ['emotion-name'],
  creativity: ['paint-fill', 'open-create'],
  rhythm: ['rhythm-tap'],
  breath: ['breath-guide'],
};

/* ---------- per-kind knobs (tier 0 mirrors the seed specs) ---------- */

type ParamRecipe = (tier: number) => GameParams;

const PARAMS: Record<GameKind, ParamRecipe> = {
  'memory-pairs': (t) => ({ itemCount: 4 + t * 2, rounds: 1 }),
  'find-target': (t) => ({ itemCount: 5 + t, speed: 1 }),
  'sort-order': (t) => ({ itemCount: 4 + t }),
  'match-shadow': (t) => ({ itemCount: 4 + t * 2 }),
  'letter-find': (t) => ({ itemCount: 6, rounds: 5 + t * 2 }),
  'emotion-name': (t) => ({ rounds: 5 + t * 2 }),
  'paint-fill': (t) => ({ itemCount: 5 + t }),
  'rhythm-tap': (t) => ({ rounds: Math.min(24, 8 + t * 4), speed: Math.min(102, 78 + t * 8) }),
  'breath-guide': (t) => ({ itemCount: Math.min(5, 3 + t * 2) }),
  'open-create': () => ({ itemCount: 7 }),
  'sequence-echo': (t) => ({ rounds: 3 + t }),
};

/* ---------- per-kind skills (tier adds depth) ---------- */

type SkillRecipe = (tier: number, indexInCategory: number) => string[];

const SKILLS: Record<GameKind, SkillRecipe> = {
  'memory-pairs': (t) => [
    'memory.pairs',
    'attention.focus',
    ...(t >= 1 ? ['memory.sequence'] : []),
    ...(t >= 2 ? ['attention.selective'] : []),
  ],
  'sequence-echo': (t) => [
    'memory.working',
    'memory.sequence',
    ...(t >= 1 ? ['attention.focus'] : []),
    ...(t >= 3 ? ['memory.chain'] : []),
  ],
  'find-target': (t) => [
    'attention.visual',
    'attention.selective',
    ...(t >= 1 ? ['attention.sustained'] : []),
    ...(t >= 2 ? ['attention.focus'] : []),
  ],
  'sort-order': (t) => [
    'logic.ordering',
    'logic.size',
    ...(t >= 1 ? ['motor.planning'] : []),
    ...(t >= 2 ? ['logic.patterns'] : []),
  ],
  'match-shadow': (t) => [
    'spatial.matching',
    'spatial.shape',
    ...(t >= 1 ? ['spatial.memory'] : []),
    ...(t >= 2 ? ['spatial.rotation'] : []),
  ],
  'letter-find': (t) => [
    'language.letter-recognition',
    ...(t >= 1 ? ['language.scanning'] : []),
    ...(t >= 2 ? ['language.fluency'] : []),
  ],
  'emotion-name': (_t, i) => ['emotion.recognition', i % 2 === 0 ? 'emotion.vocabulary' : 'emotion.empathy'],
  'paint-fill': () => ['creativity.color', 'creativity.choice'],
  'open-create': () => ['creativity.divergent', 'creativity.expression'],
  'rhythm-tap': (t) => [
    'rhythm.timing',
    t === 0 ? 'rhythm.pulse' : t < 3 ? 'rhythm.sequence' : 'rhythm.mastery',
  ],
  'breath-guide': () => ['breath.regulation', 'emotion.calm'],
};

/* ---------- per-kind narrative voice ---------- */

interface NarrativeRecipe {
  intro(name: string, i: number): string[];
  win: string[];
  encourage: string[];
}

const NARRATIVES: Record<GameKind, NarrativeRecipe> = {
  'memory-pairs': {
    intro: (n, i) => [
      [`${n}! הַפַּרְפַּר שָׁכַח אֵיפֹה הַזּוּגוֹת — בּוֹא נַעֲזֹר לוֹ לִזְכֹּר.`, 'הַפְּכוּ כָּרְטִיס, מָצְאוּ זוּג.'],
      [`${n} — הָאֲבָנִים יְשֵׁנוֹת. זִכְרוֹן עָדִין יָעִיר אוֹתָן.`, 'מַה חָבוּי מֵאֲחָר?'],
      [`${n}! בּוֹא נִזְכֹּר לְאַט, בְּכִיף.`, 'עֵינַיִם עֲלֵיהֶן, לֵב שָׁקֵט.'],
      [`${n} — הַזִּכָּרוֹן מִתְחַזֵּק כְּמוֹ שְׁרִיר.`, 'כָּל זוּג שֶׁנִּמְצָא — נִיצָה שֶׁנִּפְתָּחַת.'],
    ][i % 4],
    win: ['זָכַרְתָּ הַכֹּל! הַפַּרְפַּר מְקַשְׁקֵשׁ בְּשִׂמְחָה!', 'הַזִּכְּרוֹן שֶׁלְּךָ זוֹהֵר הַלַּיְלָה!'],
    encourage: ['נַסֶּה שׁוּב — הַזּוּגוֹת מְחַכִּים לְךָ.', 'לֹא נוֹרָא. הַזִּכָּרוֹן מִתְאַמֵּן אִתְךָ.'],
  },
  'sequence-echo': {
    intro: (n, i) => [
      [`${n}! הַגּוּפִים הַזּוֹהֲרִים יְנַגְּנוּ סֵדֶר קָסוּם.`, 'הִסְתַּכְּלוּ... וְעַכְשָׁו חַזְרוּ!'],
      [`${n} — הַלַּיְלָה מְלֻדָּךְ. אֵיזֶה אוֹר יָבוֹא אַחֲרֵי אֵיזֶה אוֹר?`, 'עֵינַיִם פְּקוּחוֹת, אֶצְבַּע מוּכָן.'],
      [`${n}! סֵדֶר הָאוֹרוֹת מִתְאָרְךְ.`, 'כְּמוֹ מְלוֹדִיָּה — רַק שֶׁל אוֹר.'],
      [`${n} — הַזִּכָּרוֹן הָעוֹבֵד הַחָכָם בַּגַּן.`, 'רְגַע, עוֹד רֶגַע... וְעַכְשָׁו!'],
    ][i % 4],
    win: ['כָּל הַסְּדָרִים זָכוּרִים! הַגַּן נוֹצֵץ מִשִּׂמְחָה!', 'מֶלֶךְ וּמַלְכַּת הַסֵּדֶר! הָאוֹרוֹת מִתְפַּעֲלִים.'],
    encourage: ['כִּמְעַט! בּוֹא נִרְאֶה אֶת הַסֵּדֶר עוֹד פַּעַם.', 'הָאוֹרוֹת סַבְלָנִים. עוֹד פַּעַם, בִּרְגִיעָה.'],
  },
  'find-target': {
    intro: (n, i) => [
      [`${n}! הַדָּגִים שׂוֹחִים בַּנַּחַל — מִי מֵהֶם הַמְבֻקָּשׁ?`, 'עֵינַיִם שְׁנוֹנוֹת, לֹא צָרִיךְ לְמַהֵר.'],
      [`${n} — הַנַּחַל מָלֵא גַּלְגִּילִים.`, 'רַק לְהִסְתַּכֵּל... אוֹן הַזֹּהַר?'],
      [`${n}! חִפּוּשׂ בַּמַּיִם הַשְּׁקֵטִים.`, 'הַדָּג הַנָּכוֹן תָּמִיד מְצַפֶּה לְךָ.'],
      [`${n} — מַסָּע שֶׁל חִפּוּשׂ עָדִין.`, 'כָּל סִבּוּב מְגַלֶּה מַשֶּׁהוּ.'],
    ][i % 4],
    win: ['מָצָאתָ! עֵינַיִם חַדּוֹת כְּמוֹ שֶׁל עֵיט!', 'הַנַּחַל מְרַעִיף לְךָ כַּפַּיִם (בְּגַלִּים)!'],
    encourage: ['תִּסְתַּכֵּל בְּרַכּוּת — הַזֹּהַר שָׁם.', 'עוֹד סִבּוּב קָטָן, אַתָּה קָרוֹב.'],
  },
  'sort-order': {
    intro: (n, i) => [
      [`${n}! הַסְּנַאי אוֹסֵף בְּלוּטִים — רַק צָרִיךְ סֵדֶר.`, 'מֵהַקָּטָן אֶל הַגָּדוֹל!'],
      [`${n} — לַכֹּל יֵשׁ מָקוֹם. מָצְאִים אוֹתוֹ בִּיחָד.`, 'רֶגַע שֶׁל חִשִׁיבָה... וּמִקְמוֹ.'],
      [`${n}! סִדּוּר זְהָב.`, 'אֵיפֹה שֶׁהוּא יֵרָאֶה הֵיטֵב?'],
      [`${n} — הַמִּגְדָּל נִבְנֶה צַעַד אַחַר צַעַד.`, 'קֹדֶם חוֹשְׁבִים, אַחֲר כָּךְ נוֹגְעִים.'],
    ][i % 4],
    win: ['סֵדֶר מוּשְׁלָם! הַסְּנַאי מְרַקֵּד מֵרֹב שִׂמְחָה!', 'הַכֹּל בְּמָקוֹמוֹ — אַדְרִיכָל אֲמִתִּי!'],
    encourage: ['אֵיזֶה קָטָן יוֹתֵר? בּוֹא נִמְדֹּד בִּיחָד.', 'לֹא נוֹרָא — גַּם הַסְּנַאי מִתְבַּלְבֵּל לְפַעֲמִים.'],
  },
  'match-shadow': {
    intro: (n, i) => [
      [`${n}! הָעִפְעוֹפִים הִתְבַּלְבְּלוּ בַּשָּׁמַיִם.`, 'כָּל צֵל רוֹצֶה אֶת הַגוּף שֶׁלּוֹ בַּחֲזָרָה.'],
      [`${n} — צוּרוֹת רוֹקְדוֹת עִם הַצְּלָלִים.`, 'מִסְתַּכְּלִים לְאַט... וּמוֹצְאִים אֶת הַחֲבֵר.'],
      [`${n}! מִשְׂחַק צֵל בַּשֶּׁמֶשׁ שֶׁל אַחֲרֵי הַצָּהֳרַיִם.`, 'הַצֵּל הַנָּכוֹן תָּמִיד בּוֹלֵט.'],
      [`${n} — הַמֶּרְחָב מְשַׂחֵק אִתְךָ מַחְבֵּאוֹת.`, 'רַק לְהַבִּיט בַּקְּצֵווֹת.'],
    ][i % 4],
    win: ['כָּל הַצְּלָלִים מָצְאוּ אֶת עַצְמָם! מַדְהִים!', 'הַשָּׁמַיִם סְדוּרִים — הָעִפְעוֹפִים שָׂמֵחִים!'],
    encourage: ['תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הַצֵּל.', 'כַּמָּה קְצֵווֹת? בּוֹא נִסְפֹּר בִּיחָד.'],
  },
  'letter-find': {
    intro: (n, i) => [
      [`${n}! הָאַרְנֶבֶת אִבְּדָה אוֹתִיּוֹת בַּעֵמֶק.`, 'מִי יַעֲזֹר לָהּ לְאַסֹּף אוֹתָן?'],
      [`${n} — אוֹתִיּוֹת מִסְתַּתֶּרוֹת בֵּין הַפְּרָחִים.`, 'הָאוֹת שֶׁל הַיּוֹם מְחַכָּה.'],
      [`${n}! עֵמֶק הַמִּלִּים מְנֻקֶּד בְּאוֹתִיּוֹת.`, 'מֵאוֹת אַחַת מִתְחִילָה מִלָּה גְּדוֹלָה.'],
      [`${n} — צָד אוֹתִיּוֹת, בִּלִּי לְמַהֵר.`, 'הַעֵינַיִם סוֹרְקוֹת, הַלֵּב רָגוּעַ.'],
    ][i % 4],
    win: ['כָּל הָאוֹתִיּוֹת נִמְצְאוּ! הָאַרְנֶבֶת מְרַקֶּדֶת!', 'הָאוֹתִיּוֹת חוֹזְרוֹת הַבַּיְתָה. אַלּוּף!'],
    encourage: ['תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הָאוֹת — הִיא שָׁם.', 'עוֹד חֵץ מֵהָאַרְנֶבֶת: הִיא מַאֲמִינָה בְּךָ.'],
  },
  'emotion-name': {
    intro: (n, i) => [
      [`${n}! הַצָּב מַרְגִּישׁ מַשֶּׁהוּ — מָה הוּא מַרְגִּישׁ?`, 'לְכָל רֶגֶשׁ יֵשׁ מָקוֹם. גַּם כָּאן.'],
      [`${n} — פָּנִים מְסַפְּרִים בְּלִי מִלִּים.`, 'מִסְתַּכְּלִים עַל הָעֵינַיִם... וְהַפֶּה.'],
      [`${n}! הַלֵּב מְדַבֵּר בִּצְבָעִים.`, 'אֵיךְ אַתָּה הָיִיתָ מַרְגִּישׁ?'],
      [`${n} — רְגָשׁוֹת בָּאִים וְהוֹלְכִים כְּמוֹ עָנָנִים.`, 'נִזְהֶה... וּמְזַהִים.'],
    ][i % 4],
    win: ['הַצָּב מַרְגִּישׁ שֶׁמְּבִינִים אוֹתוֹ. תּוֹדָה לְךָ!', 'זִהִיתָ! הַלֵּב נֶחְמָד כְּשֶׁקּוֹרְאִים אוֹתוֹ.'],
    encourage: ['תִּסְתַּכֵּל בַּפָּנִים. מָה הֵם אוֹמְרִים?', 'לֹא נוֹרָא — גַּם לְמָבוּגִים קָשֶׁה לְפַעֲמִים.'],
  },
  'paint-fill': {
    intro: (n, i) => [
      [`${n}! הַדְּבוֹרָה רוֹצָה לְצַיֵּר — וְאֵין לָהּ צְבָעִים.`, 'בְּחַר צֶבַע וּמַלֵּא עָלֶה.'],
      [`${n} — הַגַּן מְחַכֶּה לַצֶּבַע שֶׁלְּךָ.`, 'אֵין צֶבַע נָכוֹן. יֵשׁ צֶבַע שֶׁלְּךָ.'],
      [`${n}! פַּטִּיפּוֹן צָבוּעַ עוֹשֶׂה אֶת הַיּוֹם.`, 'מַלְאוּ, רִקְדוּ, צָבְעוּ!'],
      [`${n} — הַמַּכַּחֹשֶׁת שֶׁל לֶנִי מוּכָנָה.`, 'כָּל צֶבַע מְסַפֵּר סִפּוּר.'],
    ][i % 4],
    win: ['וָאו, מַה פֵּרַח! הַדְּבוֹרָה מְרַחֶפֶת מֵרֹב שִׂמְחָה!', 'הַגַּן נִצְבַּע בַּצִּבּוּעַ שֶׁלְּךָ!'],
    encourage: ['תְּנוּעָה מְעַנְיֶנֶת! תַּמְשִׁיךְ.', 'אֵין טָעוּת בַּצִּבּוּעַ — יֵשׁ גִּלּוּי.'],
  },
  'open-create': {
    intro: (n, i) => [
      [`${n}! בְּרוּכִים הַבָּאִים לַאֲחוּ הַיְּצִירָה.`, 'אֵין נָכוֹן וְלֹא נָכוֹן — יֵשׁ שֶׁלְּךָ.'],
      [`${n} — קַו, עִגּוּל, צֶבַע. מִמְךָּ וְהָלְאָה.`, 'תַּעֲשֶׂה מַה שֶּׁבָּא לְךָ!'],
      [`${n}! הַמַּטֶּה הַקָּסוּם הַזֶּה בְּיָדַיִם שֶׁלְּךָ.`, 'כָּל נְגִיעָה מְשַׁנָּה אֶת הָעוֹלָם.'],
      [`${n} — הַחֲלוֹמוֹת אוֹהֲבִים צִבּוּעַ.`, 'רַק תַּתְחִיל. הַשֶּׁאָר יָבוֹא.'],
    ][i % 4],
    win: ['וָאו — מַה שֶּׁיָּצַרְתָּ שֶׁלְּךָ לְגַמְרֵי!', 'יְצָרְתָּ עוֹלָם. הַגַּן גָּאֶה בְּךָ.'],
    encourage: ['תְּנוּעָה מְעַנְיֶנֶת!', 'כָּל קַו הוּא הַתְחָלָה.'],
  },
  'rhythm-tap': {
    intro: (n, i) => [
      [`${n}! הַתֹּף הַגָּדוֹל הִפְסִיק לְתַפֵּעַ.`, 'בּוֹא נַחֲזִיר לוֹ אֶת הַקֶּצֶב!'],
      [`${n} — הַקֶּצֶב בָּרַגְלַיִם וּבַכַּפּוֹת.`, 'טַפּ, טַפּ, טַפּ... עַכְשָׁו!'],
      [`${n}! הָאוֹרוֹת פּוֹעֲמִים — פּוֹעֵם אִתָּם.`, 'הַאֲזָנָה... וְאָז הַפְּעִימָה.'],
      [`${n} — לֵב הַגַּן דוֹפֵק. מַקְשִׁיבִים?`, 'לְאַט... חָזָק... לְאַט.'],
    ][i % 4],
    win: ['הַקֶּצֶב חָזַר! הַכִּכָּר רוֹקֵד!', 'הַתֹּף וְאַתָּה — לְהָקָה אַחַת!'],
    encourage: ['תִּשְׁמַע אֶת הַקֶּצֶב — הוּא עוֹזֵר לְךָ.', 'לֹא נוֹרָא. הַפְּעִימָה הַבָּאָה תִּפֹּל בַּמָּקוֹם.'],
  },
  'breath-guide': {
    intro: (n, i) => [
      [`${n}! הַבְּרֵכָה שְׁקֵטָה. נִנְשֹׁם אִתָּהּ.`, 'שָׁאִיפָה... וְעַכְשָׁו נְשִׁיפָה אֲרֻכָּה.'],
      [`${n} — פָּנָס קָטָן מְחַכֶּה לִנְשִׁימָה שֶׁלְּךָ.`, 'לְאַט מְאֹד. כְּמוֹ רוּחַ רַכָּה.'],
      [`${n}! הָאוֹר נוֹשֵׁם אִתְךָ.`, 'הַבִּטְנוֹ עוֹלֶה... הַבִּטְנוֹ יוֹרֵד...'],
      [`${n} — שֶׁקֶט בִּפְנִים מַתְחִיל בִּנְשִׁימָה.`, 'אַתָּה וְהָאוֹר. אֵין עוֹד כְּלוּם.'],
    ][i % 4],
    win: ['הַפָּנָסִים זוֹהֲרִים. הַשֶּׁקֶט נִשְׁאָר אִתְךָ.', 'נָשַׁמְתָּ יָפֶה. הַבְּרֵכָה תוֹדָה לְךָ.'],
    encourage: ['נְשִׁימָה רַכָּה, בְּלִי לְמַהֵר.', 'אֵין פֹּה נָכוֹן וְלֹא נָכוֹן. רַק לִנְשֹׁם.'],
  },
};

/* ---------- tier mechanic variants (claims-vs-reality round C) ----------
 *
 * The hostile audit's first question: "the description says 144 games,
 * how many actually play differently?" Until now a tier changed HOW
 * MUCH (counts/speed/rounds) but never HOW a game plays. These
 * variants change the MECHANIC itself at higher tiers:
 *
 *   memory-pairs  tier>=1  'wind'            — after every miss the wind
 *                                            swaps two face-down cards:
 *                                            re-encode positions, not just
 *                                            recall them
 *   letter-find   tier>=1  'first-sound'    — hear a WORD, pick the letter
 *                                            it starts with (phonemic
 *                                            awareness, pre-reading)
 *   match-shadow  tier>=2  'rotated-shapes' — shadows go neutral dark AND
 *                                            rotated: match by silhouette
 *                                            under rotation (color can no
 *                                            longer key the answer)
 *   sort-order    tier>=1  'descending'     — arrange big -> small: the
 *                                            planning direction inverts
 *   emotion-name  tier>=1  'situation'      — hear a situation vignette,
 *                                            infer the feeling (empathy /
 *                                            perspective taking), then the
 *                                            true face is revealed
 *
 * Tier 0 NEVER carries a variant: the seed specs and the e2e ground
 * stay byte-still. The other engines honestly stay 'classic' — the
 * README and docs say so. Deterministic and pure.
 */

export type SpecVariant =
  | 'wind'
  | 'first-sound'
  | 'rotated-shapes'
  | 'descending'
  | 'situation';

const VARIANTS: Partial<Record<GameKind, { name: SpecVariant; fromTier: number }>> = {
  'memory-pairs': { name: 'wind', fromTier: 1 },
  'letter-find': { name: 'first-sound', fromTier: 1 },
  'match-shadow': { name: 'rotated-shapes', fromTier: 2 },
  'sort-order': { name: 'descending', fromTier: 1 },
  'emotion-name': { name: 'situation', fromTier: 1 },
};

/** The mechanic variant a derived spec of this kind+tier plays, if any. */
export function variantFor(kind: GameKind, tier: number): SpecVariant | undefined {
  const v = VARIANTS[kind];
  return v && tier >= v.fromTier ? v.name : undefined;
}

/* ---------- derivation ---------- */

function kindForIndex(cat: GameCategory, i: number): GameKind {
  const kinds = KINDS_FOR_CATEGORY[cat];
  if (kinds.length === 1) return kinds[0];
  /* 16 names = 4 tiers × 4. Two-kind categories split WITHIN each tier:
     first 2 names of a tier -> kind A, last 2 -> kind B — so both
     templates exist at every difficulty (8+8 across the category). */
  const posInTier = i % 4;
  return posInTier < 2 ? kinds[0] : kinds[1];
}

function idFor(cat: GameCategory, kind: GameKind, i: number): string {
  return `${cat}-${kind}-${String(i).padStart(2, '0')}`;
}

/** Derive the full 144-spec catalog. Deterministic and pure. */
export function deriveSpecs(): { specs: GameSpec[]; names: Record<string, string> } {
  const specs: GameSpec[] = [];
  const names: Record<string, string> = {};
  for (const cat of CATEGORY_ORDER) {
    const catNames = GAMES.filter((g) => g.category === cat);
    for (let i = 0; i < catNames.length; i++) {
      const def = catNames[i];
      const kind = kindForIndex(cat, i);
      const tier = def.level; /* 0..3 straight from the seed layout */
      const recipe = NARRATIVES[kind];
      const variant = variantFor(kind, tier);
      const spec: GameSpec = {
        id: idFor(cat, kind, i),
        kind,
        zone: ZONE_FOR_CATEGORY[cat],
        category: cat,
        skills: SKILLS[kind](tier, i),
        narrative: {
          intro: recipe.intro(def.name, i),
          win: recipe.win[i % recipe.win.length],
          encourage: recipe.encourage[i % recipe.encourage.length],
        } satisfies GameNarrative,
        params: variant
          ? { ...PARAMS[kind](tier), extra: { variant } }
          : PARAMS[kind](tier),
        baseTier: tier,
        openEnded: kind === 'open-create' || kind === 'paint-fill',
      };
      specs.push(spec);
      names[spec.id] = def.name;
    }
  }
  return { specs, names };
}

/* ---------- the catalog (module constant, built once) ---------- */

const derived = deriveSpecs();

export const SPEC_CATALOG: readonly GameSpec[] = derived.specs;

/** spec id -> the child-facing Hebrew name (shelves, charts, HUD). */
export const NAME_BY_ID: Readonly<Record<string, string>> = derived.names;

/** Display name of a derived spec (undefined for seed specs). */
export function catalogName(id: string): string | undefined {
  return NAME_BY_ID[id];
}

/** Derived specs that live in a zone (the 144 only; no legacy specs). */
export function catalogForZone(zone: string): GameSpec[] {
  return SPEC_CATALOG.filter((s) => s.zone === zone);
}

/** Derived spec by id. */
export function catalogSpec(id: string): GameSpec | undefined {
  return SPEC_CATALOG.find((s) => s.id === id);
}

/** Sanity meta for debugging/telemetry: names -> kinds -> zones. */
export function catalogMeta(): { total: number; perCategory: Record<GameCategory, number> } {
  const perCategory = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, SPEC_CATALOG.filter((s) => s.category === c).length]),
  ) as Record<GameCategory, number>;
  return { total: SPEC_CATALOG.length, perCategory };
}
