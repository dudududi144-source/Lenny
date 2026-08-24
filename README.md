# Lenny - Gan shel Orot (Garden of Lights)
Premium kids game (4-7) - Phaser 3 + Vite + TypeScript - Hebrew with niqqud - mobile-first.
Contract: docs/GDD.md - Architecture: docs/ARCHITECTURE.md

The idea: one living world that went dark; every light rescued physically changes the world.

Scripts:
    npm install
    npm run dev        # develop
    npm run build      # build
    npm run preview    # serve dist
    npm run typecheck  # tsc --noEmit
    npm run lint       # eslint
    npm run test:e2e   # Playwright (needs build first)

Structure:
    src/main.ts           bootstrap + Boot scene
    src/tokens.json       Design Tokens (single source)
    src/game/state.ts     source of truth (lights/emotion)
    src/fx/aurora.ts      living sky (state-reactive)
    src/fx/diorama.ts     parallax paper-diorama (state-reactive)
    src/ui/DesignScene.ts design specimen (?scene=design)
    tests/e2e/            Playwright pixel+touch assertions
    docs/                 GDD + ARCHITECTURE

Gates (never skip): 0 GDD, 1 Scaffold, 2 Design, 3 Aurora, 4 Diorama, 5 Mascot, 6 Vertical Slice, 7 Content, 8 Depth, 9 Parents+QA.
Rule: each gate must pass lint+typecheck+build+e2e WITH visual/pixel proof.

Safety: anti-dark-pattern, zero tracking, COPPA privacy, parental time limit, intrinsic rewards, safe-to-fail.
Security: no secrets in repo; .env/keys blocked by .gitignore.
MIT (c) 2025 Lenny
