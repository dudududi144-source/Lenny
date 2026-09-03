# Lenny - Gan shel Orot - Product Design Document

Bound by docs/ETHICS.md. Read it first.

## Vision

A calm, beautiful play-space for children aged 4-7. It invites a gentle, focused mood through soft visuals, slow pacing, and guided breathing - then offers small cognitive games to enjoy.

## What this product claims (and what it does NOT)

- It IS a relaxing, enjoyable play experience.
- It is NOT a medical device, therapy, or a scientifically-proven learning tool.
- It makes NO claims about brainwave entrainment, IQ, or developmental outcomes.

## The 144-Game Matrix — and what "144" honestly means

9 categories x 16 games (4 levels x 4 games each).

| Category | Skill it playfully exercises |
|----------|------------------------------|
| memory | matching, recall, sequences |
| attention | spotting, focus, tracking |
| logic | patterns, cause and effect |
| spatial | shapes, rotation, maps |
| language | letters, sounds, words |
| emotion | naming and recognizing feelings |
| creativity | drawing, imagining, making |
| rhythm | timing, movement, music |
| breath | slow breathing, calming |

The honest count (claims-vs-reality, round C): the 144 names derive
into 144 specs that play on **12 hand-built game engines** (11 builder
kinds + the legacy path scene). Within an engine, a spec differs by
difficulty knobs (counts, paces, rounds), narrative and skill tags —
and, since round C, **50 of the 144 change the MECHANIC itself at
higher tiers**:

- memory, tier 1+: `wind` — after a miss the wind swaps two face-down
  cards; the child re-encodes positions, not just recalls them
- language, tier 1+: `first-sound` — hear a word, pick the letter it
  starts with (the phonemic step the literacy chain was missing)
- spatial, tier 2+: `rotated-shapes` — shadows lose their color and
  gain rotations; matching is by silhouette under rotation
- logic, tier 1+: `descending` — arrange big -> small; the planning
  direction inverts
- emotion, tier 1+: `situation` — hear a vignette, infer the feeling,
  then the true face is revealed (empathy practice, not face reading)

The other engines stay "classic" at every tier — knobs change, the
mechanic does not, and the docs say so. Tier 0 never carries a
variant: the seed specs and e2e ground keep their exact gameplay
params and logic (unit-pinned).

Levels: seed, sprout, tree, blossom (roughly ages 3-7).

## Honesty about progress

All 144 specs are playable today: every spec resolves to one of 11 real
game kinds (12 hand-built scenes + a coming-soon guard), seeded per zone
with tier unlocks (×3 per tier). The 3D world (stage 7) is the garden's default for real
visitors; the classic 2D map remains a complete fallback — one chip
away, and the automatic fallback whenever the world cannot run.

The parent's lens (ParentLens) reads the same device-local data: game
finishes, learning signals, and — since stage 8 — an honest local diary
of the world (minutes, visits, island arrivals, shelf picks). No
identifiers, a 30-day rolling window, and it never leaves the device.

## Safety & Privacy

- No audio by default (silent visual experience).
- Visual pulses are low-amplitude and photosensitivity-safe.
- No tracking, no ads, no purchases, no external links. COPPA-clean.
- Encouragement messages are fully visible to the child - never hidden.
- All progress is stored locally on the device only.

## First Playable

Game #0 is Lenny Star Jump (scene 'play').
