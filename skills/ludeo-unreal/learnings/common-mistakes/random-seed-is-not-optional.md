---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# Always capture and restore the game's master random seed

## The mistake

Manual state-tracking integrations capture entity transforms, health, AI state — but skip the game's central **random seed**. Reasoning is usually "it's just an int, not really state." Wrong: it's the **input** to all in-match randomness, and Player Flow without it produces visibly different playback.

## What depends on the seed

- AI spawn locations (which spawn point of N is picked)
- Intensity / encounter escalation (which beat fires when)
- Loot layouts (which items spawn in which container)
- Crowd behavior (which bystander flees vs. surrenders vs. freezes)
- Cosmetic randomness (idle animations, ambient SFX, weapon spread)

If any of these visibly differ between capture and replay, the player immediately notices: "this isn't what I just did."

## The rule

1. Find the game's master seed surface — usually on the GameState or MissionState. For ActionGame: `AMissionState::ApplyRandomSeed` + `GetMixedRandomSeed`.
2. Capture the seed value as part of the GameState/MissionState writable object during state writing.
3. On Player Flow restore, **set the seed BEFORE any seed-dependent code runs**. This typically means restoring before `BeginPlay` completes on the GameState — not after entities are spawned.
4. If the game uses `FRandomStream` instances seeded from the master seed, those derive deterministically once the master is correct.

## Reference

The ActionGame integration captured `RandomSeed` via the `Save_GameState()` filter on `AMatchGameState`. One field, large effect.

## Stage 3 pre-flight

Add to Stage 3 pre-flight checklist:

> "Have you identified the game's master random seed and is it included in GameState/MissionState capture? Where in the restore sequence is it applied?"

If no, surface as a coverage gap before implementation begins.

## Anti-pattern signal

"AI spawn order looks slightly different on replay" / "objective item layout drifts" / "the second bystander behaves differently" — almost always seed-related. Don't paper over with milestone trails or scripted respawns; restore the seed.
