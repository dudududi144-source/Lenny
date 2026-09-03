# Lenny — Garden of Lights

A cognitive garden for children ages 4-7, in Hebrew (full niqqud).
Ten zones on a winding path — in a 3D world you walk through, or on the
classic 2D map — each hosting real, playable games. Local-only data,
no ads, no purchases, no third-party requests.

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
  since stage 12, a CONTINENT: you are a little fox who walks, turns and
  jumps (third-person camera, keyboard/joystick/tap-to-walk, jump on
  space or the thumb button) across a great wide world ~×34 the size of
  the stage-11 garden. SIX far regions — יער הקסמים (enchanted forest),
  ארץ השלג (snow land), עמק הנהר (river valley with a real carved river),
  גבעות הפרחים (flower hills), דיונות החול (sand dunes) and הרי הסלע
  (rocky hills) — each behind its own gate on its own road, each with
  its own scenery palette, landmarks and friends. The ten zone islands
  (the game stages) are SCATTERED across the regions: reaching the next
  stage of the unlock chain is a real journey along plank roads with
  Hebrew signposts and waystones. The land itself rolls: gentle hills
  rise beyond the flat garden and the walker's ground follows them. 24
  named landmarks (the 16 beloved + 8 region heroes tall enough to find
  from afar), 7 named friends, and a mountain-and-clouds vista on the
  horizon. Beyond the continent rolls the endless meadow (deterministic
  seeded chunks, region-dressed, terrain-aware) with golden sparkles in
  an honest local ledger. THE JOURNEY OF THE DAY: every local day, three
  named places light their beacons — a fresh little expedition daily,
  forever. Wayfinding compass, hour skies, bloom fields, Lenny the star
  companion, fps governor, and the silent fallback chain (WebGPU →
  WebGL2 → classic garden) all stay. Details in docs/ARCHITECTURE.md.
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
