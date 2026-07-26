---
category: engine-quirks
tier: game-specific
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---
# ActionGame uses SetPausedPreferred, not UGameplayStatics::SetGamePaused

## What happened
`UGameplayStatics::SetGamePaused(World, true)` was called in SDK pause/resume handlers and Player Flow sequences. The call succeeded silently (no error) but had no effect — the game did not pause. The user reported "pressing ESC does pause the game" which pointed to a different pause path.

## Root cause
ActionGame's game mode silently rejects the standard UE pause path (`AGameModeBase::SetPause`). The game uses a custom network-aware pause system:

- `APlayerControllerBase::SetPausedPreferred(bool)` — sets `bIsPausedPreferred`, then calls `ServerUpdatePausedState()` which sets `AWorldSettings::PauserPlayerState`
- The ESC key triggers `UGameplayPhaseMenuWidget::ToggleShowMenu()` → `SetMenuShown()` → `PlayerController->SetPausedPreferred(bIsMenuShown)`
- `WorldSettings->PausedChangedDelegate` broadcasts to the UI widget which updates `bIsPaused` and calls `BP_OnPausedChanged`

## Fix
Replace all `UGameplayStatics::SetGamePaused` calls with a static helper:
```cpp
static void SetActionGamePaused(UWorld* World, bool bPaused)
{
    if (!World) return;
    if (APlayerControllerBase* PC = Cast<APlayerControllerBase>(World->GetFirstPlayerController()))
    {
        PC->SetPausedPreferred(bPaused);
    }
}
```

Requires an `#include` for the game's player-controller-base header.

## How to detect this in other games
If `SetGamePaused` appears to succeed but the game doesn't pause, check:
1. Does the game mode override `AllowPausing()` to return false?
2. Does the game have a custom pause system? Grep for `SetPause`, `PauserPlayerState`, `PausedPreferred`, `bIsPaused` in the player controller hierarchy.
3. Find how the ESC/pause menu pauses — that's the authoritative path.
