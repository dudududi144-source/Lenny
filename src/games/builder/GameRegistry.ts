/* ============================================================
 * GameRegistry — the catalog of every game, as specs.
 *
 * Adding a new game to the garden is now a DATA change:
 * push a new GameSpec here. No new scene file required.
 *
 * The registry also answers discovery questions:
 *   - which games live in a zone?
 *   - which games train a given skill?
 *   - which open-ended creativity games exist?
 * ============================================================ */

import { GameSpec } from './GameSpec';

export const GAME_REGISTRY: GameSpec[] = [
  {
    id: 'memory-pairs-1',
    kind: 'memory-pairs',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.pairs', 'attention.focus'],
    narrative: {
      intro: ['הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ.', 'בּוֹא נַעֲזֹר לוֹ לִזְכֹּר!'],
      win: 'וָאו! הַפַּרְפַּר נִזְכַּר בְּכָל הַפְּרָחִים!',
      encourage: 'נַסֶּה שׁוּב, הַפַּרְפַּר מַאֲמִין בְּךָ.',
    },
    params: { itemCount: 4, rounds: 1 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'memory-pairs-2',
    kind: 'memory-pairs',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.pairs', 'memory.sequence'],
    narrative: {
      intro: ['עַכְשָׁיו קְצָת יוֹתֵר פְּרָחִים!', 'בּוֹא נִזְכֹּר אֶת כֻּלָּם.'],
      win: 'הַפַּרְפַּר שָׂמֵחַ, זָכַרְתָּ אֶת כֻּלָּם!',
      encourage: 'הַפְּרָחִים מְחַכִּים, נַסֶּה שׁוּב.',
    },
    params: { itemCount: 6, rounds: 1 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'find-fish-1',
    kind: 'find-target',
    zone: 'attention-stream',
    category: 'attention',
    skills: ['attention.visual', 'attention.selective'],
    narrative: {
      intro: ['הַדָּגִים שׂוֹחִים בַּנַּחַל.', 'מִי מֵהֶם זוֹהֵר?'],
      win: 'מָצָאתָ אֶת הַדָּג הַזּוֹהֵר!',
      encourage: 'תִּסְתַּכֵּל בְּרַכּוּת, הַזֹּהַר שָׁם.',
    },
    params: { itemCount: 5, speed: 1 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'find-fish-2',
    kind: 'find-target',
    zone: 'attention-stream',
    category: 'attention',
    skills: ['attention.visual', 'attention.sustained'],
    narrative: {
      intro: ['עַכְשָׁיו יֵשׁ יוֹתֵר דָּגִים בַּנַּחַל!', 'מִי מֵהֶם זוֹהֵר?'],
      win: 'מָצָאתָ אֶת כֻּלָּם! הַדָּגִים שְׂמֵחִים!',
      encourage: 'תִּסְתַּכֵּל בְּרַכּוּת, הַזֹּהַר שָׁם.',
    },
    params: { itemCount: 7, speed: 1 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'find-fish-3',
    kind: 'find-target',
    zone: 'attention-stream',
    category: 'attention',
    skills: ['attention.visual', 'attention.sustained', 'attention.selective'],
    narrative: {
      intro: ['הַנַּחַל מָלֵא דָּגִים הַיּוֹם!', 'מִי זוֹהֵר בַּתּוֹךְ כֻּלָּם?'],
      win: 'עֵינַיִם חַדּוֹת! מָצָאתָ אֶת כֻּלָּם!',
      encourage: 'תִּסְתַּכֵּל בְּרַכּוּת, הַזֹּהַר שָׁם.',
    },
    params: { itemCount: 8, speed: 1 },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'sort-acorns-1',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.ordering', 'logic.size'],
    narrative: {
      intro: ['הַסְּנַאי צָרִיךְ לְסַדֵּר אֶת הַבְּלוּטִים.', 'מֵהַקָּטָן לַגָּדוֹל!'],
      win: 'הַסְּנַאי סִדֵּר אֶת כָּל הַבְּלוּטִים!',
      encourage: 'אֵיזֶה בְּלוּט קָטָן יוֹתֵר?',
    },
    params: { itemCount: 4 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'sort-acorns-2',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.ordering', 'logic.size', 'motor.planning'],
    narrative: {
      intro: ['עַכְשָׁיו יֵשׁ יוֹתֵר בְּלוּטִים לְסַדֵּר!', 'גִּרְרוּ אוֹתָם מֵהַקָּטָן לַגָּדוֹל.'],
      win: 'הַסְּנַאי סִדֵּר אֶת כֻּלָּם! אַלּוּף!',
      encourage: 'אֵיזֶה בְּלוּט קָטָן יוֹתֵר?',
    },
    params: { itemCount: 5 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'match-kites-1',
    kind: 'match-shadow',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['spatial.matching', 'spatial.shape'],
    narrative: {
      intro: ['הָעִפְעוֹפִים הִתְבַּלְבְּלוּ בַּשָּׁמַיִם.', 'חַבֵּר כָּל עִפְעוֹף לַצֵּל שֶׁלּוֹ.'],
      win: 'כָּל הָעִפְעוֹפִים מָצְאוּ אֶת הַצֵּל שֶׁלָּהֶם!',
      encourage: 'תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הַצֵּל.',
    },
    params: { itemCount: 4 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'match-kites-2',
    kind: 'match-shadow',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['spatial.matching', 'spatial.memory'],
    narrative: {
      intro: ['עַכְשָׁיו יֵשׁ יוֹתֵר עִפְעוֹפִים בַּשָּׁמַיִם!', 'חַבְּרוּ כָּל אֶחָד לַצֵּל שֶׁלּוֹ.'],
      win: 'כָּל הָעִפְעוֹפִים מָצְאוּ אֶת הַצֵּל! מַדְהִים!',
      encourage: 'תִּסְתַּכְּלוּ בַּצֶּבַע שֶׁל הַצֵּל.',
    },
    params: { itemCount: 6 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'find-letter-1',
    kind: 'letter-find',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.letter-recognition'],
    narrative: {
      intro: ['הָאַרְנֶבֶת אִבְּדָה אֶת הָאוֹתִיּוֹת.', 'בּוֹא נִמְצָא אוֹתָן!'],
      win: 'הָאַרְנֶבֶת מָצְאָה אֶת כָּל הָאוֹתִיּוֹת!',
      encourage: 'תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הָאוֹת.',
    },
    params: { itemCount: 6, rounds: 5 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'find-letter-2',
    kind: 'letter-find',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.letter-recognition', 'language.scanning'],
    narrative: {
      intro: ['יֵשׁ עוֹד הַרְבֵּה אוֹתִיּוֹת לִמְצֹא!', 'בּוֹא נַמְשִׁיךְ!'],
      win: 'הָאַרְנֶבֶת מָצְאָה אֶת כֻּלָּן! אַלּוּף!',
      encourage: 'תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הָאוֹת.',
    },
    params: { itemCount: 6, rounds: 7 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'find-letter-3',
    kind: 'letter-find',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.letter-recognition', 'language.scanning'],
    narrative: {
      intro: ['הָאַרְנֶבֶת צְרִיכָה עוֹד עֲזָרָה!', 'בּוֹא נִמְצָא עוֹד אוֹתִיּוֹת!'],
      win: 'וָאו! עוֹד אוֹתִיּוֹת נִמְצְאוּ!',
      encourage: 'תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הָאוֹת.',
    },
    params: { itemCount: 6, rounds: 9 },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'find-letter-4',
    kind: 'letter-find',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.letter-recognition', 'language.fluency'],
    narrative: {
      intro: ['אַתָּה אַלּוּף הָאוֹתִיּוֹת!', 'בּוֹא נְסַיֵּם אֶת כָּל הָאוֹתִיּוֹת!'],
      win: 'הָאַרְנֶבֶת גָּדְלָה בִּזְכוּתְךָ! אַלּוּף אַלּוּפִים!',
      encourage: 'תִּסְתַּכֵּל בַּצּוּרָה שֶׁל הָאוֹת.',
    },
    params: { itemCount: 6, rounds: 11 },
    baseTier: 3,
    openEnded: false,
  },
  {
    id: 'emotion-turtle-1',
    kind: 'emotion-name',
    zone: 'feelings-garden',
    category: 'emotion',
    skills: ['emotion.recognition', 'emotion.vocabulary'],
    narrative: {
      intro: ['הַצָּב מַרְגִּישׁ מַשֶּׁהוּ.', 'מַה הוּא מַרְגִּישׁ?'],
      win: 'הַצָּב מַרְגִּישׁ הַרְבֵּה יוֹתֵר טוֹב!',
      encourage: 'תִּסְתַּכֵּל בַּפָּנִים שֶׁלּוֹ.',
    },
    params: { rounds: 5 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'emotion-turtle-2',
    kind: 'emotion-name',
    zone: 'feelings-garden',
    category: 'emotion',
    skills: ['emotion.recognition', 'emotion.empathy'],
    narrative: {
      intro: ['הַצָּב מַרְגִּישׁ הַרְבֵּה רְגָשׁוֹת הַיּוֹם.', 'בּוֹא נְזַהֶה אוֹתָם יַחַד!'],
      win: 'זִהִיתָ אֶת כָּל הָרְגָשׁוֹת! הַצָּב מַרְגִּישׁ שֶׁמְּבִינִים אוֹתוֹ.',
      encourage: 'תִּסְתַּכֵּל בַּפָּנִים שֶׁלּוֹ.',
    },
    params: { rounds: 7 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'emotion-turtle-3',
    kind: 'emotion-name',
    zone: 'feelings-garden',
    category: 'emotion',
    skills: ['emotion.recognition', 'emotion.vocabulary'],
    narrative: {
      intro: ['הַצָּב לָמַד הַרְבֵּה רְגָשׁוֹת!', 'בּוֹא נְזַהֶה עוֹד!'],
      win: 'הַצָּב מַרְגִּישׁ שֶׁמְּבִינִים אוֹתוֹ בֶּאֱמֶת!',
      encourage: 'תִּסְתַּכֵּל בַּפָּנִים שֶׁלּוֹ.',
    },
    params: { rounds: 9 },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'emotion-turtle-4',
    kind: 'emotion-name',
    zone: 'feelings-garden',
    category: 'emotion',
    skills: ['emotion.recognition', 'emotion.empathy'],
    narrative: {
      intro: ['אַתָּה אַלּוּף הָרְגָשׁוֹת!', 'בּוֹא נְסַיֵּם אֶת כָּל הָרְגָשׁוֹת!'],
      win: 'הַצָּב וְאַתָּה חֲבֵרִים טוֹבִים! אַלּוּף!',
      encourage: 'תִּסְתַּכֵּל בַּפָּנִים שֶׁלּוֹ.',
    },
    params: { rounds: 11 },
    baseTier: 3,
    openEnded: false,
  },
  {
    id: 'paint-flower-1',
    kind: 'paint-fill',
    zone: 'creativity-meadow',
    category: 'creativity',
    skills: ['creativity.color', 'creativity.choice'],
    narrative: {
      intro: ['הַדְּבוֹרָה רוֹצָה לְצַיֵּר פֶּרַח.', 'בְּחַר צְבָעִים וּמַלֵּא אֶת הֶעָלִים.'],
      win: 'הַפֶּרַח פָּרַח בִּזְכוּתְךָ!',
      encourage: 'אֵין צֶבַע נָכוֹן, בְּחַר מַה שֶּׁבָּא לְךָ.',
    },
    params: { itemCount: 5 },
    baseTier: 0,
    openEnded: true,
  },
  {
    id: 'drum-beat-1',
    kind: 'rhythm-tap',
    zone: 'rhythm-square',
    category: 'rhythm',
    skills: ['rhythm.timing', 'rhythm.pulse'],
    narrative: {
      intro: ['הַתֹּף הַגָּדוֹל הִפְסִיק לְתַפְתֵּף.', 'בּוֹא נַחֲזִיר לוֹ אֶת הַקֶּצֶב!'],
      win: 'הַתֹּף חָזַר לְתַפְתֵּף!',
      encourage: 'תִּשְׁמַע אֶת הַקֶּצֶב.',
    },
    params: { rounds: 8, speed: 78 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'drum-beat-2',
    kind: 'rhythm-tap',
    zone: 'rhythm-square',
    category: 'rhythm',
    skills: ['rhythm.timing', 'rhythm.sequence'],
    narrative: {
      intro: ['הַתֹּף רוֹצֶה עוֹד קֶצֶב!', 'בּוֹא נְתַפְתֵּף יַחַד לְקֶצֶב הָאָרֹךְ.'],
      win: 'וָאו! הַתֹּף מְתַפְתֵּף בְּקֶצֶב מֻשְׁלָם!',
      encourage: 'תִּשְׁמְעוּ אֶת הַקֶּצֶב.',
    },
    params: { rounds: 12, speed: 78 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'drum-beat-3',
    kind: 'rhythm-tap',
    zone: 'rhythm-square',
    category: 'rhythm',
    skills: ['rhythm.timing', 'rhythm.sequence'],
    narrative: {
      intro: ['הַתֹּף בְּקֶצֶב מָהִיר יוֹתֵר!', 'בּוֹא נַקְשִׁיב וּנְתַפְתֵּף!'],
      win: 'קֶצֶב מֻשְׁלָם! הַתֹּף רָקַד!',
      encourage: 'תִּשְׁמְעוּ אֶת הַקֶּצֶב.',
    },
    params: { rounds: 16, speed: 78 },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'drum-beat-4',
    kind: 'rhythm-tap',
    zone: 'rhythm-square',
    category: 'rhythm',
    skills: ['rhythm.timing', 'rhythm.mastery'],
    narrative: {
      intro: ['אַתָּה מְתַפְתֵּף אַלּוּף!', 'בּוֹא נְנַגֵּן אֶת הַקֶּצֶב הָאָרֹךְ!'],
      win: 'הַתֹּף וְאַתָּה - לְהָקָה אַחַת! אַלּוּף!',
      encourage: 'תִּשְׁמְעוּ אֶת הַקֶּצֶב.',
    },
    params: { rounds: 20, speed: 78 },
    baseTier: 3,
    openEnded: false,
  },
  {
    id: 'breath-lanterns-1',
    kind: 'breath-guide',
    zone: 'breath-pool',
    category: 'breath',
    skills: ['breath.regulation', 'emotion.calm'],
    narrative: {
      intro: ['בְּרֵכַת הַנְּשִׁימָה שְׁקֵטָה הַלַּיְלָה.', 'בּוֹא נַדְלִיק פָּנָסִים בִּנְשִׁימוֹת רַכּוֹת.'],
      win: 'הַפָּנָסִים מְאִירִים אֶת הַבְּרֵכָה.',
      encourage: 'נְשִׁימָה רַכָּה, בְּלִי לְהַקְשִׁיב.',
    },
    params: { itemCount: 3 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'breath-lanterns-2',
    kind: 'breath-guide',
    zone: 'breath-pool',
    category: 'breath',
    skills: ['breath.regulation', 'attention.focus'],
    narrative: {
      intro: ['הַלַּיְלָה יֵשׁ יוֹתֵר פָּנָסִים לְהַדְלִיק!', 'נִשְׁמוּ לְאַט וְגַעוּ בְּכָל אֶחָד.'],
      win: 'כָּל הַפָּנָסִים מְאִירִים! הַבְּרֵכָה זוֹהֶרֶת.',
      encourage: 'נְשִׁימָה רַכָּה, בְּלִי לְהַקְשִׁיב.',
    },
    params: { itemCount: 5 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'open-create-1',
    kind: 'open-create',
    zone: 'creativity-meadow',
    category: 'creativity',
    skills: ['creativity.divergent', 'creativity.expression'],
    narrative: {
      intro: ['בְּרוּכִים הַבָּאִים לַאֲחוּ הַיְּצִירָה!', 'בּוֹא נְצַיֵּר חָפְשִׁי, אֵין נָכוֹן וְלֹא נָכוֹן.'],
      win: 'וָאו, מַה שֶּׁיָּצַרְתָּ!',
      encourage: 'תְּנוּעָה מְעַנְיֶּנֶת!',
    },
    params: { itemCount: 7 },
    baseTier: 0,
    openEnded: true,
  },
];

/** All games in a garden zone. */
export function gamesInZone(zone: string): GameSpec[] {
  return GAME_REGISTRY.filter((g) => g.zone === zone);
}

/** All games that train a given skill. */
export function gamesForSkill(skill: string): GameSpec[] {
  return GAME_REGISTRY.filter((g) => g.skills.includes(skill));
}

/** All open-ended creativity games (no wrong answer). */
export function openEndedGames(): GameSpec[] {
  return GAME_REGISTRY.filter((g) => g.openEnded);
}

/** Find a spec by id. */
export function getSpec(id: string): GameSpec | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
