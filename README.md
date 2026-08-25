# Lenny — Garden of Lights

A cognitive garden for children ages 4-7. Ten zones, each with its own
game, all connected by a winding path that grows as the child plays.

Bound by docs/ETHICS.md. World design in docs/GARDEN.md.

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

---

## The Reusable Game Library (the real asset)

This repo is built as a library of strong, reusable systems so new
games can be produced quickly and consistently. Every system below is
config-driven, documented, and used by multiple scenes.

    src/games/fx/ParticleBurst.ts
        object-pooled particle system + presets (bloom/sparkle/confetti)

    src/games/fx/RhythmEngine.ts
        beat-timing + judgment engine (perfect/good/miss windows)

    src/games/fx/CardFlipSystem.ts
        card grid + smooth tweened flip animation (memory games)

    src/games/fx/DialogueBox.ts
        Lenny speech bubble with typewriter reveal + line queue

    src/games/fx/ProgressRing.ts
        smooth animated progress ring (rounds, found-counts)

    src/games/fx/DragDropSystem.ts
        drag-and-drop with drop validation + snap-back animation

    src/games/fx/ColorMixSystem.ts
        pure color-mixing helpers (primaries -> secondaries)

    src/games/core/AdaptiveDifficulty.ts
        DDA engine: EMA skill estimate, streak momentum, frustration cooldown

    src/games/core/PlayerModel.ts
        persistent per-child cognitive profile (strengths, gaps, tempo)

    src/games/core/LearningSignals.ts
        measures learning beyond win/lose (errors, hints, mastery)

    src/games/core/SkillGraph.ts
        dependency-aware skill map (what unlocks what)

## The Game Builder (multi-capable production system)

New games are authored as DATA, not as new scene code.

    src/games/builder/GameSpec.ts
        the contract: a game described as kind + skills + narrative + params

    src/games/builder/GameRegistry.ts
        the catalog: 10 games as specs + discovery helpers

    src/games/builder/GameFactory.ts
        the engine: spec -> runnable scene, with validation

To add a game: write a GameSpec, push it to GameRegistry. Done.

Pattern for every new game:
1. Create a scene in src/scenes/.
2. Reuse the fx systems instead of re-implementing effects.
3. Record progress to the garden via localStorage.
4. Register the scene in src/main.ts.
5. Link the zone in src/data/garden.ts (gameScene field).

---

## Scripts

- npm install
- npm run dev
- npm run build
- npm run preview

## Live

https://dudududi144-source.github.io/Lenny/
