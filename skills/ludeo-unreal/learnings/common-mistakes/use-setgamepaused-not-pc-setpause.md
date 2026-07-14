---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# Use UGameplayStatics::SetGamePaused, NOT APlayerController::SetPause

SDK pause/resume callbacks must use `UGameplayStatics::SetGamePaused(World, true/false)` — the global UE pause.

`APlayerController::SetPause(true)` is per-player and can be rejected by the game mode if `AllowPausing()` returns false (common in multiplayer game modes like TDM). It also doesn't guarantee `GetWorld()->IsPaused()` returns true.

`SetGamePaused` is the engine-level global pause that works regardless of game mode settings and is what the tick-based `IsPaused()` detection polls.
