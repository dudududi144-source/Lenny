# Lenny - Architecture (v2.0)

## Principles
- Single source of truth: core/StateManager.ts (lights, emotion, world)
- Event-driven communication: core/EventBus.ts (no window globals)
- Entity-Component System: core/EntityManager.ts for game objects
- Data-driven: content (worlds/puzzles/narrative) loads from JSON
- Tokens-first: tokens.json -> CSS vars + Canvas constants

## Data Flow

StateManager --> EventBus --> All Components
     |
     +--> fx/aurora.ts (sky palette/glow by lights)
     +--> fx/diorama.ts (parallax layers + flowers by lights)
     +--> entities/Mascot.ts (emotions affect appearance)

## Module Structure

### Core (new)
- core/EventBus.ts - Event system (replaces window globals)
- core/StateManager.ts - State management with events
- core/EntityManager.ts - ECS for game entities

### Entities (new)
- entities/Mascot.ts - Mascot with MovementComponent + RenderComponent

### Scenes (refactored)
- scenes/WorldScene.ts - Main gameplay (replaces GameScene)
- scenes/PuzzleScene.ts - Separate puzzle handling

### FX (preserved - high quality)
- fx/aurora.ts - Gradient sky with warm/cool transitions
- fx/diorama.ts - Parallax layers with breathing animation
- fx/mascot.ts - Mascot drawing (legacy, kept for compatibility)
- fx/post.ts - Post-processing effects

### Systems (preserved)
- systems/puzzles.ts - Puzzle types and selection logic
- systems/save.ts - Save/load functionality
- systems/i18n.ts - Internationalization
- systems/audio.ts - Audio system
- systems/tts.ts - Text-to-speech

### UI (preserved)
- ui/TitleScene.ts - Main menu
- ui/HubScene.ts - World selection
- ui/ParentsScene.ts - Parent dashboard
- ui/WinScene.ts - Victory screen
- ui/DesignScene.ts - Design specimen

## Rendering
Phaser CANVAS (compat + pixel tests). Layers: aurora -> diorama -> mascot -> UI.

## Tests
Playwright e2e tests in tests/e2e/

## CI
lint -> typecheck -> build -> playwright -> e2e
