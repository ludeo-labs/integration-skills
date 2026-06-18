---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 2
question: "Does the game have non-gameplay worlds (main menu, lobby, transition levels) that also spawn a GameState?"
sanitized: true
---

# Component must NOT attach to non-gameplay GameStates (MainMenu, Lobby, TransitionLevel)

## Problem

The runtime component attachment pattern (`FWorldDelegates::OnPostWorldInitialization` → `GameStateSetEvent` → attach `ULudeoComponent`) fires for EVERY world, including the MainMenu. When the component attaches to the MainMenu's GameState, it runs `BeginPlay` → `TryOpenRoom()` → SDK HTTP requests during the boot flow. This blocks the game's async loading chain and hangs the loading screen ("Getting ready..." never completes).

In ActionGame, the MainMenu uses `AMainMenuGameMode` which creates a generic `AGameStateBase`. The Ludeo component opened a room, added a player, and triggered SDK HTTP traffic — all before the state machine could finish booting to the main menu.

## Root Cause

The `OnGameStateSet` handler had no filter — it attached the component to ANY GameState:

```cpp
// BAD: attaches to MainMenu, TransitionLevel, etc.
void OnGameStateSet(AGameStateBase* GameState)
{
    if (!GameState) return;
    if (GameState->FindComponentByClass<ULudeoComponent>()) return;
    auto* Comp = NewObject<ULudeoComponent>(GameState);
    Comp->RegisterComponent();
}
```

## Fix

Filter by the game's mission/gameplay GameState class:

```cpp
// GOOD: only attaches to gameplay (match) worlds
void OnGameStateSet(AGameStateBase* GameState)
{
    if (!GameState) return;
    if (!GameState->IsA(AMatchGameState::StaticClass())) return;  // <-- KEY LINE
    if (GameState->FindComponentByClass<ULudeoComponent>()) return;
    auto* Comp = NewObject<ULudeoComponent>(GameState);
    Comp->RegisterComponent();
}
```

## How to Apply

During Stage 2 (Lifecycle) when implementing the component attachment:

1. Identify ALL GameState classes in the game (grep for `AGameState` subclasses and `GameModeClass` defaults)
2. Determine which one is the "gameplay" GameState (the one used during actual gameplay, not menus/lobbies)
3. Add an `IsA()` check in `OnGameStateSet` to filter out non-gameplay worlds
4. If the game has multiple gameplay GameStates (e.g., different modes), use a common base class or a list

**Red flag:** If the component's `BeginPlay` opens a room or triggers any SDK HTTP traffic, and it runs during the main menu boot, the game WILL hang or stall during loading. The SDK's `ludeo_Tick()` processes HTTP callbacks on the game thread — heavy traffic during boot starves the game's own async loading.
