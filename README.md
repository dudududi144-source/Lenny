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
