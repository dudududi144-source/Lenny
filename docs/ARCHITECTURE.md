# Lenny - Cognitive Portal Architecture

Governed by docs/ETHICS.md. Any change conflicting with the Ethics Charter is rejected.

## Principles

- One scene, six states, zero cuts. The portal is a continuous flow, not screens.
- Every subsystem is a pure, decoupled class in src/portal/.
- All config (frequencies, colors, timings) lives in one place: src/data/portalConfig.ts.
- Nothing is hidden from the child. All encouragement is visible (see ETHICS 5).
- Visual pulse is a calming atmosphere only - NO brainwave-entrainment claims (ETHICS 4).

## Portal State Machine

VOID - SPARK - BREATH - REVEAL - MANDALA - GALAXY

PortalScene owns the state machine and conducts the subsystems.
Each state advances by elapsed time (see TIMING in portalConfig).
Touch during the intro skips ahead; touch in GALAXY selects a game.

## Subsystems

- ThetaPulse: gentle sinusoidal visual pulse (calming atmosphere, not a medical device).
- BreathSystem: 4-2-4 guided breathing, an invitation the child can skip.
- FractalBackground: seeded parallax star field + drifting nebulae.
- MandalaSystem: 9 category petals, each pulsing softly.
- GalaxySystem: 144 stars in 9 counter-rotating orbit rings; hit-test for touch.
- AffirmationSystem: VISIBLE encouragement messages (2.5s on screen). Replaces subliminal.

## Data Flow

portalConfig.ts + games.ts
        |
        v
PortalScene (state machine)
        |
   +----+----+---------+----------+-----------+-------------+
   |         |         |          |           |             |
ThetaPulse Breath  Background  Mandala     Galaxy      Affirmation

## Rendering

Phaser CANVAS with three graphics layers:
bgG (background) - mainG (mandala/galaxy) - fxG (particles/overlay).

## Game Linkage

GameDef.scene maps a game id to a Phaser scene key.
Currently only game #0 (Lenny Star Jump) has scene='play'.
Selecting an unlocked game calls this.scene.start(game.scene).

## Tests

Playwright e2e smoke tests verify the portal canvas loads and survives the opening flow.
