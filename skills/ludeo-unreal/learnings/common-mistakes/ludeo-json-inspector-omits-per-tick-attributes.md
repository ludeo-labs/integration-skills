---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Ludeo JSON inspector may not show all attributes — check ReadData at runtime

## Problem

The Ludeo inspector JSON shows the object schema and some attribute values, but may not include ALL per-tick attributes — especially those registered mid-session. The agent spent time debugging "missing attributes" that were actually present in the binary data stream and readable via ReadData at runtime.

## Evidence

MatchState, IsSpecialModeActive, EquipIndex, WavePhase, IntensityScalar, LevelProgression were all missing from the Ludeo JSON inspector. But ReadData at runtime successfully returned the correct values (MatchState=5, IntensityScalar=0.641, etc.).

## How to Apply

Never assume attributes are missing based on the Ludeo JSON inspector alone. Always verify by checking ReadData results in the runtime log. Add logging for both write and read sides of every attribute.
