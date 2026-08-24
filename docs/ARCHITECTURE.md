# Lenny - Cognitive Portal Architecture

## Principles

- One scene, six states, zero cuts. The portal is a continuous flow, not screens.
- Every subsystem is a pure, decoupled class in src/portal/.
- All config (frequencies, colors, timings) lives in one place: src/data/portalConfig.ts.
- Theta-band visual entrainment kept subtle and epilepsy-safe.

## Portal State Machine

VOID - SPARK - BREATH - REVEAL - MANDALA - GALAXY

PortalScene owns the state machine and conducts the subsystems.
Each state advances by elapsed time (see TIMING in portalConfig).
Touch during VOID/SPARK skips ahead; touch in GALAXY selects a game.

## Subsystems

- ThetaPulse: precise sinusoidal oscillator in the theta band (default 6Hz).
- BreathSystem: 4-2-4 box-breathing state machine; exposes scale and label.
- FractalBackground: seeded parallax star field + drifting nebulae.
- MandalaSystem: 9 category petals, each pulsing at its own frequency.
- GalaxySystem: 144 stars in 9 counter-rotating orbit rings; hit-test for touch.
- SubliminalSystem: flashes affirmations for ~90ms at random 12-17s gaps.

## Data Flow

portalConfig.ts + games.ts
        |
        v
PortalScene (state machine)
        |
   +----+----+---------+----------+-----------+------------+
   |         |         |          |           |            |
ThetaPulse Breath  Background  Mandala     Galaxy      Subliminal

## Rendering

Phaser CANVAS with three graphics layers:
bgG (background) - mainG (mandala/galaxy) - fxG (particles/overlay).

## Game Linkage

GameDef.scene maps a game id to a Phaser scene key.
Currently only game #0 (Lenny Star Jump) has scene='play'.
Selecting an unlocked game calls this.scene.start(game.scene).

## Tests

Playwright e2e smoke tests verify the portal canvas loads and survives the opening flow.
