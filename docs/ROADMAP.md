# Roadmap — what the audits left us (ordered by value)

> Source: the four hostile audits of 2026-09 (claims-vs-reality 9-a,
> UX 9-b, engineering 9-c, pedagogy 9-d). Fixed-in-this-wave items are
> NOT listed here — only the honest remainder, with its evidence.

## P1 — make the learning real

1. **Tiers must change the mechanic, not the count** (audit 9-d #2).
   Today a seed and a blossom memory game are the same loop with a
   bigger board (caps: pairs 8, acorns 5, kites 6, lanterns 5). Add
   per-tier mechanic variants: n-back / positional-cue memory,
   first-sound letter hunting, real rotations for spatial.
2. **Every template feeds the DDA both ways** (9-d #3). The star-based
   win flag (stage-8 fix) covers the ceremony path; the remaining
   templates should also emit mid-session struggle (`outcome(false)`
   after N misses) so the frustration cooldown lives everywhere.
3. **Wire the SkillGraph into choice** (9-d #4). `frontier()` should
   order the shelf's default pick and the world's next mission, or the
   graph should leave the dashboard. The literacy chain
   (sound → syllable → word) is unreachable until a game teaches sounds.
4. **EmotionFace for pre-readers** (9-d #10): per-option face icons
   (reuse drawTurtleFace) and/or spoken labels; situation vignettes for
   the claimed empathy skill.
5. **Competence-gated unlocks** (9-d #8): next zone opens at ≥2 stars
   or a tier-1 mastery in the previous zone, not any 1 finish.

## P2 — make the world warmer

6. **Visual warmth pass** (9-b #3): warm hemisphere+point lights, soft
   shadows on more than Lenny, fog, emissive path ribbon, hand-tinted
   island textures. The 3D garden must feel magical, not like geometry.
7. **Diegetic shelf** (9-b #6): the game shelf as a wooden-sign panel
   with the world's gold button language, not a glass web overlay.
8. **Organic garden cards** (9-b #7): illustrated scene thumbnails and
   grown (not graded) progress frames on the classic map.

## P3 — engineering hygiene

9. **Split WorldApp.ts** (767 lines — 9-c #7): extract WorldInput
   (gesture wiring) and WorldOnboard (flyover state machine).
10. **One lockfile** (9-c #4): CI builds from package-lock.json; keep
    bun.lock in sync or drop it deliberately.
11. **Deploy reuses CI's build artifact** instead of rebuilding (9-c #8).
12. **Accessibility sweep**: keyboard paths for the world (child on a
    desktop), focus order on the shelf, sound toggle in the game HUD
    aria-live feedback.

## P4 — process

13. **Ethics-contract tests** (9-a #1): a CI step that greps for banned
    mechanics (streak keys, subliminal patterns, external requests)
    so a charter violation can never merge quietly again.
14. **Copy proofread** (9-d #9): a native-speaker pass over all
    child/parent Hebrew — niqqud consistency, gender agreement
    (masc. 'זָכַרְתָּ' vs fem. 'מְצְאִי' mixes exist in game copy).
