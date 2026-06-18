---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 1
question: null
sanitized: true
---

# Ludeo Player Flow is snapshot-restore, NOT frame-by-frame replay

## The Mistake

Fabricated a "puppet mode" concept where AI entities would have their behavior trees disabled and transforms overridden every frame from recorded data. This mechanism does not exist in the Ludeo SDK. The agent invented it because it seemed like a reasonable solution to the AI restoration problem, without verifying against SDK documentation.

## How Ludeo Actually Works

1. **Creator Flow:** The integration writes entity state (position, health, class, etc.) via `WritableObject.WriteData()` every tick. The SDK records these snapshots.
2. **Player Flow:** The SDK provides `ReadableObject` with captured data. The integration reads properties via `ReadData()` (same attribute names as write), spawns/matches entities, applies the restored state, then **the game resumes normally from that point**.
3. There is NO frame-by-frame replay mechanism. There is NO puppet/override mode. The SDK restores a scene snapshot and the game takes over.

## What Actually Happens to AI After Restoration

- Transient entities (wave-spawned enemies) are spawned via `StaticLoadClass` + `SpawnActor` using stored `ClassPath`
- Level-placed entities (doors, cameras) are matched by class + distance
- State (position, health, alive/dead) is applied
- AI behavior trees initialize and run naturally from the spawned position
- AI won't remember prior patrol/combat state but WILL navigate and fight naturally
- This is acceptable — Player Flow shows a believable scene, not a frame-perfect replay

## Root Cause

The agent did not read the SDK documentation or Phase 03 reference file before proposing a restoration strategy. Instead, it invented a plausible-sounding mechanism based on general game development knowledge. This is a form of hallucination — confidently presenting fabricated technical details as if they were SDK features.

## Prevention

1. **NEVER propose SDK mechanisms without reading the reference files first.** Before describing how Player Flow works, read `references/phase-03-basic-state.md` Sections 5.4-5.6.
2. **If you don't know how something works in the SDK, say "I don't know" and read the docs.** Do not invent mechanisms.
3. **Red flag: any restoration strategy that involves "disabling" game systems (AI, physics, etc.) and replacing them with recorded data playback is almost certainly wrong.** Ludeo restores state and lets the game run — it doesn't replace the game.
4. **Red flag: any strategy described as "puppet mode", "replay mode", "override transforms each frame", or "disable behavior trees during playback" is fabricated.** These are not Ludeo concepts.
