/* ============================================================
 * STATUS: CONTENT RESERVE — the 144 game NAMES are an asset for
 * future GameSpecs. The ACTIVE catalog is GameRegistry
 * (src/games/builder/GameRegistry.ts): new games are added there
 * as GameSpecs, NOT here.
 *
 * Wiring map (verified):
 *   - GameCategory (type)     -> consumed by data/garden.ts + GameSpec
 *   - CATEGORIES/CATEGORY_ORDER -> consumed by portal/MandalaSystem
 *     (portal subsystem, currently not booted by entry.ts)
 *   - GAMES / getGame / gamesByCategory / LEVELS -> NO consumers
 *     (verified by grep); kept deliberately as the name reserve.
 * Do NOT add new games here; add GameSpecs to GameRegistry instead.
 *
 * 144 Cognitive Games — The Seed
 * 9 categories x 16 games (4 levels x 4 games per level).
 * Names in clean, standard Hebrew with full niqqud, RTL-safe,
 * written for Israeli children ages 4-7.
 * ============================================================ */

export type GameCategory =
  | 'memory'
  | 'attention'
  | 'logic'
  | 'spatial'
  | 'language'
  | 'emotion'
  | 'creativity'
  | 'rhythm'
  | 'breath';

export interface CategoryMeta {
  label: string;      /* Hebrew label with niqqud */
  color: number;      /* semantic color */
  freq: number;       /* target brainwave frequency (Hz) */
  icon: string;       /* placeholder glyph */
}

export const CATEGORIES: Record<GameCategory, CategoryMeta> = {
  memory:     { label: 'זִכָּרוֹן',   color: 0x7c4dff, freq: 4.0, icon: '◆' },
  attention:  { label: 'קֶשֶׁב',     color: 0x4dc9ff, freq: 6.0, icon: '●' },
  logic:      { label: 'חֲשִׁיבָה',   color: 0xffd76a, freq: 8.0, icon: '▲' },
  spatial:    { label: 'מֶרְחָב',    color: 0x7dffb8, freq: 5.0, icon: '■' },
  language:   { label: 'שָׂפָה',     color: 0xf2549a, freq: 7.0, icon: '✶' },
  emotion:    { label: 'רֶגֶשׁ',     color: 0xff8bd4, freq: 4.5, icon: '♥' },
  creativity: { label: 'יְצִירָה',   color: 0xffa552, freq: 6.5, icon: '✷' },
  rhythm:     { label: 'קֶצֶב',     color: 0x52e0c4, freq: 8.0, icon: '♪' },
  breath:     { label: 'נְשִׁימָה',  color: 0xb39ddb, freq: 4.0, icon: '≈' },
};

export const CATEGORY_ORDER: GameCategory[] = [
  'memory', 'attention', 'logic', 'spatial', 'language',
  'emotion', 'creativity', 'rhythm', 'breath',
];

/* Level names: seed -> sprout -> tree -> blossom */
export const LEVELS = ['זֶרַע', 'נֶבֶט', 'עֵץ', 'פְּרִיחָה'];

export interface GameDef {
  id: number;                 /* 0..143 */
  name: string;               /* Hebrew name with niqqud */
  icon: string;               /* placeholder glyph */
  category: GameCategory;
  level: number;              /* 0..3 */
  unlocked: boolean;
  scene?: string;             /* Phaser scene key when implemented */
}

/* ---- Names per category: 4 levels x 4 games = 16 ---- */
const NAMES: Record<GameCategory, string[]> = {
  memory: ['זוּגוֹת','מַה חָסֵר?','הַתְּמוּנָה הַנֶּחְבֵּאת','סֵדֶר שֶׁל שְׁלוֹשָׁה','הַקּוֹל הַחוֹזֵר','כַּרְטִיסֵי הַזִּכָּרוֹן','מַה נִּשְׁתַּנָּה?','הַבּוּבָּה נֶחְבְּאָה','זִכְרִי אֶת הַדֶּרֶךְ','תֵּיבַת הַפְתָּעָה','הַצֵּל וְהַתְּמוּנָה','סִפּוּר חוֹזֵר','אֹסֶף הַמַּטְבְּעוֹת','הַחֶדֶר הַסּוֹדִי','מַפַּת הַכּוֹכָבִים','אֹצַר הַזִּכְרוֹנוֹת'],
  attention: ['נְקֻדַּת הָאוֹר','הָעַיִן הַשְּׁקֵטָה','צַיָּד הַכּוֹכָבִים','הַבַּלָּשׁ הַקָּטָן','מְצָא אֶת הַהֶבְדֵּל','הַשּׁוֹמֵר הַצָּעִיר','עֲקֹב אַחֲרַי','הַמַּקְשִׁיב','לַפִּיד הַקֶּשֶׁב','שְׁבִיל הַזָּהָב','הָאוֹר הַנָּכוֹן','מִקּוּד הַכּוֹכָב','הַצִּפּוֹר הַנְּדִירָה','הַשֶּׁקֶט שֶׁבִּפְנִים','עֵין הַנֶּשֶׁר','הַקֶּשֶׁב הֶעָמֹק'],
  logic: ['הַמָּבוֹךְ הַקָּסוּם','גֶּשֶׁר הַתְּבוּנוֹת','סוֹד הַמִּסְפָּרִים','חִידַּת הַכּוֹכָבִים','הַמַּדְרֵגוֹת','הַתַּבְנִית הַנִּסְתֶּרֶת','שַׁרְשֶׁרֶת הַקֶּסֶם','הַחִידוֹן הַקָּסוּם','מִגְדַּל הַקֻּבִּיּוֹת','הַדֶּרֶךְ הַבַּיְתָה','סֵדֶר הַדְּבָרִים','הַתַּעֲלוּמָה','הַמְּכוֹנָה הַקְּסוּמָה','אִם וְאָז','חֲשִׁיבָה קָדִימָה','אַדְרִיכַל הַחֲלוֹם'],
  spatial: ['הַמַּפָּה הַקְּסוּמָה','סִבּוּב הַכּוֹכָבִים','הַבְּנִיָּה הַגְּדוֹלָה','מַסָּע אֶל הַיָּרֵחַ','צוּרוֹת רוֹקְדוֹת','הָעוֹלָם הָהָפוּךְ','חֶדֶר הַמַּרְאוֹת','הַטַּנְגְרָם הַקָּסוּם','הַדֶּרֶךְ לַמַּעְלָה','צְלָלִים וּתְמוּנוֹת','הַבַּיִת שֶׁלִּי','מַסָּע בַּמֶּרְחָב','הַפָּאזֶל הַגָּדוֹל','כּוֹכָבִים מִסְתּוֹבְבִים','עֹמֶק וָרֹחַב','הָאַדְרִיכָלִית'],
  language: ['אוֹתִיּוֹת מִכּוֹכָבִים','הַסִּפּוּר הַקָּסוּם','מִלִּים טוֹבוֹת','הַשִּׁיר שֶׁל לֶנִי','הָאוֹת הָרִאשׁוֹנָה','חֲרוּזִים קְסוּמִים','אֹצַר הַמִּלִּים','הַסִּפּוּר שֶׁלִּי','דִּבּוּר הַכּוֹכָבִים','מִכְתָּב לַחֲבֵרָה','הַצְּלִיל הָרִאשׁוֹן','מִלִּים מִתְחַבְּרוֹת','שְׂפַת הַלֵּב','הֲבָרָה וְעוֹד הֲבָרָה','שִׁירִים קְטַנִּים','הַמְסַפֶּרֶת'],
  emotion: ['פַּרְצוּפִים שֶׁל חֲבֵרִים','אֵיךְ אַתְּ מַרְגִּישָׁה?','לֵב הַזָּהָב','חִבּוּק שֶׁל אוֹר','הַגֶּשֶׁם וְהַשֶּׁמֶשׁ','רְגָשׁוֹת צְבעוֹנִיִּים','הַמַּרְאָה שֶׁל הַלֵּב','שִׂמְחָה וָעֶצֶב','הַחָבֵר הַקָּטָן','אַהֲבָה קְסוּמָה','הַלֵּב הַפָּתוּחַ','רֶגֶשׁ וּתְנוּעָה','מִלִּים חַמּוֹת','הַכּוֹכָב הָעָצוּב','בְּיַחַד וּלְחוּד','חֶמְלָה קְסוּמָה'],
  creativity: ['הַצִּיּוּר הַקָּסוּם','מַמְצִיאִים קְטַנִּים','עוֹלָם חָדָשׁ','הַצְּבָעִים שֶׁלִּי','בּוֹנִים חֲלוֹם','הַמַּנְגִּינָה שֶׁלִּי','אֳמָנוּת הַכּוֹכָבִים','דִּמְיוֹן פָּרָאִי','יוֹצְרִים עוֹלָם','סִפּוּר שֶׁלֹּא נִגְמָר','צִיּוּר בְּלִי גְּבוּלוֹת','הַמְצָאוֹת קְטַנּוֹת','תֵּאַטְרוֹן הַצְּלָלִים','קוֹלָאז׳ קָסוּם','רַעְיוֹנוֹת פּוֹרְחִים','הָאֻמָּנִית הַצְּעִירָה'],
  rhythm: ['תּוֹפֵי הַכּוֹכָבִים','רִקּוּד הַגֶּשֶׁם','הַמִּקְצָב הַקָּסוּם','צָעָד וְעוֹד צָעָד','מוּזִיקַת הַלֵּב','הַתֹּף הַקָּטָן','רִקּוּד הָאֶצְבָּעוֹת','פְּעִימוֹת הָאוֹר','הַתִּזְמֹרֶת שֶׁלִּי','קֶצֶב הַכּוֹכָבִים','מְחִיאוֹת כַּפַּיִם','רִקּוּד הַצְּבָעִים','שִׁיר וּתְנוּעָה','הַפְּעִימָה הַחַיָּה','קֶצֶב וְשִׂמְחָה','הַמְנַצַּחַת הַקְּטַנָּה'],
  breath: ['נְשִׁימַת הַכּוֹכָב','בּוּעוֹת שֶׁל שֶׁקֶט','הָרוּחַ הָרַכָּה','עָנָן נוֹדֵד','נְשִׁימָה עֲמֻקָּה','גַּלִּים שְׁקֵטִים','הַפֶּרַח שֶׁנִּפְתָּח','רוּחַ שֶׁל אַהֲבָה','שֶׁקֶט בִּפְנִים','נְשִׁימָה צְבעוֹנִית','הָעֵץ הַנּוֹשֵׁם','גַּל וּנְשִׁימָה','מְנוּחָה קְסוּמָה','הַלֵּב הַנּוֹשֵׁם','שֶׁקֶט וְרֹגַע','נְשִׁימָה שֶׁל אוֹר'],
};

/* Deterministic icon per game */
function gameIcon(level: number, idx: number): string {
  const glyphs = ['✦', '✧', '✶', '✷', '✸', '✹', '❋', '✺'];
  return glyphs[(level * 4 + idx) % glyphs.length];
}

function buildGames(): GameDef[] {
  const games: GameDef[] = [];
  let id = 0;
  for (const cat of CATEGORY_ORDER) {
    for (let i = 0; i < 16; i++) {
      const level = Math.floor(i / 4);
      const idxInLevel = i % 4;
      games.push({
        id,
        name: NAMES[cat][i],
        icon: gameIcon(level, idxInLevel),
        category: cat,
        level,
        unlocked: id === 0,
        scene: id === 0 ? 'play' : undefined,
      });
      id++;
    }
  }
  return games;
}

export const GAMES: GameDef[] = buildGames();

export function getGame(id: number): GameDef | undefined {
  return GAMES[id];
}

export function gamesByCategory(cat: GameCategory): GameDef[] {
  return GAMES.filter((g) => g.category === cat);
}
