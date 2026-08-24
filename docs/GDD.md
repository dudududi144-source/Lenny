# לֶנִי · קְפִיצַת הַכּוֹכָבִים — Game Design Document

## Vision

A simple, beautiful, and calm vertical jumping game for young children. Lenny the star bounces up endless colorful platforms, collecting golden stars. The experience is joyful, safe, and visually delightful — with no audio, no pressure, and no dark patterns.

## Core Loop

Jump up platforms → Collect stars → Climb higher → Beat your best score → Play again

## Design Pillars

1. **Simplicity**: One-touch controls, one clear goal
2. **Beauty**: Gradient skies, twinkling stars, cute character, colorful platforms
3. **Calm**: No audio, no timers, no failure punishment — just gentle fun
4. **Replayability**: Endless procedural platforms, best score tracking

## Mechanics

- **Movement**: Tap left/right side of screen to move horizontally
- **Jumping**: Automatic bounce when landing on a platform
- **Wrap-around**: Moving off one edge brings Lenny to the other side
- **Stars**: Collect floating stars for bonus points
- **Score**: Height climbed + collected stars
- **Game Over**: Falling below the screen

## Character

Lenny is a cute golden star with big eyes, a smile, and rosy cheeks. She is drawn with vector graphics (code-generated), giving a clean and friendly look.

## Visual Style

- **Sky**: Purple-blue gradient with twinkling stars
- **Platforms**: Rounded, colorful, with soft shadows and highlights
- **Character**: Golden star with glow effect
- **Collectibles**: Golden stars with rotation animation

## Accessibility & Safety

- No audio required (silent by design)
- No tracking, no ads, no in-app purchases
- COPPA-compliant (zero data collection)
- Best score stored locally only

## Technical

- Phaser 3 + TypeScript + Vite
- Single-scene architecture
- Custom physics (gravity, jump, wrap-around)
- All graphics code-generated (no image assets)
- Mobile-first with touch controls
