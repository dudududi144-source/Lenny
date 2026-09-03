# Lenny - Cognitive Portal Architecture

Governed by docs/ETHICS.md. Any change conflicting with the Ethics Charter is rejected.

## Principles

- One continuous flow: hero -> garden -> game -> back. No router, no screen cuts.
- The garden has two bodies: the classic 2D map (src/ui/components/GardenMap.ts,
  maintenance mode - byte-untouched since stage 7) and the 3D world (src/world/,
  Babylon.js, the default for real visitors). A silent fallback chain
  (WebGPU -> WebGL2 -> classic) keeps every child playing.
- Games are data: the 144-spec catalog (src/content/SpecGenerator.ts) derives
  from 11 builder templates (src/games/builder/, frozen) and resolves through
  src/games/scenes/registry.ts to 12 hand-built PixiJS scenes + a coming-soon
  guard. Fifty of the 144 carry a tier mechanic variant (variantFor): wind
  memory, first-sound letters, rotated shape shadows, descending sorts,
  situation emotions — tier 0 never does (the e2e ground stays byte-still).
- All config lives in data modules (src/data/garden.ts is the only voice for
  zone copy; src/data/games.ts seeds the 144 names).
- Nothing is hidden from the child. All encouragement is visible (ETHICS 5).
- Sound is silent by default; turning it on is an explicit, remembered choice
  (ETHICS 9 - enforced by AudioEngine + SoundToggle).
- The parent's lens (src/ui/parentlens/) is a read-only view over the same
  device-local data, including the world diary (stage 8):

    WorldScreen (shell events) -> WorldDiary (localStorage) -> lensData -> dashboard

## The World (stage 7)

Babylon.js world app in a LAZY chunk (classic sessions never download a byte
of it): a golden-angle spiral of 10 zone islands, tap-to-walk presence,
orbit/pinch camera, hour-aware skies, bloom fields, Lenny the companion,
an fps governor, and the fallback chain above. WorldScreen is the DOM shell:
canvas host, the game shelf loop (arrive -> shelf -> pick -> arena ->
bloom-in payoff), and the read-only window.__lennyWorld bridge for tooling.

## The World Diary (stage 8)

WorldScreen records a local, identifier-free diary of the world:
`lenny-world-diary-v1` - day buckets keyed by the child's local midnight,
whitelisted counters only (ms / opens / arrivals / shelfOpens / picks /
per-zone arrivals), pruned to a 30-day window. A 30s heartbeat adds real
elapsed time and re-marks instead of adding while the tab is hidden; it
rests when the arena opens (game time is game time). ParentLens v3 reads
the diary read-only: the world card (minutes, visits, picks), the spiral
map with per-island arrival counts, and one gentle favorite-island insight.

## Rendering

- Games: PixiJS WebGL with pooled particles (src/games/engine/).
- World: Babylon.js (WebGPU probe -> WebGL2), lazy chunk, hardware-scaling governor.

## Game Linkage

GameHost mounts a scene per spec (kind -> scene via registry.ts); finishing
records through the single GameScene choke point (ProgressStore + signals),
which grows the garden (bloom ladder) and the world (bloom-in payoff).

## Tests

- Unit: vitest over the pure systems (src/__tests__/).
- E2E: Playwright - 88 contracts: world (default, islands, movement, Lenny,
  life, onboarding, perf, diary), legacy core (smoke, garden, growth,
  daylight, music, parent, ParentLens, catalog, game host, playpath), and
  the 11 game suites. Automation pins the classic garden by default
  (navigator.webdriver) so the legacy contracts stay exact; world specs
  pin the world explicitly.
## Tests

Playwright e2e smoke tests verify the portal canvas loads and survives the opening flow.

## The 3D World (stage 7)

Babylon.js world app in a LAZY chunk (classic sessions never download
a byte of it): a golden-angle spiral of 10 zone islands, tap-to-walk
presence, orbit/pinch camera, hour-aware skies, bloom fields, Lenny
the companion, an fps governor, and a silent fallback chain
(WebGPU → WebGL2 → classic garden).

WorldScreen is the DOM shell around the engine: the canvas host, the
game shelf loop (arrive → shelf → pick → arena → bloom-in payoff),
and the read-only `window.__lennyWorld` bridge for tooling.

## The World Diary (stage 8)

WorldScreen records a local, identifier-free diary of the world:
`lenny-world-diary-v1` — day buckets keyed by the child's local
midnight, whitelisted counters only (ms / opens / arrivals /
shelfOpens / picks / per-zone arrivals), pruned to a 30-day window.
A 30s heartbeat adds real elapsed time and re-marks instead of
adding while the tab is hidden; it rests when the arena opens
(game time is game time).

ParentLens v3 reads the diary read-only and shows the world card
(minutes, visits, picks) plus the spiral map with per-island arrival
counts, and one gentle favorite-island insight.

Data flow:

```
WorldScreen (shell events) → WorldDiary (localStorage) → lensData → dashboard
```
