# Roadmap — what the audits left us (ordered by value)

> Source: the four hostile audits of 2026-09 (claims-vs-reality 9-a,
> UX 9-b, engineering 9-c, pedagogy 9-d). Fixed-in-this-wave items are
> NOT listed here — only the honest remainder, with its evidence.

## Delivered since (critic round C — claims vs reality + accessibility, 2026-09)

The owner's verdict framed this round: "the description says 144 games,
in reality there are 10; it says a world, in reality a start of good
functions; it is not really accessible." The round's ledger:

- **The 144 count is now honest AND partly real.** Precise ledger
  everywhere (README, GDD, GARDEN, ARCHITECTURE): 173 playable specs
  (28 seed + 144 derived + 1 legacy) on 12 hand-built engines; within
  an engine a spec differs by knobs — EXCEPT the 50 specs of five
  flagship engines that now change the mechanic at tier 1+ (wind
  memory, first-sound letters, rotated neutral shadows, descending
  sorts, situation emotions). Tier 0 stays byte-still (pinned by
  unit tests); the validator whitelists variants per kind and
  rejects a tier-0 variant. The stale "GAMES has no consumers"
  comment in src/data/games.ts (a lie since stage 6) was corrected.
- **EmotionFace for pre-readers** (9-d #10, the P1 remainder):
  every option tile now carries a mini vector face (pick by looking,
  not by decoding Hebrew), and the situation variant adds spoken
  vignettes with a wondering-turtle reveal.
- **Accessibility sweep** (P3 #12 + the owner's "not really
  accessible"): keyboard walking in the world (arrows/WASD through
  the SAME resolveWalkTarget clamps as a tap; disabled while the
  shelf is open; cleared on blur), the shelf takes focus on open and
  returns it on close (Esc closes), game results are announced to
  assistive tech via #game-live, HUD icon buttons grew 38px → 46px
  (inside the 44px minimum for small fingers), `user-scalable=no`
  removed (WCAG 1.4.4), and a reduced-motion preference skips the
  world flyover entirely.
- Round C remainder (honest): the other six engines still scale by
  knobs only; SkillGraph.frontier() still does not order the shelf;
  native-speaker copy proofread (P4 #14) still owed.

## Delivered since (critic rounds A + B, 2026-09) — for the record

- WorldApp god-module split (WorldInput + WorldOnboard), hot loops
  stop allocating (round A).
- The path lanterns exist (12, lit 1:1 by earned lights) — the journey
  is visible; gesture contract fixed (slow presses are taps); walking
  speed-clamped (no first-frame lurch); zone passes count as visits;
  arrival debounce; pause forgets stale errands (round B).
- **The map grew**: 8 discovery landmarks beyond the spiral (big tree,
  pond, mushroom circle, windmill, rainbow, firefly glade, beehive,
  turtle rock) with beacons, Hebrew name plates, and narration.
- **Discovery quests** (wayfinding / counting / patterns) turn roaming
  into measurable practice; own honest storage (`lenny-world-quests-v1`,
  `lenny-world-found-v1`), no lights inflation; visible in ParentLens.
- World celebrates gate openings; GARDEN.md honest (seasons/social
  marked as not-built; dead portal paths fixed).

## P1 — make the learning real

1. **Tiers must change the mechanic, not the count** (audit 9-d #2).
   DELIVERED FOR FIVE ENGINES in round C (wind / first-sound /
   rotated-shapes / descending / situation — see the round C section).
   REMAINDER: find-target, rhythm-tap, breath-guide, paint-fill,
   open-create, sequence-echo still scale by knobs only.
2. **Every template feeds the DDA both ways** (9-d #3). The star-based
   win flag (stage-8 fix) covers the ceremony path; the remaining
   templates should also emit mid-session struggle (`outcome(false)`
   after N misses) so the frustration cooldown lives everywhere.
3. **Wire the SkillGraph into choice** (9-d #4). `frontier()` should
   order the shelf's default pick and the world's next mission, or the
   graph should leave the dashboard. The literacy chain
   (sound → syllable → word) now has its FIRST reachable rung —
   first-sound hunting (round C) — but syllable and word games
   still do not exist.
4. **EmotionFace for pre-readers** (9-d #10): DELIVERED in round C
   (per-option mini faces + spoken situation vignettes with reveal).
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
12. **Accessibility sweep**: DELIVERED in round C — keyboard world
    walk, shelf focus/Esc, #game-live results announcements, 46px HUD
    targets, zoom unblocked, reduced-motion flyover skip. Remaining:
    a full screen-reader pass over the classic garden map (its zone
    cards are canvas-adjacent DOM but untested with SR).

## P4 — process

13. **Ethics-contract tests** (9-a #1): a CI step that greps for banned
    mechanics (streak keys, subliminal patterns, external requests)
    so a charter violation can never merge quietly again.
14. **Copy proofread** (9-d #9): a native-speaker pass over all
    child/parent Hebrew — niqqud consistency, gender agreement
    (masc. 'זָכַרְתָּ' vs fem. 'מְצְאִי' mixes exist in game copy).
