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
    id: 'sequence-echo-1',
    kind: 'sequence-echo',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.working', 'memory.sequence', 'attention.focus'],
    narrative: {
      intro: ['הַגּוּפִים הַזּוֹהֲרִים יָאִירוּ בְּסֵדֶר קָסוּם.', 'הִסְתַּכְּלוּ, אַחַר כָּךְ חַזְרוּ עַל הַסֵּדֶר!'],
      win: 'זָכַרְתָּ אֶת כָּל הַסְּדָרִים! הַגַּן זוֹרֵחַ בִּזְכוּתְךָ!',
      encourage: 'כִּמְעַט! בּוֹאוּ נִרְאֶה אֶת הַסֵּדֶר עוֹד פַּעַם.',
    },
    params: { rounds: 3 },
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
    id: 'find-fish-4',
    kind: 'find-target',
    zone: 'attention-stream',
    category: 'attention',
    skills: ['attention.visual', 'attention.sustained', 'attention.focus'],
    narrative: {
      intro: ['כָּל הַדָּגִים בַּנַּחַל!', 'מִי זוֹהֵר בַּתּוֹךְ כֻּלָּם?'],
      win: 'וָאו! עֵינַיִים חַדּוֹת! מָצָאתָ אֶת כֻּלָּם!',
      encourage: 'תִּסְתַּכֵּל בְּרַכּוּת, הַזֹּהַר שָׁם.',
    },
    params: { itemCount: 9, speed: 1 },
    baseTier: 3,
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
    id: 'drum-beat-5',
    kind: 'rhythm-tap',
    zone: 'rhythm-square',
    category: 'rhythm',
    skills: ['rhythm.timing', 'rhythm.mastery'],
    narrative: {
      intro: ['אַתָּה מְתַפְתֵּף מַדְהִים!', 'בּוֹא נְנַגֵּן אֶת הַקֶּצֶב הַגָּדוֹל!'],
      win: 'הַתֹּף וְאַתָּה - לְהָקָה מֻשְׁלֶמֶת!',
      encourage: 'תִּשְׁמְעוּ אֶת הַקֶּצֶב.',
    },
    params: { rounds: 24, speed: 78 },
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

  /* ============================================================
   * stage 15-C — the content flood: five new unique scenes, three
   * tiers each (baseTier = the clearing band the game waits in).
   * Each pins its scene via params.extra.scene (the legacy pattern):
   *   rainbow-order / leaf-size / star-connect  -> seriation, logic
   *   shape-shadow                              -> matching, spatial
   *   wind-chime                                -> auditory echo, memory
   * ============================================================ */
  {
    id: 'rainbow-bridge-1',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.ordering', 'logic.patterns'],
    narrative: {
      intro: ['אַבְנֵי הַקֶּשֶׁת הִתְעָרְבּוּ.', 'גַּעוּ בָּהֶן לְפִי סֵדֶר הַקֶּשֶׁת!'],
      win: 'הַקֶּשֶׁת שָׁלֵם! הַגֶּשֶׁר זוֹהֵר!',
      encourage: 'אֵיזֶה צֶבַע בָּא אַחֲרֵי הָאָדוֹם?',
    },
    params: { rounds: 3, extra: { scene: 'rainbow-order' } },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'rainbow-bridge-2',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.ordering', 'logic.patterns'],
    narrative: {
      intro: ['עוֹד אֲבָנִים מְחַכּוֹת — עַכְשָׁיו חֲמִשָּׁה צְבָעִים.', 'אָדוֹם, כָּתוֹם, צָהוֹב... מַה בָּא?'],
      win: 'גֶּשֶׁר גָּדוֹל יוֹתֵר! אַלּוּף הַקֶּשֶׁת!',
      encourage: 'אֵיזֶה צֶבַע בָּא אַחֲרֵי הָאָדוֹם?',
    },
    params: { rounds: 4, extra: { scene: 'rainbow-order' } },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'rainbow-bridge-3',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.ordering', 'logic.patterns'],
    narrative: {
      intro: ['כָּל שֵׁשֶׁת צְבָעֵי הַקֶּשֶׁת!', 'מֵהָאָדוֹם עַד הַסָּגוֹל — בְּלִי לִפְסְפֵג.'],
      win: 'הַקֶּשֶׁת הַמְלֵאָה שֶׁלְּךָ! מַדְהִים!',
      encourage: 'אֵיזֶה צֶבַע בָּא אַחֲרֵי הָאָדוֹם?',
    },
    params: { rounds: 5, extra: { scene: 'rainbow-order' } },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'leaf-nests-1',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.size', 'logic.ordering'],
    narrative: {
      intro: ['הֶעָלִים נוֹפְלִים — וּלְכָל אֶחָד יֵשׁ קֶן.', 'קָטָן, בֵּינוֹנִי אוֹ גָּדוֹל?'],
      win: 'כָּל הֶעָלִים מָצְאוּ קֵן! הַסְּנַאי שָׂמֵחַ!',
      encourage: 'הַסְתַּכְּלוּ בַּגֹּדֶל שֶׁל הֶעָלֶה.',
    },
    params: { rounds: 2, extra: { scene: 'leaf-size' } },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'leaf-nests-2',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.size', 'logic.ordering'],
    narrative: {
      intro: ['עוֹד עָלִים נוֹפְלִים, וְהֵם דּוֹמִים זֶה לָזֶה.', 'עֵינַיִם טוֹבוֹת מְבִינוֹת מַה גָּדוֹל.'],
      win: 'הַקְּנִים מָלֵאִים! אַלּוּף הַגִּדּוּלִים!',
      encourage: 'הַסְתַּכְּלוּ בַּגֹּדֶל שֶׁל הֶעָלֶה.',
    },
    params: { rounds: 3, extra: { scene: 'leaf-size' } },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'leaf-nests-3',
    kind: 'sort-order',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.size', 'logic.ordering'],
    narrative: {
      intro: ['הַסְּנַאי סוֹמֵךְ עֲלֵיכֶם!', 'עָלִים קְרוֹבִים בַּגֹּדֶל — מִי יַבְחִין?'],
      win: 'כָּל הַסְּתָיו בַּקְּנִים! הַסְּנַאי יָשֵׁן בְּשָׁלוֹם!',
      encourage: 'הַסְתַּכְּלוּ בַּגֹּדֶל שֶׁל הֶעָלֶה.',
    },
    params: { rounds: 3, extra: { scene: 'leaf-size' } },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'true-shadows-1',
    kind: 'match-shadow',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['spatial.matching', 'spatial.shape'],
    narrative: {
      intro: ['הַפָּנָס מְצַיֵּר צוּרָה עַל הַקִּיר.', 'אֵיזֶה צֵל הוּא הַצֵּל הָאֲמִתִּי שֶׁלָּהּ?'],
      win: 'מָצָאתָ אֶת כָּל הַצְּלָלִים הָאֲמִתִּיִּים!',
      encourage: 'תִּסְתַּכְּלוּ לְאַט — לַקְּצֵווֹת וְלַזִּוִּיִּת.',
    },
    params: { rounds: 5, extra: { scene: 'shape-shadow' } },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'true-shadows-2',
    kind: 'match-shadow',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['spatial.matching', 'spatial.shape'],
    narrative: {
      intro: ['אַרְבָּעָה צְלָלִים מְחַכִּים!', 'רַק אֶחָד שׁוֹמֵר עַל כָּל הַקְּצֵווֹת.'],
      win: 'הַקִּיר מְלֵא אוֹר! עֵינַיִם חַדּוֹת!',
      encourage: 'תִּסְתַּכְּלוּ לְאַט — לַקְּצֵווֹת וְלַזִּוִּיִּת.',
    },
    params: { rounds: 6, extra: { scene: 'shape-shadow' } },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'true-shadows-3',
    kind: 'match-shadow',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['spatial.matching', 'spatial.memory'],
    narrative: {
      intro: ['הַצְּלָלִים הַלַּיְלָה עֲרוּמִים.', 'סְפֹר כַּמָּה קְצֵווֹת יֵשׁ לְכָל צוּרָה.'],
      win: 'אַלּוּף הַצְּלָלִים! הַפָּנָס מְרִיעָה לְךָ!',
      encourage: 'תִּסְתַּכְּלוּ לְאַט — לַקְּצֵווֹת וְלַזִּוִּיִּת.',
    },
    params: { rounds: 7, extra: { scene: 'shape-shadow' } },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'star-threads-1',
    kind: 'sort-order',
    zone: 'memory-hill',
    category: 'logic',
    skills: ['logic.ordering', 'attention.focus'],
    narrative: {
      intro: ['הַכּוֹכָבִים מְמַתְנִים בִּמְסִפָּר.', 'גַּעוּ בָּהֶן בַּסֵּדֶר — 1, 2, 3!'],
      win: 'קְבוּצַת כּוֹכָבִים שְׁלֵמָה! הַשָּׁמַיִם מִתְפַּעֲלִים!',
      encourage: 'מַתְנִים לְמִסְפַּר הַבָּא.',
    },
    params: { rounds: 3, extra: { scene: 'star-connect' } },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'star-threads-2',
    kind: 'sort-order',
    zone: 'memory-hill',
    category: 'logic',
    skills: ['logic.ordering', 'attention.focus'],
    narrative: {
      intro: ['עוֹד כּוֹכָבִים נִדְלָקִים הַלַּיְלָה.', '1 עַד 6 — וְהַחוּט הַזָּהָב יִקְשֹׁר!'],
      win: 'קְבוּצָה גְּדוֹלָה יוֹתֵר! וָאו!',
      encourage: 'מַתְנִים לְמִסְפַּר הַבָּא.',
    },
    params: { rounds: 4, extra: { scene: 'star-connect' } },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'star-threads-3',
    kind: 'sort-order',
    zone: 'memory-hill',
    category: 'logic',
    skills: ['logic.ordering', 'attention.focus'],
    narrative: {
      intro: ['עֶשֶׂרָה כּוֹכָבִים מְמַתְנִים לָכֶם.', 'מֵאַחַד עַד עֶשֶׂר — קִשּׁוּר חָכָם!'],
      win: 'הַקְּבוּצָה הַגְּדוֹלָה בַּשָּׁמַיִם! אַלּוּף!',
      encourage: 'מַתְנִים לְמִסְפַּר הַבָּא.',
    },
    params: { rounds: 5, extra: { scene: 'star-connect' } },
    baseTier: 2,
    openEnded: false,
  },
  {
    id: 'wind-melody-1',
    kind: 'sequence-echo',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.working', 'memory.sequence'],
    narrative: {
      intro: ['הָרוּחַ מְנַגֶּנֶת בַּפַּעֲמוֹנִים.', 'הַקְשִׁיבוּ... וְהַחֲזִירוּ אֶת הַמֶּלוֹדְיָה!'],
      win: 'הָרוּחַ מְרִיעָה! הַמֶּלוֹדִיָּה שֶׁלְּךָ!',
      encourage: 'כִּמְעַט! הָרוּחַ תְּנַגֵּן לְאַט יוֹתֵר.',
    },
    params: { rounds: 3, extra: { scene: 'wind-chime' } },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'wind-melody-2',
    kind: 'sequence-echo',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.working', 'memory.sequence'],
    narrative: {
      intro: ['עַכְשָׁו הַמֶּלוֹדִיּוֹת אֲרֻכּוֹת.', 'הָאֹזֶן יוֹדַעַת — רַק לְהַקְשִׁיב.'],
      win: 'נְגִינַת הָרוּחַ! הַגִּבְעָה שָׁרָה!',
      encourage: 'כִּמְעַט! הָרוּחַ תְּנַגֵּן לְאַט יוֹתֵר.',
    },
    params: { rounds: 4, extra: { scene: 'wind-chime' } },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'wind-melody-3',
    kind: 'sequence-echo',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.working', 'memory.sequence'],
    narrative: {
      intro: ['הַלַּיְלָה הָרוּחַ שָׂרָה שִׁירִים אֲרֻכִּים.', 'שֵׁשׁ פַּעֲמוֹנִים מְנַגְּנִים יַחַד.'],
      win: 'הַקוֹנְצֶרְט שֶׁל הָרוּחַ! מַדְהִים!',
      encourage: 'כִּמְעַט! הָרוּחַ תְּנַגֵּן לְאַט יוֹתֵר.',
    },
    params: { rounds: 5, extra: { scene: 'wind-chime' } },
    baseTier: 2,
    openEnded: false,
  },

  /* ============================================================
   * stage 16-b — the games flood: FOUR NEW KINDS + band fillers.
   *
   * Each new kind owns its own scene (KIND_TO_SCENE routes it — no
   * scene pin needed), a pure logic module under games/logic/, a DDA
   * knob map read through dda.tier(), and its own e2e contract.
   * Instances land one per StationBand (tier 0 → band 0, tier 1 →
   * band 1, tier 2 → band 2) so every rung of the unlock chain meets
   * the new worlds. The three extra seed instances at the bottom give
   * the thinner bands more variety without touching the derived 144.
   * NOTE: everything here APPENDS — the seed-spine order every existing
   * save/e2e default-progression pin relies on never moves.
   * ============================================================ */

  /* ---------- memory-hill band fillers ---------- */
  {
    id: 'sequence-echo-2',
    kind: 'sequence-echo',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.working', 'memory.sequence'],
    narrative: {
      intro: ['הָאוֹרוֹת הַקְּטַנִּים מְנַגְּנִים סֵדֶר קָצָר.', 'הִסְתַּכְּלוּ... וְהַחֲזִירוּ!'],
      win: 'הַסֵּדֶר הַרִאשׁוֹן שֶׁלְּכֶם! צְעָדִים רִאשׁוֹנִים שֶׁל זִכָּרוֹן!',
      encourage: 'כִּמְעַט! בּוֹא נִרְאֶה אֶת הַסֵּדֶר עוֹד פַּעַם.',
    },
    params: { rounds: 2 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'memory-pairs-3',
    kind: 'memory-pairs',
    zone: 'memory-hill',
    category: 'memory',
    skills: ['memory.pairs', 'memory.sequence', 'attention.selective'],
    narrative: {
      intro: ['הַלַּיְלָה הַפְּרָחִים רַבִּים!', 'אַרְבָּעָה זוּגוֹת מְחַכִּים לְזִכָּרוֹן חָזָק.'],
      win: 'אַרְבָּעָה זוּגוֹת! הַזִּכָּרוֹן שֶׁלְּךָ מִתְחַזֵּק!',
      encourage: 'הַפְּרָחִים מְחַכִּים, נַסֶּה שׁוּב.',
    },
    params: { itemCount: 8, rounds: 1 },
    baseTier: 2,
    openEnded: false,
  },

  /* ---------- count-tap — logic / thinking-forest: tap-to-count ---------- */
  {
    id: 'count-acorns-1',
    kind: 'count-tap',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.counting', 'attention.focus'],
    narrative: {
      intro: ['הַסְּנַאי פִּזֵר בְּלוּטִים עַל הַדֶּשֶׁא.', 'גְּעוּ בְּכָל בְּלוּט — אַחַת, שְׁתַּיִם, שָׁלוֹשׁ!'],
      win: 'סְפִירָה מֻשְׁלֶמֶת! הַסְּנַאי שָׂמֵחַ!',
      encourage: 'עוֹד בְּלוּט מְחַכֶּה — גְּעוּ בּוֹ.',
    },
    params: { rounds: 3 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'count-acorns-2',
    kind: 'count-tap',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.counting', 'logic.cardinality', 'attention.focus'],
    narrative: {
      intro: ['הַיּוֹם נוֹפְלִים יוֹתֵר בְּלוּטִים!', 'סִפְרוּ בְּקוֹל רָם — כָּל מַגָּע בְּמִסְפָּר.'],
      win: 'הַסְּל הַמָּלֵא! אַלּוּפַת הַסְּפִירָה!',
      encourage: 'עוֹד בְּלוּט מְחַכֶּה — גְּעוּ בּוֹ.',
    },
    params: { rounds: 4 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'count-acorns-3',
    kind: 'count-tap',
    zone: 'thinking-forest',
    category: 'logic',
    skills: ['logic.counting', 'logic.cardinality', 'attention.sustained'],
    narrative: {
      intro: ['סוּפַת בְּלוּטִים בַּיַּעַר!', 'עֵינַיִם טוֹבוֹת, אֶצְבַּע סַבְלָן — לִסְפֹּר הַכֹּל.'],
      win: 'כָּל הַיַּעַר נִסְפַּר! וָאוֹ!',
      encourage: 'עוֹד בְּלוּט מְחַכֶּה — גְּעוּ בּוֹ.',
    },
    params: { rounds: 5 },
    baseTier: 2,
    openEnded: false,
  },

  /* ---------- trace-path — spatial / space-sky: constellation tracing ---------- */
  {
    id: 'trace-stars-1',
    kind: 'trace-path',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['motor.tracing', 'motor.planning'],
    narrative: {
      intro: ['שְׁבִיל נְקוּדוֹת קוֹשֵׁר בֵּין הַכּוֹכָבִים.', 'הִתְחִילוּ בַּכּוֹכָב הָאוֹרֵר וּגְרֹרוּ בְּעִקְבוֹת הַנְּקוּדוֹת!'],
      win: 'הַקְּבוּצָה נִסְגְּרָה! כּוֹכָב שָׁלִיחַ עוֹבֵר בַּשָּׁמַיִם!',
      encourage: 'הַנְּקוּדָה הַבָּאָה מְחַכָּה — גְּרֹרוּ אֲלֵיהָ.',
    },
    params: { rounds: 2 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'trace-stars-2',
    kind: 'trace-path',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['motor.tracing', 'motor.planning', 'spatial.shape'],
    narrative: {
      intro: ['הַלַּיְלָה הַשְּׁבִיל אֲרֹךְ יוֹתֵר.', 'אֶצְבַּע יָצִיב, עֵינַיִם עַל הַנְּקוּדָה.'],
      win: 'שְׁבִיל אָרֹךְ שֶׁלְּךָ! הַשָּׁמַיִם מִתְפַּעֲלִים!',
      encourage: 'הַנְּקוּדָה הַבָּאָה מְחַכָּה — גְּרֹרוּ אֲלֵיהָ.',
    },
    params: { rounds: 3 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'trace-stars-3',
    kind: 'trace-path',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['motor.tracing', 'motor.planning', 'spatial.shape'],
    narrative: {
      intro: ['הַקְּבוּצָה הַגְּדוֹלָה מְחַכָּה.', 'שֵׁשׁ כּוֹכָבִים, חוּט אֶחָד שֶׁל אוֹר — שֶׁלְּךָ.'],
      win: 'הַקְּבוּצָה הַגְּדוֹלָה בַּשָּׁמַיִם! אַלּוּף הַשְּׁבִילִים!',
      encourage: 'הַנְּקוּדָה הַבָּאָה מְחַכָּה — גְּרֹרוּ אֲלֵיהָ.',
    },
    params: { rounds: 3 },
    baseTier: 2,
    openEnded: false,
  },

  /* ---------- spatial band-2 filler ---------- */
  {
    id: 'match-kites-3',
    kind: 'match-shadow',
    zone: 'space-sky',
    category: 'spatial',
    skills: ['spatial.matching', 'spatial.memory', 'spatial.rotation'],
    narrative: {
      intro: ['שְׁמוֹנָה עִפְעוֹפִים בַּשָּׁמַיִם!', 'עֵינַיִם טוֹבוֹת מְבִינוֹת צוּרוֹת.'],
      win: 'שְׁמוֹנָה צְלָלִים מֻתְאָמִים! שִׁיא שֶׁל מֶמֶשׁ!',
      encourage: 'תִּסְתַּכְּלוּ בַּצּוּרָה שֶׁל הַצֵּל.',
    },
    params: { itemCount: 8 },
    baseTier: 2,
    openEnded: false,
  },

  /* ---------- sound-hunt — attention / the drum-square pond: find by ear+eye ----------
     The specs carry a scene pin (their own scene) so the SpecValidator
     exempts the rhythm-square placement from the attention→attention-stream
     coherence rule — the light-path-play-1 pattern, extended to a new kind. */
  {
    id: 'find-frog-1',
    kind: 'sound-hunt',
    zone: 'rhythm-square',
    category: 'attention',
    skills: ['attention.auditory', 'attention.selective'],
    narrative: {
      intro: ['בַּבְּרֵכָה שֶׁלִּי הַקֶּצֶב קוֹרֵא!', 'הַקְשִׁיבוּ... וּגְעוּ בָּעָלֶה שֶׁמְּבַעְבַּעַ!'],
      win: 'מָצָאתֶם אֶת הַצָּפְרְדֵּעַ בְּכָל הַסִּבּוּבִים!',
      encourage: 'הַקְשִׁיבוּ שׁוּב — הַבּוּעוֹת יָדִיעוּ.',
    },
    params: { rounds: 4, extra: { scene: 'sound-hunt' } },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'find-frog-2',
    kind: 'sound-hunt',
    zone: 'rhythm-square',
    category: 'attention',
    skills: ['attention.auditory', 'attention.selective', 'attention.sustained'],
    narrative: {
      intro: ['הַצָּפְרְדֵּעַ מִתְחַבֵּא יוֹתֵר טוֹב הַיּוֹם.', 'הַבּוּעָה נֶחְמָדָה — עֵינַיִם מְהִירוֹת!'],
      win: 'עֵינַיִם וְאָזְנַיִם — צְמָד מֻשְׁלָם!',
      encourage: 'הַקְשִׁיבוּ שׁוּב — הַבּוּעוֹת יָדִיעוּ.',
    },
    params: { rounds: 5, extra: { scene: 'sound-hunt' } },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'find-frog-3',
    kind: 'sound-hunt',
    zone: 'rhythm-square',
    category: 'attention',
    skills: ['attention.auditory', 'attention.selective', 'attention.sustained'],
    narrative: {
      intro: ['שֵׁשׁ עֲלֶה-עָלִים, צָפְרְדֵּעַ אַחַת.', 'רַק הָאָזֶן וְהָעִנְיָן יִמְצְאוּ אוֹתָהּ.'],
      win: 'הַצָּפָרְדֵּעַ בְּטַח מִתְגַּאֶה בָּכֶם!',
      encourage: 'הַקְשִׁיבוּ שׁוּב — הַבּוּעוֹת יָדִיעוּ.',
    },
    params: { rounds: 6, extra: { scene: 'sound-hunt' } },
    baseTier: 2,
    openEnded: false,
  },

  /* ---------- rhyme-pick — language / words-valley: rhyme families ---------- */
  {
    id: 'rhyme-pick-1',
    kind: 'rhyme-pick',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.rhyme', 'memory.working'],
    narrative: {
      intro: ['הַיַּנְשׁוּף שָׁר מִלָּה קְטַנָּה.', 'שְׁתֵּי מִלִּים עוֹנוֹת — מִי מִתְחָרֵז אִתָּהּ?'],
      win: 'הָאָזֶן הָרִאשׁוֹנָה שֶׁלְּךָ! מִלִּים מִתְחָרֵזוֹת!',
      encourage: 'הַקְשִׁיבוּ שׁוּב — הַמִּלָּה תָּשִׁיר לְבַד.',
    },
    params: { rounds: 4 },
    baseTier: 0,
    openEnded: false,
  },
  {
    id: 'rhyme-pick-2',
    kind: 'rhyme-pick',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.rhyme', 'memory.working', 'language.phonemes'],
    narrative: {
      intro: ['עַכְשָׁו שָׁלֹשׁ מִלִּים עוֹנוֹת.', 'רַק אַחַת חוֹרֵפֶת — הָאָזֶן יוֹדַעַת.'],
      win: 'כָּל הַחֲרִיזוֹת שֶׁלְּךָ! הָעֵמֶק שָׂרִיק!',
      encourage: 'הַקְשִׁיבוּ שׁוּב — הַמִּלָּה תָּשִׁיר לְבַד.',
    },
    params: { rounds: 5 },
    baseTier: 1,
    openEnded: false,
  },
  {
    id: 'rhyme-pick-3',
    kind: 'rhyme-pick',
    zone: 'words-valley',
    category: 'language',
    skills: ['language.rhyme', 'memory.working', 'language.phonemes'],
    narrative: {
      intro: ['הַיַּנְשׁוּף מְנַגֵּן מִלִּים.', 'מִלָּה אַחַת, שְׁלֹשׁ מִלִּים — וְהַחֲרִיזָה מֻשְׁלָמֶת.'],
      win: 'אַלּוּף הַחֲרִיזָה! הַמִּלִּים מִתְאַהֲבוֹת!',
      encourage: 'הַקְשִׁיבוּ שׁוּב — הַמִּלָּה תָּשִׁיר לְבַד.',
    },
    params: { rounds: 6 },
    baseTier: 2,
    openEnded: false,
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
