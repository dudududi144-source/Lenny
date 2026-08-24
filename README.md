# Lenny - Gan shel Orot (Garden of Lights)

A cognitive portal for children: 144 games across 9 developmental categories, wrapped in a theta-wave guided experience.

## The Portal Flow

VOID - SPARK - BREATH - REVEAL - MANDALA - GALAXY

| State | What happens |
|-------|-------------|
| VOID | Pure darkness - the mind resets |
| SPARK | A golden point pulses at 6Hz (theta entrainment) |
| BREATH | Guided 4-2-4 breathing circle |
| REVEAL | 144 particles of light scatter outward |
| MANDALA | The 9-petal cognitive mandala blooms |
| GALAXY | Home screen - 9 orbit rings of game stars |

## Architecture

- src/data/games.ts - 144 games, 9 categories, 4 levels
- src/data/portalConfig.ts - theta / breath / colors / timings
- src/portal/ThetaPulse.ts - visual theta-wave oscillator
- src/portal/BreathSystem.ts - 4-2-4 guided breathing
- src/portal/FractalBackground.ts - living star field + nebulae
- src/portal/MandalaSystem.ts - 9-petal category mandala
- src/portal/GalaxySystem.ts - 144-star orbital home screen
- src/portal/SubliminalSystem.ts - affirmation priming layer
- src/scenes/PortalScene.ts - state-machine conductor
- src/scenes/PlayScene.ts - game #1 (Lenny Star Jump)

## Scripts

- npm install
- npm run dev
- npm run build
- npm run preview

## Live

https://dudududi144-source.github.io/Lenny/
