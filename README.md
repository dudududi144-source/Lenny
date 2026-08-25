# Lenny - Gan shel Orot (Garden of Lights)

A calm cognitive portal for children. One playable game today (Lenny Star Jump), with a clear, honest structure for 144 games to come.

## Ethics first

This project is governed by **[docs/ETHICS.md](docs/ETHICS.md)**. Key points:

- No hidden / subliminal content. All encouragement is visible to the child.
- No medical or brainwave-entrainment claims. It is a game, not a therapy.
- No tracking, no ads, no purchases, no dark patterns.
- All progress stays on the device.

## The Portal Flow

VOID - SPARK - BREATH - REVEAL - MANDALA - GALAXY

| State | What happens |
|-------|-------------|
| VOID | Pure darkness - a calm reset |
| SPARK | A golden point pulses gently |
| BREATH | Optional guided 4-2-4 breathing circle |
| REVEAL | 144 particles of light scatter outward |
| MANDALA | The 9-petal category mandala blooms |
| GALAXY | Home screen - 9 orbit rings of game stars |

Tap anywhere during the intro to skip ahead. Tap a golden star to play.

## Architecture

- src/data/games.ts - 144 games, 9 categories, 4 levels
- src/data/portalConfig.ts - honest config (pulse / breath / colors / timings)
- src/portal/ThetaPulse.ts - gentle visual pulse (calming, not medical)
- src/portal/BreathSystem.ts - 4-2-4 guided breathing
- src/portal/FractalBackground.ts - living star field + nebulae
- src/portal/MandalaSystem.ts - 9-petal category mandala
- src/portal/GalaxySystem.ts - 144-star orbital home screen
- src/portal/AffirmationSystem.ts - VISIBLE encouragement messages
- src/scenes/PortalScene.ts - state-machine conductor
- src/scenes/PlayScene.ts - game #1 (Lenny Star Jump)

## Scripts

- npm install
- npm run dev
- npm run build
- npm run preview

## Live

https://dudududi144-source.github.io/Lenny/
