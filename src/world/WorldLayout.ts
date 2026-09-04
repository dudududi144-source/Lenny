/* ============================================================
 * WorldLayout — the pure geometry of the 3D world (unit-tested).
 *
 * STAGE 15-B — THE VAST CONTINENT, FOR REAL (the owner counted the
 * old map again: "5x bigger" never arrived). This is the honest one:
 *
 *   - WORLD_WALK_RADIUS 600 → 1150, WANDER 640 → 1200: the continent
 *     more than TRIPLES its radius (~3.7x the area it promised).
 *   - TEN named REGIONS around the whole compass (~36° apart, radii
 *     185–250, hearts 660–940 out): the six old lands moved out with
 *     their islands, and FOUR NEW lands joined — יַעַר הַלַּיְלָה (the
 *     firefly night woods, south), גִּבְעוֹת הַבִּדּוּלִיּוֹת (crystal
 *     foothills, west), גִּבְעוֹת הַקֶּשֶׁת (rainbow hills, east) and
 *     חוֹף הַבְּרֵכוֹת (the lake-shore tide pools, north-west).
 *   - The landmark census grows 50 → 91: every new region hosts a
 *     hero + four interior places, twenty between-lands somewheres
 *     fill the long walks, and one new garden place (the bird post)
 *     keeps the hub's east quarter from being empty.
 *   - DISTRIBUTION, PROVEN IN TESTS: ≥55u between neighbouring places
 *     in the wilds (the hub keeps its cozy ≥4.5), every one of the 8
 *     compass sectors holds places in all 3 rings — no dead quadrant,
 *     no dead ring, no somewhere-less walk.
 *
 * THE PROPORTION LADDER (unchanged): fox ~1.2u, friends ~0.8-1.2,
 * cottages ~2.8, trees 5-10, landmarks 7-16 (heroes).
 *
 * Pure math only: positions, distances, proximity. No Babylon,
 * no DOM — the unit tests pin every number the world depends on.
 * ============================================================ */

import { ZONES, type ZoneId } from '../data/garden';

export interface IslandPlacement {
  zone: ZoneId;
  index: number;
  x: number;
  z: number;
  /** island platform radius (world units) */
  radius: number;
  /** distance from the world center */
  dist: number;
}

const ISLAND_RADIUS = 2.6;

/** The spiral path that connects the HUB islands (the ribbon on the grass). */
export const PATH_WIDTH = 0.85;

/**
 * Where each zone island stands on the continent (stage 12).
 * The journey order (data/garden.ts unlock chain) is now GEOGRAPHY:
 * the first steps in the hub garden, then every next stage waits in
 * its own far region — a road leads to each.
 */
const ISLAND_TABLE: Record<ZoneId, [number, number]> = {
  'light-path': [0, -8.2],
  'memory-hill': [-16.8, -3.4],
  'breath-pool': [13.5, 11.5],
  /* the far stages live INSIDE their regions now — off each region's
     road axis, deep enough that the patch has an interior to roam
     (15-B: the regions tripled their reach, the islands rode along) */
  'attention-stream': [-655, -660],
  'thinking-forest': [-745, -560],
  'space-sky': [-728, 157],
  'words-valley': [-3, 866],
  'feelings-garden': [469, 796],
  'creativity-meadow': [566, 750],
  'rhythm-square': [778, 237],
};

/** The islands that share the hub's golden spiral ribbon (in journey order). */
export const HUB_JOURNEY: ZoneId[] = ['light-path', 'memory-hill', 'breath-pool'];

export function layoutIslands(): IslandPlacement[] {
  return ZONES.map((zone, i) => {
    const [x, z] = ISLAND_TABLE[zone.id];
    return {
      zone: zone.id,
      index: i,
      x,
      z,
      radius: ISLAND_RADIUS,
      dist: Math.hypot(x, z),
    };
  });
}

export const WORLD_ISLANDS: IslandPlacement[] = layoutIslands();

export function islandCenter(zone: ZoneId): { x: number; z: number } {
  const p = WORLD_ISLANDS.find((i) => i.zone === zone);
  if (!p) return { x: 0, z: 0 };
  return { x: p.x, z: p.z };
}

/* ---------- the rings of the world ---------- */

/** The hub garden ring (the flat stage-11 world): its own curated place. */
export const HUB_RADIUS = 51;

/** The curated continent: hub + regions + roads + landmarks (15-B: the whole MAP). */
export const WORLD_WALK_RADIUS = 1150;

/** Beyond the curated continent — the endless meadow (WorldMeadow chunks). */
export const WANDER_RADIUS = 1200;

/** Clamp a target point into the whole wanderable world (the child stays in the world, the world never ends visibly). */
export function clampToWanderArea(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= WANDER_RADIUS) return { x, z };
  const k = WANDER_RADIUS / d;
  return { x: x * k, z: z * k };
}

/** Clamp a target point into the curated garden ring (quest targets, landmarks). */
export function clampToWalkArea(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= WORLD_WALK_RADIUS) return { x, z };
  const k = WORLD_WALK_RADIUS / d;
  return { x: x * k, z: z * k };
}

/* ---------- calm walking (critic round B, W4) ---------- */

/** Peak walk speed — brisk enough that a region-to-region journey is an
    adventure (30–60s of scenery), never a chore on a continent this big
    (14-C: the continent doubled, so the stride did too). */
export const MAX_WALK_SPEED = 9.6;

/** Distance at which a walk target counts as reached. */
export const WALK_ARRIVE_EPS = 0.09;

/**
 * One frame of a walk: the exponential ease is kept (it gives the soft
 * landing) but the peak speed is CLAMPED — the old inline formula hit
 * ~65 u/s on the first frame of a cross-world walk (one giant lurch).
 * Pure so the lurch stays dead by unit test, never by screenshot.
 */
export function walkStepToward(
  from: { x: number; z: number },
  to: { x: number; z: number },
  dt: number,
  rate = 2.1,
): { x: number; z: number; arrived: boolean } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d <= WALK_ARRIVE_EPS) return { x: to.x, z: to.z, arrived: true };
  const safeDt = Math.max(0, Math.min(dt, 0.1));
  const k = Math.min(1, safeDt * rate * (0.55 + Math.min(1, d / 2.5)));
  const step = Math.min(d * k, MAX_WALK_SPEED * safeDt);
  if (d - step <= WALK_ARRIVE_EPS) return { x: to.x, z: to.z, arrived: true };
  return { x: from.x + (dx * step) / d, z: from.z + (dz * step) / d, arrived: false };
}

/**
 * True when the point sits inside an island platform — used to lift
 * walk markers onto platform height instead of sinking into them.
 */
export function isInsideIsland(x: number, z: number): boolean {
  for (const p of WORLD_ISLANDS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius) return true;
  }
  return false;
}

/* ---------- landmarks: the world beyond the path ---------- */

/**
 * SIXTEEN discovery landmarks OFF the spiral — the "מה יש מעבר לפינה?"
 * the garden always promised, now at journey scale. Each is a place
 * with a name (Hebrew, niqqud — environmental print the child can
 * read after finding it) and a one-line narration that teaches one
 * true thing about it.
 *
 * Placement invariants (unit-pinned):
 *   - inside the curated walk radius with a 0.7 margin
 *   - ≥1.5 from every island rim, ≥1.2 from the path centerline
 *   - ≥4.5 apart — landmarks are destinations, not a cluster
 *   - each has a walkable rim spot (the visit point) toward the center
 */
export type LandmarkKind =
  | 'big-tree'
  | 'pond'
  | 'mushrooms'
  | 'windmill'
  | 'rainbow'
  | 'fireflies'
  | 'beehive'
  | 'turtle-rock'
  | 'orchard'
  | 'hollow-log'
  | 'swing'
  | 'well'
  | 'balloon'
  | 'sunflower'
  | 'crystal-cave'
  | 'campfire'
  /* stage 12 — the region heroes, tall enough to find from afar */
  | 'giant-tree'
  | 'wood-hut'
  | 'ice-tower'
  | 'watermill'
  | 'mega-flower'
  | 'obelisk'
  | 'oasis'
  | 'stone-arch'
  /* stage 14-C — twenty more silhouettes: every region gets an
     interior worth exploring (arch / tower / ship / waterfall /
     crystal / henge / mushroom ring...) */
  | 'watch-tower'
  | 'giant-mushrooms'
  | 'hollow-stump'
  | 'wood-arch'
  | 'ice-arch'
  | 'igloo'
  | 'ice-crystal'
  | 'waterfall-rock'
  | 'ferry-boat'
  | 'willow-tree'
  | 'giant-tulip'
  | 'dandelion-tower'
  | 'petal-arch'
  | 'rose-ring'
  | 'sand-pyramid'
  | 'dune-arch'
  | 'buried-ship'
  | 'ruined-gate'
  | 'crystal-cluster'
  | 'stone-circle'
  /* stage 14-E — the far reaches: six more places on the continent's
     edges, so even the long walk between regions always has a somewhere */
  | 'honey-tree'
  | 'moon-pond'
  | 'snow-friend'
  | 'reed-hut'
  | 'sun-clock'
  | 'star-stone'
  /* stage 15-B — the vast continent: four new lands (night woods,
     crystal foothills, rainbow hills, lake-shore tide pools) each
     with a hero + four interior places, twenty between-lands
     somewheres for the long walks, and one new garden place */
  | 'bird-post'
  | 'lantern-tree'
  | 'owl-hollow'
  | 'star-pool'
  | 'moth-meadow'
  | 'night-bell'
  | 'crystal-peak'
  | 'echo-cave'
  | 'gem-bridge'
  | 'quartz-field'
  | 'gem-geode'
  | 'rainbow-tower'
  | 'paint-hill'
  | 'prism-rock'
  | 'kite-tree'
  | 'color-spring'
  | 'tide-pools'
  | 'lighthouse'
  | 'old-pier'
  | 'shell-bed'
  | 'moored-boat'
  | 'maple-row'
  | 'pine-crest'
  | 'heron-reed'
  | 'stone-spring'
  | 'boulder-dell'
  | 'wind-flag'
  | 'amber-stump'
  | 'clover-field'
  | 'goose-pond'
  | 'old-cart'
  | 'snowdrop-hollow'
  | 'moonrise-clearing'
  | 'feather-stone'
  | 'pine-root-arch'
  | 'twin-birches'
  | 'bluebell-hollow'
  | 'salt-stone'
  | 'dusk-stone'
  | 'glow-cap-row'
  | 'reed-bridge'
  | 'flag-hill'
  | 'clover-fork'
  | 'pond-bend'
  | 'cart-cross';

export interface LandmarkDef {
  id: LandmarkKind;
  name: string; /* everyday Hebrew with niqqud */
  line: string; /* Lenny's discovery narration — one true thing */
  x: number;
  z: number;
  /** soft keep-out radius — the child walks to the rim, never inside */
  keep: number;
}

export const LANDMARKS: LandmarkDef[] = [
  {
    id: 'big-tree',
    name: 'הָעֵץ הַגָּדוֹל',
    line: 'זֶה הָעֵץ הַגָּדוֹל! הֶעָלִים שֶׁלּוֹ מִתְנַדְנָדִים בָּרוּחַ.',
    x: -8.87,
    z: 32.14,
    keep: 2.0,
  },
  {
    id: 'pond',
    name: 'הַבְּרֵכָה הַקְּטַנָּה',
    line: 'הַבְּרֵכָה! רוֹאִים בָּהּ אֶת הַשֶּׁמֶשׁ מְנַצְנֵצֶת עַל הַמַּיִם.',
    x: 4.29,
    z: -29.39,
    keep: 2.8,
  },
  {
    id: 'mushrooms',
    name: 'מַעְגַּל הַפְּטְרִיּוֹת',
    line: 'מַעְגַּל פְּטְרִיּוֹת! הֵן גָּדְלוּ כָּאן בְּמָעוֹל, אַחַת לְיַד הַשְּׁנִיָּה.',
    x: 20.32,
    z: -1.69,
    keep: 2.0,
  },
  {
    id: 'windmill',
    name: 'טַחֲנַת הָרוּחַ',
    line: 'טַחֲנַת הָרוּחַ! הַכַּנְפַיִם שֶׁלָּהּ מִסְתּוֹבְבוֹת לְאַט, לְאַט.',
    x: 28.21,
    z: -20.81,
    keep: 1.9,
  },
  {
    id: 'rainbow',
    name: 'קֶשֶׁת בַּגַּן',
    line: 'קֶשֶׁת! צְבָעִים בָּאִים לְבַקֵּר אֶת הַגַּן.',
    x: 0.65,
    z: 11.74,
    keep: 1.8,
  },
  {
    id: 'fireflies',
    name: 'קְרֵחַת הַנְּצִנְצִים',
    line: 'קְרֵחַת הַנְּצִנְצִים! כָּאן הָאוֹר מְנַצְנֵץ גַּם בַּלַּיְלָה.',
    x: -45.03,
    z: 14.24,
    keep: 1.6,
  },
  {
    id: 'beehive',
    name: 'בֵּית הַדְּבוֹרִים',
    line: 'בֵּית הַדְּבוֹרִים! בּוּם, בּוּם — הַדְּבוֹרִים עוֹבְדוֹת כָּאן.',
    x: 16.83,
    z: 21.53,
    keep: 2.0,
  },
  {
    id: 'turtle-rock',
    name: 'אֶבֶן הַצָּב',
    line: 'אֶבֶן הַצָּב! הִיא נִרְאֵית כְּמוֹ צָב יָשֵׁן וְחָכָם.',
    x: -3.08,
    z: -37.12,
    keep: 1.9,
  },
  {
    id: 'orchard',
    name: 'פַּרְדֵּס הַפֵּרוֹת',
    line: 'הַפַּרְדֵּס! עֵצֵי תַּפּוּחַ טְעוּנִים בְּפֵרוֹת אֲדֻמִּים.',
    x: -25.1,
    z: 31.32,
    keep: 3.0,
  },
  {
    id: 'hollow-log',
    name: 'הַבּוֹל הַחָלוּל',
    line: 'בּוֹל חָלוּל! מִי גָּר בְּפֶנִים? אוּלַי קִפּוּד קָטָן.',
    x: -41.28,
    z: -16.17,
    keep: 3.0,
  },
  {
    id: 'swing',
    name: 'הַנְּדָנְדָּה',
    line: 'נְדָנְדָּה! הַמוֹשָׁב מִתְנַדְנֵד בָּרוּחַ, קָדִימָה וְאָחוֹרָה.',
    x: -35.27,
    z: -24.54,
    keep: 1.9,
  },
  {
    id: 'well',
    name: 'בְּאֵר הַגַּן',
    line: 'הַבְּאֵר! זוֹרְקִים פֶּה לְתוֹךְ הַמַּיִם וְשׁוֹמְעִים בֻּלְבֻּל.',
    x: 34.93,
    z: 28.07,
    keep: 1.8,
  },
  {
    id: 'balloon',
    name: 'הַבָּלוּן הַגָּדוֹל',
    line: 'בָּלוּן עָנָק! הוּא קָשׁוּר לַקַּרְקַע וּמְנַפְנֵף לְמַעְלָה.',
    x: -22.72,
    z: 37.85,
    keep: 1.7,
  },
  {
    id: 'sunflower',
    name: 'חַמָּנִית עָנָקִית',
    line: 'חַמָּנִית עָנָקִית! הִיא מַסְתַּכֶּלֶת אֶל הַשֶּׁמֶשׁ כָּל הַיּוֹם.',
    x: -10.54,
    z: -29.82,
    keep: 1.8,
  },
  {
    id: 'crystal-cave',
    name: 'מְעָרַת הַנְּצִנְצִים',
    line: 'הַמָּעָרָה! הַבִּדּוּלִיּוֹת בְּפֶנִים מְנַצְנְצוֹת כְּמוֹ כּוֹכָבִים.',
    x: -47.47,
    z: 8.26,
    keep: 1.8,
  },
  {
    id: 'campfire',
    name: 'מַדּוּרַת הַגַּן',
    line: 'מַדּוּרָה! סָבִיב הָאוֹר יוֹשְׁבִים וּמְסַפְּרִים סִפּוּרִים.',
    x: -10.58,
    z: -2.47,
    keep: 1.5,
  },
  /* ---- stage 12: the region heroes (tall silhouettes for wayfinding) —
     stage 14-C: they moved OUT with their regions ---- */
  {
    id: 'giant-tree',
    name: 'עֵץ הָעָנָק',
    line: 'עֵץ הָעָנָק! הַצִּמֶרֶת שֶׁלּוֹ נוֹגַעַת כְּמַעַט בָּעֲנָנִים.',
    x: -457,
    z: -666,
    keep: 4.6,
  },
  {
    id: 'wood-hut',
    name: 'בִּקְתַּת הַיַּעַר',
    line: 'בִּקְתָּה! מִי גָּר כָּאן? אוּלַי נַמֵּר צָנוּעַ.',
    x: -570,
    z: -555,
    keep: 3.4,
  },
  {
    id: 'ice-tower',
    name: 'מִגְדַּל הַקֶּרַח',
    line: 'מִגְדַּל קֶרַח! הוּא מְנַצְנֵץ כְּמוֹ מַגְדָּל שֶׁל כּוֹכָבִים.',
    x: -682,
    z: 101,
    keep: 4.6,
  },
  {
    id: 'watermill',
    name: 'טַחֲנַת הַמַּיִם',
    line: 'טַחֲנַת מַיִם! הַגַּלְגִּל מִסְתּוֹבֵב עִם הַזְּרִימָה.',
    x: 11,
    z: 850,
    keep: 4.4,
  },
  {
    id: 'mega-flower',
    name: 'הַפֶּרַח הֶעָנָק',
    line: 'פֶּרַח עָנָק! הַדְּבוֹרוֹת נוֹחֲתוֹת עָלָיו כְּמוֹ בְּמֵעִית.',
    x: 546,
    z: 715,
    keep: 4.4,
  },
  {
    id: 'obelisk',
    name: 'מַצֵּבַת הַחוֹל',
    line: 'מַצֵּבָה! אִישׁ אֵינוֹ יוֹדֵעַ מִי הִצִּיב אוֹתָהּ כָּאן.',
    x: 677,
    z: 327,
    keep: 4.6,
  },
  {
    id: 'oasis',
    name: 'נָוֶה קָטָן',
    line: 'נָוֶה! מַיִם בְּתוֹךְ הַחוֹל — מַתָּנָה קְטַנָּה שֶׁל הַמִּדְבָּר.',
    x: 720,
    z: 167,
    keep: 3.8,
  },
  {
    id: 'stone-arch',
    name: 'קֶשֶׁת הָאֲבָנִים',
    line: 'קֶשֶׁת אֲבָנִים! מִי בָּנָה פֹּה שַׁעַר לְפָנִים רַבּוֹת?',
    x: 560,
    z: -598,
    keep: 4.8,
  },
  /* ---- stage 14-C: twenty more places — every region gets an
     interior worth exploring, each a distinct silhouette ---- */
  {
    id: 'watch-tower',
    name: 'מִגְדַּל הַשְּׁמִירָה',
    line: 'מִגְדָּל! מִלְמַעְלָה רוֹאִים אֶת כָּל הַיַּעַר — מִי עוֹלֶה אִתִּי?',
    x: -506,
    z: -747,
    keep: 4.2,
  },
  {
    id: 'giant-mushrooms',
    name: 'פְּטְרִיּוֹת הָעֲנָק',
    line: 'פְּטְרִיּוֹת עֲנָקִיּוֹת! תַּחַת לָהֶן מִסְתַּתֵּר גֶּשֶׁם.',
    x: -649,
    z: -591,
    keep: 5.0,
  },
  {
    id: 'hollow-stump',
    name: 'הַגְּדִיעָה הַחֲלוּלָה',
    line: 'גְּדִיעָה חֲלוּלָה! מִי גָּר בְּתוֹכָהּ? שָׁקֵט, נַקְשִׁיב.',
    x: -424,
    z: -586,
    keep: 3.8,
  },
  {
    id: 'wood-arch',
    name: 'קֶשֶׁת הָעֵצִים',
    line: 'קֶשֶׁת שֶׁל עֵצִים חַיִּים! הַעֲנָפִים מִתְקַשְׁרִים מֵעַל הַדֶּרֶךְ.',
    x: -493,
    z: -547,
    keep: 3.8,
  },
  {
    id: 'ice-arch',
    name: 'קֶשֶׁת הַקֶּרַח',
    line: 'קֶשֶׁת קֶרַח! הִיא מְנַצְנֵצֶת כְּמוֹ שַׁעַר שֶׁל מַמְלֶכֶת הַשֶּׁלֶג.',
    x: -619,
    z: 297,
    keep: 4.2,
  },
  {
    id: 'igloo',
    name: 'בֵּית הַשֶּׁלֶג',
    line: 'בַּיִת מִשֶּׁלֶג! חָם בְּפֶנִים, קָר מִבַּחוּץ — כְּמוֹ חֲבָקָה.',
    x: -567,
    z: 107,
    keep: 4.2,
  },
  {
    id: 'ice-crystal',
    name: 'הַבִּדּוּלִית הָעָנְקִית',
    line: 'בִּדּוּלִית עָנְקִית! הָאוֹר מְשַׂחֵק בְּתוֹכָהּ כְּמוֹ קַשְׁת.',
    x: -498,
    z: 203,
    keep: 3.8,
  },
  {
    id: 'waterfall-rock',
    name: 'סֶלַע הַמְפָל',
    line: 'מְפָל! הַמַּיִם נוֹפְלִים מִלְמַעְלָה וְשָׁרִים שִׁיר.',
    x: -140,
    z: 752,
    keep: 4.8,
  },
  {
    id: 'ferry-boat',
    name: 'סִירַת הַמַּעֲבָר',
    line: 'סִירָה! הִיא מְחַכָּה לְהַפְלָגָה בַּנְּהָר הַשָּׁקֵט.',
    x: 69,
    z: 858,
    keep: 4.6,
  },
  {
    id: 'willow-tree',
    name: 'עֵץ הָעֲרָבָה',
    line: 'עֲרָבָה! שְׂעָרוֹת שֶׁלָּהֶן נוֹגְעוֹת כְּמַעַט בַּמַּיִם.',
    x: -177,
    z: 693,
    keep: 4.8,
  },
  {
    id: 'giant-tulip',
    name: 'הַצַּבָּצוֹן הֶעָנָק',
    line: 'צַבָּצוֹן עָנָק! אֶפְשָׁר לְהִסְתַּכֵּל לְתוֹךְ הַכּוּס.',
    x: 383,
    z: 742,
    keep: 3.8,
  },
  {
    id: 'dandelion-tower',
    name: 'מִגְדַּל הַשַּׁעִיר',
    line: 'שַּׁעִיר עָנָק! נְשִׁיפָה קְטַנָּה — וְכָל הַפְּרָחִים עָפִים.',
    x: 525,
    z: 602,
    keep: 3.8,
  },
  {
    id: 'petal-arch',
    name: 'קֶשֶׁת הַעָלִים',
    line: 'קֶשֶׁת שֶׁל עָלִים וּפְרָחִים! כָּל צֶבַע עוֹבֵר פֹּה.',
    x: 379,
    z: 627,
    keep: 4.0,
  },
  {
    id: 'rose-ring',
    name: 'מַעְגַּל הַוְּרָדִים',
    line: 'מַעְגַּל וְרָדִים! מִסְבִיב רֵיחַ מְתוּק שֶׁל קִץ.',
    x: 444,
    z: 569,
    keep: 4.8,
  },
  {
    id: 'sand-pyramid',
    name: 'הַפִּרְמִידָה',
    line: 'פִּרְמִידָה מֵחוֹל! מִי בָּנָה אוֹתָהּ? וְלָמָּה הִיא כָּל כָּךְ גְּדוֹלָה?',
    x: 585,
    z: 285,
    keep: 4.8,
  },
  {
    id: 'dune-arch',
    name: 'קֶשֶׁת הַחוֹל',
    line: 'קֶשֶׁת אֲבָנִים בַּמִּדְבָּר! הָרוּחַ חָצְבָה אוֹתָהּ לְאַט, לְאַט.',
    x: 620,
    z: 156,
    keep: 4.2,
  },
  {
    id: 'buried-ship',
    name: 'סְפִינָה בַּחוֹל',
    line: 'סְפִינָה! פַּעַם שָׁטָה בַּיָּם — וְהַיּוֹם הַחוֹל מַטְמִין אוֹתָהּ.',
    x: 562,
    z: 229,
    keep: 4.6,
  },
  {
    id: 'ruined-gate',
    name: 'שַׁעַר הֶהָרִים',
    line: 'שַׁעַר עָתִיק שֶׁנִּשְׁבָּר! מִי עָבַר בּוֹ פַעַם?',
    x: 473,
    z: -765,
    keep: 4.6,
  },
  {
    id: 'crystal-cluster',
    name: 'גִּבְעוֹת הַבִּדּוּלִיּוֹת',
    line: 'בִּדּוּלִיּוֹת! כֻּלָּן מְנַצְנְצוֹת — כְּמוֹ שֶׁלֶג שֶׁזוֹכֵר אוֹר.',
    x: 471,
    z: -560,
    keep: 4.0,
  },
  {
    id: 'stone-circle',
    name: 'מַעְגַּל הָאֲבָנִים',
    line: 'מַעְגַּל אֲבָנִים עָתִיק! הֵן מְחַכּוֹת פֹּה כְּבָר שָׁנִים רַבּוֹת.',
    x: 393,
    z: -646,
    keep: 5.0,
  },
  /* ---------- stage 14-E: the far reaches ---------- */
  {
    id: 'honey-tree',
    name: 'עֵץ הַדְּבַשׁ',
    line: 'עֵץ מַתָּק! הֶעָלִים שֶׁלּוֹ מִנַּצְנְצִים כְּמוֹ דְּבַשׁ בַּשֶּׁמֶשׁ.',
    x: -998,
    z: -154,
    keep: 3.6,
  },
  {
    id: 'moon-pond',
    name: 'בְּרֵכַת הַיָּרֵחַ',
    line: 'בְּרֵכָה שֶׁזוֹכֶרֶת אֶת הַלַּיְלָה! בְּתוֹכָהּ יָרֵחַ קָטָן שֶׁל מַיִם.',
    x: 115,
    z: 1066,
    keep: 4.0,
  },
  {
    id: 'snow-friend',
    name: 'יֶדִיד הַשֶּׁלֶג',
    line: 'חָבֵר מִשֶּׁלֶג! עַל הָאֹפֶן שֶׁלּוֹ חִיָּוךְ — מְחַכֶּה לְחִבּוּק.',
    x: -922,
    z: 576,
    keep: 3.6,
  },
  {
    id: 'reed-hut',
    name: 'בִּקְתַת הַקָּנִים',
    line: 'בִּקְתָה מִקְּנֵי נָהָר! פֹּה הַרוּחַ שָׁרָה שִׁירֵי קָנִים.',
    x: 960,
    z: 547,
    keep: 3.6,
  },
  {
    id: 'sun-clock',
    name: 'שְׁעוֹן הַשֶּׁמֶשׁ',
    line: 'שָׁעוֹן עָתִיק מֵאֲבָנִים! הַצֵּל מְסַפֵּר אֶת הַשָּׁעָה בַּיּוֹם.',
    x: 816,
    z: -749,
    keep: 3.6,
  },
  {
    id: 'star-stone',
    name: 'אֶבֶן הַכּוֹכָבִים',
    line: 'אֶבֶן בְּצוּרַת כּוֹכָב! אוֹמְרִים שֶׁנָּפְלָה מִמָּעַל בְּלַיְלָה בָּהִיר.',
    x: 288,
    z: -960,
    keep: 4.0,
  },
  /* ---------- stage 15-B: the vast continent — the four new lands,
     twenty between-lands somewheres, one new garden place ---------- */
  {
    id: 'bird-post',
    name: 'עַמּוּד הַצִּפּוֹרִים',
    line: 'עַמּוּד הַצִּפּוֹרִים! הֵן מִתְכַּנְּסוֹת לְאֲרוּחַ וּמְצַפְּצְפוֹת שִׁיר.',
    x: 36,
    z: 10,
    keep: 1.4,
  },
  {
    id: 'lantern-tree',
    name: 'עֵץ הַפְּנָסִים',
    line: 'עֵץ עֲטוּי פְּנָסִים! בַּלַּיְלָה הוּא מָאִיר כְּמוֹ בֵּית מָלֵא אוֹרְחִים.',
    x: -77,
    z: -887,
    keep: 4.8,
  },
  {
    id: 'owl-hollow',
    name: 'חֲלוּל הַיַּנְשׁוּף',
    line: 'בֵּית שֶׁל יַנְשׁוּף! הָעֵינַיִם הַגְּדוֹלוֹת מַבִּיטוֹת בְּשֶׁקֶט.',
    x: -147,
    z: -817,
    keep: 3.6,
  },
  {
    id: 'star-pool',
    name: 'בְּרֵכַת הַכּוֹכָבִים',
    line: 'בְּרֵכָה שֶׁל כּוֹכָבִים! הַשָּׁמַיִם כֻּלּוֹ נוֹפֵל אֶל תּוֹךְ הַמַּיִם.',
    x: -2,
    z: -832,
    keep: 3.4,
  },
  {
    id: 'moth-meadow',
    name: 'קְרֵחַת הָעָשׁ',
    line: 'קְרֵחַת הָעָשׁ! הֵן רוֹקְדוֹת סָבִיב בְּאוֹר הַיָּרֵחַ.',
    x: -117,
    z: -962,
    keep: 3.4,
  },
  {
    id: 'night-bell',
    name: 'פַּעֲמוֹן הַלַּיְלָה',
    line: 'פַּעֲמוֹן קָטָן! דִּינְג, דִּינְג — הוּא מְנַמְנֵם אֶת הַיַּעַר.',
    x: 18,
    z: -932,
    keep: 3.2,
  },
  {
    id: 'crystal-peak',
    name: 'פַּסְגַּת הַבִּדּוּלִיּוֹת',
    line: 'הַר שֶׁל בִּדּוּלִיּוֹת! הוּא מִתְנַצְנֵץ בְּכָל צֶבַע שֶׁל אוֹר.',
    x: -927,
    z: -208,
    keep: 5.2,
  },
  {
    id: 'echo-cave',
    name: 'מְעָרַת הַהֵד',
    line: 'מָעָרָה מְסַפֶּרֶת! קוֹרְאִים לְתוֹכָהּ — וְהִיא מֵשִׁיבָה בְּעַדִּינוּת.',
    x: -990,
    z: -290,
    keep: 3.6,
  },
  {
    id: 'gem-bridge',
    name: 'גֶּשֶׁר הַבִּדּוּלִיּוֹת',
    line: 'גֶּשֶׁר שֶׁל בִּדּוּלִיּוֹת! חוֹצִים אוֹתוֹ לְאַט — כָּל פַּסִיעָה מְנַצְנֵצֶת.',
    x: -842,
    z: -173,
    keep: 4.0,
  },
  {
    id: 'quartz-field',
    name: 'שְׂדֵה הַקַּרְטְזִים',
    line: 'שְׂדֵה קַרְטְזִים! קוֹצִים שֶׁל אוֹר צוֹמְחִים מֵהָאֲדָמָה.',
    x: -892,
    z: -318,
    keep: 3.8,
  },
  {
    id: 'gem-geode',
    name: 'הַבֵּיצָה הַנִצְנֶצֶת',
    line: 'אֶבֶן עֲגֹלָה שֶׁנִּסְתְּרָה! בְּפֶנִים — עוֹלָם שָׁלֵם שֶׁל נְצִנְצִים.',
    x: -960,
    z: -350,
    keep: 3.4,
  },
  {
    id: 'rainbow-tower',
    name: 'מִגְדַּל הַקֶּשֶׁת',
    line: 'מִגְדַּל עָשׂוּי קֶשֶׁת! כָּל אֶבֶן בְּצֶבַע אַחֵר — כֻּלָּן יַחְדָּו.',
    x: 904,
    z: -246,
    keep: 5.0,
  },
  {
    id: 'paint-hill',
    name: 'גִּבְעַת הַצְּבָעִים',
    line: 'גִּבְעָה מְצֻיֶּרֶת! הַטַּבַּעַת שָׁפְכָה פֹּה אֶת הַצֶּבַע שֶׁלָּהּ.',
    x: 814,
    z: -206,
    keep: 4.6,
  },
  {
    id: 'prism-rock',
    name: 'אֶבֶן הַקַּשְׁת',
    line: 'אֶבֶן מְנַצְנֶצֶת! בַּשֶּׁמֶשׁ הִיא זוֹרֶקֶת קְשָׁתוֹת קְטַנּוֹת.',
    x: 964,
    z: -316,
    keep: 3.4,
  },
  {
    id: 'kite-tree',
    name: 'עֵץ הַדָּאוֹנִים',
    line: 'עֵץ וְעָלָיו דָּאוֹנִים! הָרוּחַ עֲפָה אוֹתָם — וְהֵם נִשְׁאֲרוּ לְבַקֵּר.',
    x: 839,
    z: -336,
    keep: 3.8,
  },
  {
    id: 'color-spring',
    name: 'מַעְיָן הַצְּבָעִים',
    line: 'מַעְיָן מְשַׁנֶּה צֶבַע! פַּעַם וָרוֹד, פַּעַם זָהָב — כָּל יוֹם הַפְתָּעָה.',
    x: 924,
    z: -166,
    keep: 3.2,
  },
  {
    id: 'tide-pools',
    name: 'בְּרֵכוֹת הַשֶּׁפֶל',
    line: 'בְּרֵכוֹת קְטַנּוֹת! בְּכָל אַחַת עוֹלָם — כּוֹכִית יָם, קוֹנְכִיָּה, מַיִם שֶׁלָּקַח הַיָּרֵחַ.',
    x: -536,
    z: 671,
    keep: 4.4,
  },
  {
    id: 'lighthouse',
    name: 'הַמִּגְדָּלוֹן',
    line: 'מִגְדָּלוֹן עַל הַחוֹף! הָאוֹר שֶׁלּוֹ מְסֻבָּב — כָּךְ סְפִינוֹת מוֹצְאוֹת אֶת הַדֶּרֶךְ.',
    x: -626,
    z: 726,
    keep: 4.2,
  },
  {
    id: 'old-pier',
    name: 'הַמַּזָּח הַיָּשָׁן',
    line: 'מַזָּח עָתִיק שֶׁל עֵץ! הוּא הוֹלֵךְ אֶל הַמַּיִם וּמְסַפֵּר סִפּוּרִים.',
    x: -451,
    z: 721,
    keep: 4.0,
  },
  {
    id: 'shell-bed',
    name: 'עֲרָשָׂה שֶׁל קוֹנְכִיּוֹת',
    line: 'קוֹנְכִיּוֹת עָנָק! מַצִּיבִים אוֹתָן לְאָזֶן — וְשׁוֹמְעִים אֶת הַיָּם.',
    x: -576,
    z: 591,
    keep: 3.6,
  },
  {
    id: 'moored-boat',
    name: 'הַסִּירָה הַקְּטַנָּה',
    line: 'סִירָה קְשׁוּרָה לַחוֹף! הִיא מְרַכֵּנֶת בַּמַּיִם — מְחַכָּה לְיוֹם שֶׁל הַפְלָגָה.',
    x: -456,
    z: 616,
    keep: 3.4,
  },
  {
    id: 'maple-row',
    name: 'שׁוּרַת הַמֵּיפֶל',
    line: 'עֲצֵי מֵיפֶל אֲדֻמִּים! בַּסְתָּו הֶעָלִים נוֹשְׁרִים כְּמוֹ גֶּשֶׁם שֶׁל עָלִים.',
    x: -330,
    z: -180,
    keep: 3.4,
  },
  {
    id: 'pine-crest',
    name: 'פִּסְגַּת הָאֳרָנִים',
    line: 'פִּסְגָּה שֶׁל אֳרָנִים! הָרוּחַ שָׁרָה פֹּה בְּעָצֵי הַמָּחוֹל.',
    x: -700,
    z: 430,
    keep: 3.6,
  },
  {
    id: 'heron-reed',
    name: 'קָנֵה הָאֲנָפָה',
    line: 'קָנִים וַאֲנָפָה! הִיא עוֹמֶדֶת עַל רֶגֶל אַחַת וְחוֹשֶׁבֶת.',
    x: -380,
    z: 500,
    keep: 3.2,
  },
  {
    id: 'stone-spring',
    name: 'מַעְיָן הָאֲבָנִים',
    line: 'מַעְיָן בֵּין אֲבָנִים! הַמַּיִם עוֹלֶה מִן הָאָרֶץ וּמְנַבְּנֵב.',
    x: 110,
    z: 330,
    keep: 3.0,
  },
  {
    id: 'boulder-dell',
    name: 'גֵּיא הַסְּלָעִים',
    line: 'סְלָעִים עֲגֹלִים! כְּאִלּוּ עַנְקִים שִׂחֲקוּ פֹּה בְּכַדּוּרֶת.',
    x: 300,
    z: 60,
    keep: 3.6,
  },
  {
    id: 'wind-flag',
    name: 'עַמּוּד הַדִּגְלוֹנִים',
    line: 'דִּגְלוֹנִים צְבָעוֹנִיִּים! הָרוּחַ מְנַפְנֶפֶת בָּהֶם — מַה מְהִיר הַיּוֹם?',
    x: 520,
    z: -180,
    keep: 2.8,
  },
  {
    id: 'amber-stump',
    name: 'גְּדִיעַת הָעַנְבֶּר',
    line: 'גְּדִיעָה מִתְקַתְּקָה! עָלֶיהָ שַׁרְשֶׁרֶת טִפּוֹת — כְּמוֹ עַנְבֶּר.',
    x: -180,
    z: -120,
    keep: 2.8,
  },
  {
    id: 'clover-field',
    name: 'שְׂדֵה הַתִּלְתָּן',
    line: 'תִּלְתָּן עַד הָאוֹפֶן! מִי יוֹדֵעַ — אוּלַי שָׁם עָלֶה אַחַד בְּעַל אַרְבָּעָה.',
    x: 180,
    z: -330,
    keep: 3.0,
  },
  {
    id: 'goose-pond',
    name: 'בְּרֵכַת הַאֲוָזִים',
    line: 'אֲוָזִים בַּבְּרֵכָה! הֵן שָׁטִים בְּשׁוּרָה — אַחַת, שְׁתַּיִם, שָׁלֹש.',
    x: 250,
    z: 450,
    keep: 3.2,
  },
  {
    id: 'old-cart',
    name: 'הַעֲגָלָה הַיְּשָׁנָה',
    line: 'עֲגָלָה נְטוּשָׁה! מִי נָסַע בָּהּ? הַגַּלְגִּיל מְסַפְּרִים סִפּוּר.',
    x: 420,
    z: 120,
    keep: 3.0,
  },
  {
    id: 'snowdrop-hollow',
    name: 'גֵּיא הַנִּצָּנִים',
    line: 'נִצָּנִים לְבָנִים! אֲפִלּוּ בַּשֶּׁלֶג הֵם יוֹדְעִים מָתַי לִפְרוֹחַ.',
    x: -520,
    z: 350,
    keep: 3.0,
  },
  {
    id: 'moonrise-clearing',
    name: 'קְרֵחַת הַיָּרֵחַ',
    line: 'קְרֵחָה שֶׁל הַיָּרֵחַ! כָּאן הוּא עוֹלֶה וּמָלֵא אֶת הַדֶּשֶׁא בְּאוֹר כֶּסֶף.',
    x: -132,
    z: 548,
    keep: 3.2,
  },
  {
    id: 'feather-stone',
    name: 'אֶבֶן הַנּוֹצָה',
    line: 'אֶבֶן שֶׁנּוֹצָה נָחָה עָלֶיהָ! מִי הָעִיף פֹּה בַּדֶּרֶךְ?',
    x: 700,
    z: 470,
    keep: 2.8,
  },
  {
    id: 'pine-root-arch',
    name: 'שַׁעַר הַשָּׁרָשִׁים',
    line: 'שָׁרָשִׁים עֲתִיקִים נִשְׂגְּבִים! עוֹבְרִים מְתַחַת — כְּמוֹ בְּמָנְהֲרָה.',
    x: -450,
    z: -140,
    keep: 3.4,
  },
  {
    id: 'twin-birches',
    name: 'שְׁתֵּי הַבִּרְכּוֹת',
    line: 'שְׁתֵּי בִּרְכּוֹת תָּאוּמוֹת! לְבָנוֹת כְּמוֹ נֵרוֹת — אֲחָיוֹת מִלֵּידָה.',
    x: 60,
    z: -260,
    keep: 2.8,
  },
  {
    id: 'bluebell-hollow',
    name: 'גֵּיא הַפַּעֲמוֹנִיּוֹת',
    line: 'פַּעֲמוֹנִיּוֹת כְּחֻלּוֹת! רוּחַ קְטַנָּה — וְהַגֵּיא מְצַלְצֵל.',
    x: 600,
    z: 430,
    keep: 3.0,
  },
  {
    id: 'salt-stone',
    name: 'אֶבֶן הַמֶּלַח',
    line: 'אֶבֶן לְבֵנָה מְלוּחָה! הַיָּם נָגַע בָּהּ פַּעַם — וְלֹא שָׁכַח.',
    x: -780,
    z: 480,
    keep: 3.0,
  },
  {
    id: 'dusk-stone',
    name: 'אֶבֶן הַבֵּין עֶרֶב',
    line: 'אֶבֶן שֶׁנִּדְלַקַת בָּעֶרֶב! הַשֶּׁמֶשׁ נוֹתֶנֶת לָהּ אֶת הָאוֹר הָאַחֲרוֹן.',
    x: 240,
    z: -720,
    keep: 3.0,
  },
  {
    id: 'glow-cap-row',
    name: 'שׁוּרַת הַפְּטְרִיּוֹת הַזוֹהֲרוֹת',
    line: 'פְּטְרִיּוֹת שֶׁאוֹר בְּכֻבְּרוֹתֵיהֶן! בַּלַּיְלָה הַשּׁוּרָה מְנַצְנֶצֶת.',
    x: -140,
    z: -540,
    keep: 3.0,
  },
  {
    id: 'reed-bridge',
    name: 'גֶּשֶׁר הַקָּנִים',
    line: 'גֶּשֶׁר עָשׂוּי קָנִים! חוֹצִים בְּעִדִּינוּת — הַמַּיִם מְרַעֲנֲנִים מִלְמַטָּה.',
    x: -440,
    z: 800,
    keep: 3.4,
  },
  /* 15-B continuation: four inner-ring somewheres — the inner ring
     holds a somewhere in EVERY compass sector (no empty near quarter) */
  {
    id: 'clover-fork',
    name: 'פִּלְג הַתִּלְתָּנִים',
    line: 'פִּלְג שֶׁל תִּלְתָּנִים! אַרְבָּעָה עָלִים לְכָל עָלֶה — מַזָּל קָטָן בְּכָל צַעַד.',
    x: -84,
    z: 203,
    keep: 3.0,
  },
  {
    id: 'cart-cross',
    name: 'צְלָב הַעֲגָלָה',
    line: 'עֲגָלָה יְשָׁנָה בַּצְּלַב! הַגְּלָגָלִים נָחִים, וְהַדֶּשֶׁא צוֹמֵחַ סָבִיב.',
    x: -203,
    z: 84,
    keep: 3.0,
  },
  {
    id: 'flag-hill',
    name: 'גִּבְעַת הַדִּגְלוֹן',
    line: 'דִּגְלוֹן מְנֻפָּף! הָרוּחַ מְסַפֶּרֶת לוֹ סוֹדוֹת וְהוּא מֵרְנָנֵד.',
    x: -84,
    z: -203,
    keep: 3.0,
  },
  {
    id: 'pond-bend',
    name: 'עִקּוּם הַבְּרֵכָה',
    line: 'בְּרֵכָה עֲגֻלָּה! הַצָּפָרְדְּעִים קוֹפְצוֹת בָּהּ מֵאֶבֶן לְאָבֶן.',
    x: 338,
    z: -19,
    keep: 3.4,
  },
];

/** The walkable spot at the landmark's rim, on the world-center side. */
export function landmarkVisitPoint(l: LandmarkDef): { x: number; z: number } {
  const ang = Math.atan2(l.z, l.x);
  return clampToWalkArea(l.x - Math.cos(ang) * l.keep, l.z - Math.sin(ang) * l.keep);
}

/** Rim spot nearest to a given approach point (the child walks around, not through). */
export function landmarkRimPoint(l: LandmarkDef, fromX: number, fromZ: number): { x: number; z: number } {
  const d = Math.hypot(fromX - l.x, fromZ - l.z);
  const ang = d < 0.01 ? Math.atan2(-l.z, -l.x) : Math.atan2(fromZ - l.z, fromX - l.x);
  /* stage 12: the child stands CLOSER to the place — at the doorstep
     (keep + 0.15) the rim spot stays outside every keep-out while the
     arrival tolerance (keep + 0.8 discovery) reads as "you arrived" */
  return clampToWalkArea(l.x + Math.cos(ang) * (l.keep + 0.15), l.z + Math.sin(ang) * (l.keep + 0.15));
}

/**
 * The landmark whose keep-out contains (or is closest within `maxDist`
 * to) the given point — the place the child is discovering right now.
 */
export function nearestLandmark(
  x: number,
  z: number,
  maxDist: number,
): { landmark: LandmarkDef; dist: number } | null {
  let best: { landmark: LandmarkDef; dist: number } | null = null;
  for (const l of LANDMARKS) {
    const dist = Math.max(0, Math.hypot(x - l.x, z - l.z) - l.keep);
    if (dist <= maxDist && (best === null || dist < best.dist)) {
      best = { landmark: l, dist };
    }
  }
  return best;
}

/**
 * True when the point sits inside a landmark's keep-out — used to lift
 * walk markers and to slide the presence out of props.
 */
export function isInsideLandmark(x: number, z: number): LandmarkDef | null {
  for (const l of LANDMARKS) {
    if (Math.hypot(x - l.x, z - l.z) < l.keep) return l;
  }
  return null;
}

/**
 * Slide the presence out of a landmark's keep-out (critic V1).
 *
 * The walk SURVIVES: the child is pushed to the rim with a small
 * tangential bias toward the target's side, so the slide naturally
 * rounds the place and continues. A walk whose DESTINATION is inside
 * the keep-out is the place visit — it ends here. Pure, so the stall
 * case (target dead-behind the place) is unit-pinned.
 */
export function slideAroundLandmark(
  l: LandmarkDef,
  px: number,
  pz: number,
  target: { x: number; z: number } | null,
): { x: number; z: number; arrived: boolean } {
  const dx = px - l.x;
  const dz = pz - l.z;
  const d = Math.hypot(dx, dz);
  const baseAng = d < 1e-6 ? Math.atan2(-l.z, -l.x) : Math.atan2(dz, dx);

  /* the rim radius — clamp the (rare) deep-inside point out to the edge */
  const r = l.keep + 0.02;

  /* bias: rotate 20° toward the side of the target, so a nearly radial
     pass still gains tangential progress and never stalls on the rim */
  let bias = 0;
  if (target) {
    const cross = dx * (target.z - l.z) - dz * (target.x - l.x);
    bias = (cross >= 0 ? 1 : -1) * 0.35;
  }
  const ang = baseAng + bias;

  /* the walk ends here only when the errand itself pointed into the
     keep-out — that was a place visit, and the rim IS the place */
  const arrived = target !== null && Math.hypot(target.x - l.x, target.z - l.z) < l.keep + 0.1;

  return {
    x: l.x + Math.cos(ang) * r,
    z: l.z + Math.sin(ang) * r,
    arrived,
  };
}

/**
 * The zone whose island contains (or is closest within `maxDist` to)
 * the given point — the "near zone" the child is visiting right now.
 */
export function nearestZone(
  x: number,
  z: number,
  maxDist: number,
): { zone: ZoneId; dist: number } | null {
  let best: { zone: ZoneId; dist: number } | null = null;
  for (const p of WORLD_ISLANDS) {
    const dist = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.radius);
    if (dist <= maxDist && (best === null || dist < best.dist)) {
      best = { zone: p.zone, dist };
    }
  }
  return best;
}

export interface WalkResolution {
  x: number;
  z: number;
  /** true when the tap landed on a locked (fog) island — the child is
      gently held at the rim instead of walking into the fog */
  blocked: boolean;
  /** the locked zone that caused the block (when blocked) */
  blockedZone: ZoneId | null;
  /** set when the target resolved to a landmark's rim — a place visit */
  landmark: LandmarkDef | null;
}

/**
 * Resolve a walk target against the locked gates: unlocked islands
 * and open grass accept the point as-is; a locked fog island holds
 * the child at its rim (never inside the fog — nothing to do there
 * but feel locked out). Valid across the WHOLE wanderable world —
 * the endless meadow is tap-walkable too.
 */
export function resolveWalkTarget(
  x: number,
  z: number,
  isZoneLocked: (zone: ZoneId) => boolean,
): WalkResolution {
  const clamped = clampToWanderArea(x, z);
  for (const p of WORLD_ISLANDS) {
    const d = Math.hypot(clamped.x - p.x, clamped.z - p.z);
    if (d < p.radius + 0.15 && isZoneLocked(p.zone)) {
      /* push the target out to the island's rim (a dead-center tap
         still gets a real direction: back toward the world center) */
      const ang =
        d < 0.01
          ? Math.atan2(-p.z, -p.x)
          : Math.atan2(clamped.z - p.z, clamped.x - p.x);
      const rr = p.radius + 0.45;
      const rim = clampToWanderArea(p.x + Math.cos(ang) * rr, p.z + Math.sin(ang) * rr);
      return { x: rim.x, z: rim.z, blocked: true, blockedZone: p.zone, landmark: null };
    }
  }
  /* landmark keep-out: the child may stand beside the pond, never in it.
     Not a block — the rim IS the destination, tagged so arrival knows
     which place was found. */
  for (const l of LANDMARKS) {
    const d = Math.hypot(clamped.x - l.x, clamped.z - l.z);
    if (d < l.keep + 0.1) {
      const rim = landmarkRimPoint(l, clamped.x, clamped.z);
      return { x: rim.x, z: rim.z, blocked: false, blockedZone: null, landmark: l };
    }
  }
  return { x: clamped.x, z: clamped.z, blocked: false, blockedZone: null, landmark: null };
}

/**
 * Control points for the HUB path: the world center, then the three
 * hub islands in journey order, with arc midpoints so the ribbon
 * follows a spiral instead of cutting straight chords. The far
 * regions have their own roads (WorldRegions.REGION_ROADS).
 */
export function pathControlPoints(): Array<{ x: number; z: number }> {
  const pts: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];
  const hub = HUB_JOURNEY.map((z) => WORLD_ISLANDS.find((i) => i.zone === z)!);
  for (let i = 0; i < hub.length; i++) {
    const p = hub[i];
    if (i > 0) {
      const prev = hub[i - 1];
      const a0 = Math.atan2(prev.z, prev.x);
      const a1 = Math.atan2(p.z, p.x);
      const mid = a0 + (a1 - a0) / 2;
      const rm = (prev.dist + p.dist) / 2;
      pts.push({ x: Math.cos(mid) * rm, z: Math.sin(mid) * rm });
    }
    pts.push({ x: p.x, z: p.z });
  }
  return pts;
}

/** Smooth polyline through the islands (Catmull-Rom, world XZ). */
export function pathPoints(): Array<{ x: number; z: number }> {
  return catmullRom2(pathControlPoints(), 12);
}

/** Classic Catmull-Rom over XZ points (closed=false). */
export function catmullRom2(points: Array<{ x: number; z: number }>, perSeg: number): Array<{ x: number; z: number }> {
  if (points.length < 2) return [...points];
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = Math.min(points.length - 1, i + 2);
    const pp = points[p3];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - pp.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + pp.x) * t3),
        z:
          0.5 *
          (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - pp.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + pp.z) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/* ---------- the journey made legible: signposts (stage 11) ---------- */

export interface SignpostDef {
  index: number;
  x: number;
  z: number;
  /** where the arrow points: the next island down the road */
  toZone: ZoneId;
  /** walking distance along the road to that island, rounded to steps */
  steps: number;
  facing: number; /* radians — the plate turns toward the walker */
}

/**
 * Five signposts along the road, at even fractions of the path.
 * Pure and deterministic: computed from the same spiral the islands
 * come from, offset to the side of the road so they never block it.
 */
export function signposts(): SignpostDef[] {
  const pts = pathPoints();
  const total = pts.length;
  const out: SignpostDef[] = [];
  const fractions = [0.14, 0.32, 0.5, 0.68, 0.86];
  for (let s = 0; s < fractions.length; s++) {
    const at = pts[Math.min(total - 1, Math.round(fractions[s] * (total - 1)))];
    const next = pts[Math.min(total - 1, Math.round(fractions[s] * (total - 1)) + 3)];
    /* perpendicular offset — stand beside the road, not on it (and
       far enough that a neighboring arc segment never crowds it) */
    const dx = next.x - at.x;
    const dz = next.z - at.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = s % 2 === 0 ? 1 : -1;
    const px = at.x + (-dz / len) * 1.85 * side;
    const pz = at.z + (dx / len) * 1.85 * side;
    /* the next island center after this fraction of the road */
    const zoneIdx = Math.min(WORLD_ISLANDS.length - 1, Math.ceil(fractions[s] * (WORLD_ISLANDS.length - 1)) + 1);
    const to = WORLD_ISLANDS[zoneIdx];
    /* steps ≈ road distance remaining, at a child's stride */
    let roadLeft = 0;
    for (let i = Math.round(fractions[s] * (total - 1)); i < total - 1; i++) {
      roadLeft += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    }
    out.push({
      index: s,
      x: px,
      z: pz,
      toZone: to.zone,
      steps: Math.max(4, Math.round(roadLeft * 1.2)),
      facing: Math.atan2(dz, dx),
    });
  }
  return out;
}

/** Deterministic signpost placements (consumed by WorldRoad + tests). */
export const WORLD_SIGNPOSTS: SignpostDef[] = signposts();

/* ---------- friends: the named faces of the garden (stage 11) ---------- */

export type FriendKind = 'bee' | 'snail' | 'frog' | 'bunny' | 'hedgehog' | 'penguin' | 'lizard';

export interface FriendDef {
  id: FriendKind;
  name: string; /* Hebrew with niqqud */
  line: string; /* the bubble when the child comes close */
  x: number;
  z: number;
}

/**
 * Four named friends who live beside the road. They are never a
 * gate and never a task — a friendly face makes a long walk feel
 * populated (and gives the child a reason to leave the path).
 */
export const FRIENDS: FriendDef[] = [
  {
    id: 'bee',
    name: 'בִּזְבַּז הַדְּבוֹרָה',
    line: 'בּוּז, בּוּז! מֵעֵבֶר לַדֶּרֶךְ יֵשׁ עוֹד פְּרָחִים. בוֹא נִרְאֶה!',
    x: 33.9,
    z: 22.7,
  },
  {
    id: 'snail',
    name: 'חִלִּי הַחִלָּזוֹן',
    line: 'אֲנִי מַסְפִּיק לְהַסְתַּכֵּל עַל כָּל פֶּרַח בַּדֶּרֶךְ. גַּם אַתָּה?',
    x: 1.3,
    z: 35.0,
  },
  {
    id: 'frog',
    name: 'צָפִי הַצָּפָרְדֵעַ',
    line: 'קְוָה, קְוָה! אֲנִי קוֹפֵץ גָּבוֹהַּ. רוֹצֶה לְנַסּוֹת?',
    x: 13.2,
    z: 16.9,
  },
  {
    id: 'bunny',
    name: 'צָמֶרֶת הַאַרְנֶבֶת',
    line: 'קִפִּיף, קִפִּיף! הַגַּן גָּדוֹל וּמְלֵא הַפְּתָעוֹת.',
    x: 4.0,
    z: -20.3,
  },
  /* ---- stage 12: friends out in the regions (14-C: they moved out too) ---- */
  {
    id: 'hedgehog',
    name: 'קוּצִי הַקִפּוֹד',
    line: 'פִּיף, פִּיף! בַּיַּעַר כָּל קוּץ מְגַן — וְכָל פֶּרַח מְנַשֶּׁב.',
    x: -528,
    z: -605,
  },
  {
    id: 'penguin',
    name: 'פֶּנְגּוּ הַפִּנְגּוִין',
    line: 'אִיִּיח! הַקֶּרַח כָּאן מַחֲלִיק — רוֹצֶה לְנַסּוֹת?',
    x: -669,
    z: 169,
  },
  {
    id: 'lizard',
    name: 'שָׁמִישׁ הַלִטְפָּן',
    line: 'צְּצְצְ... חַם פֹּה! אֲנִי אוֹהֵב לְהִשָּׁקֵט עַל הַאֲבָנִים.',
    x: 729,
    z: 246,
  },
];

/** The friend standing within `maxDist` of the point (or null). */
export function nearestFriend(
  x: number,
  z: number,
  maxDist: number,
): { friend: FriendDef; dist: number } | null {
  let best: { friend: FriendDef; dist: number } | null = null;
  for (const f of FRIENDS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d <= maxDist && (best === null || d < best.dist)) {
      best = { friend: f, dist: d };
    }
  }
  return best;
}

/* ---------- the wayfinding compass (stage 11) ---------- */

export interface ZoneHint {
  zone: ZoneId;
  /** screen-free bearing: the angle to rotate an arrow (radians, 0 = up) */
  bearing: number;
  /** straight-line distance in "child steps" (≈1.2 per world unit) */
  steps: number;
}

/**
 * Where should the compass point? The nearest UNLOCKED zone the
 * child is not standing in — the journey's next honest destination.
 * Pure: bearing = atan2(dx, dz) so 0 means "the arrow points up".
 */
export function zoneHint(
  x: number,
  z: number,
  isUnlockedZone: (zone: ZoneId) => boolean,
): ZoneHint | null {
  let best: { zone: ZoneId; d: number } | null = null;
  for (const p of WORLD_ISLANDS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d <= p.radius + NEAR_HINT_SKIP) continue; /* you are here */
    if (!isUnlockedZone(p.zone)) continue;
    if (best === null || d < best.d) best = { zone: p.zone, d };
  }
  if (best === null) return null;
  const p = WORLD_ISLANDS.find((i) => i.zone === best!.zone)!;
  return {
    zone: best.zone,
    bearing: Math.atan2(p.x - x, p.z - z),
    steps: Math.max(2, Math.round(best.d * 1.2)),
  };
}

/** a point closer than this to an island's center reads as "you are here" */
const NEAR_HINT_SKIP = 3.2;
