# Lenny - Architecture

Principles:
- Single source of truth: game/state.ts (lights, emotion). Every visual/audio component reads it.
- Data-driven: content (worlds/puzzles/narrative) loads from JSON (step 7); code is engine only.
- Tokens-first: tokens.json -> CSS vars (--ln-*) + Canvas constants. No hardcoded values.
- Proof before progress: every module verified by Playwright pixel/touch assertions.

Data flow:
    state.ts --> fx/aurora.ts (sky palette/glow by lights)
    state.ts --> fx/diorama.ts (parallax layers + flowers by lights)
    state.ts --> ui/MascotRig (emotions) [step 5]
    state.ts --> audio (instruments by lights) [later]
    input(touch/pointer/keys) --> Boot scene --> mascot + camera

Modules: main.ts (boot,input,test hooks) | state.ts | fx/aurora | fx/diorama | fx/mascot (MascotRig,6 emotions) | game/GameScene (vertical slice: move->puzzle->gate->light->save) | systems/save (done) | systems/puzzles (step7) | ui/ParentLens (step9)

Rendering: Phaser CANVAS (compat + pixel tests). Layers: aurora -> diorama -> mascot -> UI. Post-FX (bloom/grain) at polish.

Tests: smoke(render + real CDP touch + no errors) | design(palette+type) | aurora(animation + lights reaction) | diorama(layers+animation). Config 375x667 hasTouch isMobile.

CI: lint -> typecheck -> build -> playwright -> e2e; artifacts on failure.
