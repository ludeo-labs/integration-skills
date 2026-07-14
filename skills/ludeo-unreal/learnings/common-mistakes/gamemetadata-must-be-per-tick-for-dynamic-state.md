---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Dynamic GameMetadata attributes must be written per-tick, not just at room open

## Problem

GameMetadata was written ONCE at room open via `WriteGameMetadata()`. At that point, MatchState was Phase A (0), WavePhase was Disabled (0), IntensityScalar was 0. Later when the alert triggered, these values changed — but were never updated in the Ludeo data. Player Flow read the initial values and restored to Phase A.

## Fix

Write dynamic GameMetadata attributes (MatchState, WavePhase, LevelProgression, IntensityScalar) every tick in `WriteTrackedState()`, not just in the one-time `WriteGameMetadata()`. Use the same scoped EnterObject guard pattern as entity writes.

Static metadata (MapURL, MapShortName, BotCount) can remain one-time writes.

## How to Apply

When adding any attribute to GameMetadata, ask: "Does this value change during gameplay?" If yes, it MUST be written per-tick. If no (map name, bot count), one-time at room open is fine.
