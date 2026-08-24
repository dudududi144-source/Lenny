# Lenny: Star Jump - Architecture

## Overview

A clean, simple vertical jumping game built with Phaser 3.

## Files

- src/main.ts - Game bootstrap, single scene
- src/scenes/PlayScene.ts - The entire game (menu, play, game over)

## Game Architecture

### Single Scene Design
The game uses one PlayScene with three internal states:
- menu: Title screen with animated character
- play: Active gameplay
- over: Game over screen with score

### Physics (Custom, Improved)
Instead of relying on arcade physics, the game uses clean custom physics:
- Gravity pulls the player down (GRAV = 1500)
- Jumping gives upward velocity (JUMP = -680)
- Horizontal movement is direct (SPEED = 400)
- Wrap-around at screen edges for smooth movement

### Collision
Simple platform collision when falling:
- Only checks collision when player is moving downward
- Detects landing on top of platform
- Resets player position and applies jump velocity

### Camera
- Camera follows the player upward only (never scrolls down)
- Creates the sense of climbing higher

### Rendering
All graphics are drawn with Phaser Graphics (vector, no images):
- Background: gradient sky with twinkling stars
- Platforms: rounded rectangles with shadows and highlights
- Player: cute star character with eyes and smile
- Stars: collectible golden stars

## Content

- Worlds: N/A (endless vertical game)
- Puzzles: N/A (pure movement game)
- Score: height climbed + collected stars
- Best score saved to localStorage

## Design Decisions

- No audio: The game is designed as a silent, calm experience
- No external assets: All graphics are code-generated
- Single file scene: Keeps the game simple and maintainable
- RTL Hebrew UI: Title and instructions in Hebrew with niqqud
