---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Does the game's action phase start BEFORE the player pawn is spawned?"
sanitized: true
---

# OnGameplayPhaseStarted fires before pawn exists — must poll for pawn

## Problem

In ActionGame, `OnGameplayPhaseStarted` fires ~112 frames before `RestartPlayerAtPlayerStart` spawns the player pawn. Calling `ReadAndApplyState` immediately finds no pawn and skips player restoration.

## Fix

Use `FTicker::GetCoreTicker().AddTicker()` to poll for `GetFirstPlayerController()->GetPawn() != nullptr`. FTicker works even when the game is paused (unlike FTimerManager). When the pawn exists, proceed with state restoration.

## How to Apply

Never assume the pawn exists when the game's "gameplay started" signal fires. Always verify pawn existence before applying Player Flow state. Use FTicker for polling if the game might be paused during the wait.
