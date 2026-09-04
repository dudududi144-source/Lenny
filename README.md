# Lenny — Garden of Lights

A cognitive garden for children ages 4-7, in Hebrew (full niqqud).
Ten zones of real games on a living continent — a 3D world you walk
through (six far regions, thirty game clearings, a balloon vista, a
garden well), or the classic 2D map. Local-only data, no ads, no
purchases, no third-party requests.

Bound by docs/ETHICS.md (the binding charter). Product truth in
docs/GARDEN.md + docs/GDD.md.

---

## The Garden (all 10 zones alive)

| Zone | Game | Cognitive focus |
|------|------|-----------------|
| Light Path | Lenny Star Jump | movement + breath |
| Memory Hill | Memory Pairs | working memory |
| Attention Stream | Glowing Fish | visual attention |
| Thinking Forest | Acorn Sort | logic + ordering |
| Space Sky | Kite Match | spatial matching |
| Words Valley | Find the Letter | letter recognition |
| Feelings Garden | Turtle Emotions | emotion recognition |
| Creativity Meadow | Bee Paints a Flower | creativity + color |
| Rhythm Square | Drum Beat | timing + rhythm |
| Breath Pool | Breathing exercise | regulation |

**What the numbers honestly are** (claims-vs-reality, round C): the
garden holds 173 playable specs — 28 hand-written seed games + the
144-name derived matrix + 1 legacy path scene — all riding on **12
hand-built game engines**. Within an engine the specs differ by
difficulty knobs, narrative and skills; and since round C, 50 of the
144 change the mechanic itself at tier 1+ (wind-shuffled memory,
first-sound letter hunting, rotated neutral shadows, descending
sorts, situation-inferred emotions). The docs (docs/GDD.md) keep the
exact ledger — no inflated claims, no hidden shrinkage.

## Architecture (what actually runs)

- **Entry shell** (`src/main.ts`): hero → garden (classic 2D map or 3D
  world, resolved by `src/world/worldMode.ts`) → ParentLens. Zero-cuts
  screen flow, no router.
- **Games** (`src/games/`): PixiJS scenes (`src/games/scenes/`, 12 real
  scenes + a coming-soon guard) mounted by `src/ui/components/GameHost.ts`;
  spec-driven content (`src/games/builder/`, `src/content/`); cognitive
  core (`src/games/core/` — DDA, progress, signals, skill graph).
- **3D world** (`src/world/`): Babylon.js world on a LAZY chunk — and
  since stage 14, a LIVING CONTINENT: you are a little fox who walks,
  turns and jumps (third-person camera, keyboard/joystick/tap-to-walk,
  jump on space or the thumb button) across a walkable world ~600 units
  in radius — the whole continent, hub to rim. SIX far REGIONS — יער
  הקסמים (enchanted forest), ארץ השלג (snow land), עמק הנהר (river
  valley with a real carved river), גבעות הפרחים (flower hills), דיונות
  החול (sand dunes) and הרי הסלע (rocky hills) — are real DESTINATIONS
  now: each sits far out on its own road, each with its own palette,
  interior landmarks worth exploring and friends. 50 named landmarks
  (16 beloved garden places + 8 stage-12 region heroes + 20 stage-14
  interiors: watch-tower, giant mushrooms, waterfall rock, ferry boat,
  giant tulip, sand pyramids, buried ship, ruined gate, crystal
  cluster, stone circle... + 6 far reaches: the honey tree, the moon
  pond, the snow friend, the reed hut, the sun clock, the star
  stone). THE GAMES LIVE IN THE LAND: thirty game
  clearings — three around every zone island, one per difficulty band
  (הראשונים / הבאים / האמיץ) — light their pennants and pillars across
  the map; stepping on a clearing pad opens its entry card (a bottom
  sheet on the phone, a centered card on the desk) and offers that
  band's games; the ten zone islands keep their full shelves. THE
  GARDEN WELL: the acorns a child gathers on her walks are honest money
  — spend them at the well on the fox's scarves, and the scarf is ON
  the fox in the 3D world (local wardrobe only). THE JOURNEY OF THE
  DAY: every local day, three named places light their beacons — a
  fresh little expedition daily, forever. THE BALLOON VISTA (stage 13):
  one tap on the balloon by the home meadow sends the fox up a 26-second
  scenic flight that sees the whole continent — and lands exactly back
  on its pad; a view, never a shortcut. The land rolls, the meadow
  beyond is endless (deterministic seeded chunks, region-dressed,
  terrain-aware), the compass and hour skies and bloom fields and Lenny
  the star companion stay, the fps governor keeps honest renderers
  alive, and the silent fallback chain (WebGPU → WebGL2 → classic
  garden) never breaks a session. Details in docs/ARCHITECTURE.md.
- **Sound** (`src/audio/`): fully synthesized music engine — silent by
  default (ETHICS §9); sound on is an explicit, remembered choice.
- **ParentLens** (`src/ui/parentlens/`): a read-only dashboard over the
  child's local data — game signals, skill tower, and (stage 8) the
  local world diary.

## The reusable systems (per audit: real files only)

- `src/games/core/AdaptiveDifficulty.ts` — DDA engine: EMA skill
  estimate, momentum, frustration cooldown
- `src/games/core/ProgressStore.ts` — garden progress + unlock chain
- `src/games/core/LearningSignals.ts` — errors, hints, mastery events
- `src/games/core/SkillGraph.ts` — dependency-aware skill map
- `src/games/core/PlayerModel.ts` — per-zone cognitive profile
- `src/games/fx/RhythmEngine.ts` — beat timing + judgment windows
- `src/games/fx/ColorMixSystem.ts` — color-mixing helpers
- `src/games/engine/ParticleSystem.ts` — pooled particles + presets
- `src/games/engine/ResultsCeremony.ts` — the finish ceremony
- `src/world/worldDiary.ts` — local, identifier-free world diary

## Adding content

Games are DATA: a GameSpec (`src/games/builder/GameSpec.ts`) derives
from the 144-name seed through `src/content/SpecGenerator.ts` (tier
mechanic variants live there too — `variantFor`); the
builder module is frozen (stage-6 rules) — extend content via the
catalog, not by editing the builder. Scenes register in
`src/games/scenes/registry.ts` (kind → scene), never in main.ts.

---

## Scripts

- `npm install` (CI uses `npm ci`; `bun.lock` + `package-lock.json` both tracked — keep them in sync)
- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint` / `npm run typecheck`
- `npm run test:unit` — vitest
- `npm run test:e2e` — playwright (full 88; run in chunks locally on small machines: `test:e2e:world` / `test:e2e:core` / `test:e2e:games`)
- `npm run test:all` — the whole gate, in order

## Live

https://dudududi144-source.github.io/Lenny/
