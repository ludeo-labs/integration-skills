---
category: architecture
tier: generalizable
sourceGame: FTPS_Online
phase: 3
question: "Is the target game Blueprint-only with a BP GameState class that cannot be reparented to C++? If yes, use FWorldDelegates::OnPostWorldInitialization + World->GameStateSetEvent to attach ULudeoGameStateComponent at runtime instead of editing the game's code."
sanitized: true
---

# Attaching ULudeoGameStateComponent at runtime for BP-only games

## The Problem

The standard Stage 2 pattern uses `StaticLoadClass` + `AddComponentByClass` called from a `GameState::PostInitializeComponents` override. That override has to live **somewhere** — either on a C++ GameState base class that the game's BP GameState reparents to, or as a direct edit to the game's own C++ GameState class.

For a **Blueprint-only** game (no `Source/` for the game, GameState is e.g. `BP_GState` with parent `AGameStateBase`), neither option is available without invasive changes:
- Reparenting `BP_GState` to a new C++ class requires editing the asset, which breaks every reference and loses graph work on merge.
- Adding a `PostInitializeComponents` override to the BP graph is possible but fragile and non-standard.

## The Fix

Attach the component from the subsystem at runtime using engine-level world lifecycle delegates:

```cpp
// In ULudeoSessionSubsystem::Initialize
OnPostWorldInitDelegate = FWorldDelegates::OnPostWorldInitialization.AddUObject(
    this, &ULudeoSessionSubsystem::OnWorldInitialized);
OnWorldCleanupDelegate = FWorldDelegates::OnWorldCleanup.AddUObject(
    this, &ULudeoSessionSubsystem::OnWorldCleanup);

void ULudeoSessionSubsystem::OnWorldInitialized(UWorld* World, const UWorld::InitializationValues /*IVS*/)
{
    if (!World || !World->IsGameWorld()) return;

    // GameStateSetEvent fires when AGameStateBase is spawned
    World->GameStateSetEvent.AddUObject(this, &ULudeoSessionSubsystem::OnGameStateSet);

    // Catch the already-set case — GameStateSetEvent may have fired before we bound
    if (AGameStateBase* Existing = World->GetGameState())
    {
        OnGameStateSet(Existing);
    }
}

void ULudeoSessionSubsystem::OnGameStateSet(AGameStateBase* GameState)
{
    if (!GameState) return;
    if (GameState->FindComponentByClass<ULudeoGameStateComponent>()) return; // already attached

    GameState->AddComponentByClass(
        ULudeoGameStateComponent::StaticClass(),
        /*bManualAttachment=*/false,
        FTransform::Identity,
        /*bDeferredFinish=*/false);
}
```

Clean up on `Deinitialize` / `OnWorldCleanup`.

## Why `GameStateSetEvent` and not `OnPostWorldInitialization` directly

`OnPostWorldInitialization` fires **before** the GameMode has spawned the GameState. If you try to fetch `World->GetGameState()` inside that callback on a fresh map load, it returns `nullptr`. `GameStateSetEvent` is the authoritative signal that `AGameStateBase` exists.

But note the race: if the world already has a GameState by the time your subsystem is created (rare — only happens if the subsystem initializes late, e.g. after PIE start), you miss the event. Always combine the delegate bind with an immediate `GetGameState()` check.

## Zero compile-time coupling

This pattern keeps the core game completely untouched:
- No `Source/` edits to the game module (the minimal game module still only contains `IMPLEMENT_PRIMARY_GAME_MODULE`)
- No `.uasset` edits to `BP_GState`
- No BP graph changes

If the LudeoIntegration plugin is disabled, `OnWorldInitialized` is never bound and no Ludeo code runs. This gives the same guarantee as the `StaticLoadClass` pattern but for games where Stage 2's normal "edit the GameState class" step is impossible.

## When to use vs. the standard pattern

| Condition | Approach |
|---|---|
| Game has C++ GameState class | Standard: `StaticLoadClass` + `AddComponentByClass` in `PostInitializeComponents` |
| Game is BP-only (no C++ GameState) | **This pattern** — FWorldDelegates + GameStateSetEvent |
| Game mixes maps with different GameState classes | **This pattern** — handles all of them uniformly |

## Caveats

- The component misses `BeginPlay` timing guarantees that come from being a default component on the GameState class. `AddComponentByClass` with `bDeferredFinish=false` calls `BeginPlay` immediately if the owner is already in a world, so in practice this works. If your component depends on its `BeginPlay` firing **before** some other system's init, verify the ordering explicitly.
- On listen-server + client splits, `GameStateSetEvent` fires on both. The component should still server-gate its Ludeo work via `GetOwner()->GetLocalRole() == ROLE_Authority`.
