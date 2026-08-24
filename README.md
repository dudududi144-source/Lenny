# Lenny - Gan shel Orot (Garden of Lights)

Premium kids game (4-7) - Phaser 3 + Vite + TypeScript - Hebrew with niqqud - mobile-first.

## Architecture (v2.0 - Fixed)

This repository has been refactored from a monolithic structure to a clean, modular architecture.

### Core System
- src/core/EventBus.ts - Clean event system (replaces window as any anti-pattern)
- src/core/StateManager.ts - Single source of truth with event integration
- src/core/EntityManager.ts - Entity-Component System for game objects

### Entities
- src/entities/Mascot.ts - Modular mascot with movement and render components

### Scenes
- src/scenes/WorldScene.ts - Main gameplay scene (clean, modular)
- src/scenes/PuzzleScene.ts - Separate puzzle handling

### FX (High-quality - preserved from original)
- src/fx/aurora.ts - Beautiful gradient sky effect
- src/fx/diorama.ts - Parallax layers with breathing animation

### Data
- src/content/ - JSON data for worlds, puzzles, narrative
- src/tokens.json - Design tokens

## Key Improvements

1. Eliminated window as any - Replaced with proper EventBus
2. Modular Architecture - Entity-Component System instead of monolithic GameScene
3. Clean Separation - Each scene has a single responsibility
4. Preserved Quality - Kept the high-quality aurora and diorama effects
5. Type Safety - Proper TypeScript interfaces and types
6. State Management - Centralized state with event-driven updates

## Scripts

npm install
npm run dev
npm run build
npm run preview

## Live URL

https://dudududi144-source.github.io/Lenny/
