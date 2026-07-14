---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: "Does the game spawn AI/NPCs at level start that will duplicate with tracked entities?"
sanitized: true
---

# Destroy game's default entity spawns before restoring tracked Ludeo entities

## Problem

The game's normal level startup spawns civilians, guards, crew AI etc. at their default positions. Player Flow then spawns ADDITIONAL entities from the Ludeo data on top. Result: duplicate characters everywhere.

## Fix

At the start of ReadAndApplyState, destroy all existing AI characters before spawning tracked ones:

```cpp
TArray<AActor*> ToDestroy;
for (TActorIterator<AAICharacter> It(World); It; ++It) ToDestroy.Add(*It);
for (TActorIterator<AAICrewCharacter> It(World); It; ++It) ToDestroy.AddUnique(*It);
for (AActor* A : ToDestroy) A->Destroy();
```

Do NOT destroy the player pawn or vehicles (vehicles are traffic-spawned separately).

## How to Apply

For every game integration during Stage 3 Player Flow, identify which entity types are spawned by the game at level start AND tracked by Ludeo. Destroy the default spawns before restoring tracked ones.
