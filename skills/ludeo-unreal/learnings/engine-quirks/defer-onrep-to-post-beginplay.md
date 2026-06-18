---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 4
question: "When firing OnRep handlers during state restoration, what's the right timing? Is OnWorldInitializedActors safe?"
sanitized: true
---

# OnRep handlers must fire AFTER World->HasBegunPlay() — pre-BeginPlay crashes

## The trap

The intuitive place to fire restoration OnReps is `OnWorldInitializedActors` (the same hook used for pre-BeginPlay property writes). It's pre-BeginPlay, all actors exist, everything seems ready.

**It's not ready.** OnRep handlers assume the world is in a post-BeginPlay state:
- Game mode has spawned its proper player controller (not the MainMenu controller)
- Game state is initialized
- AI controllers are bound to their pawns
- Replication subsystem is alive

Pre-BeginPlay, the world is still in the middle of transitioning from the previous level (typically MainMenu). The current player controller is the main-menu controller (`AMainMenuPlayerController`), not the gameplay controller. Various subsystems aren't initialized.

## What this looks like when it crashes

Real example (firing OnRep_State on `AObjectiveActor` during OnWorldInitializedActors):

```
Cast of AMainMenuPlayerController to APlayerControllerBase failed
UAnalyticsManager::SendObjectiveStart()
  → AObjectiveActor::OnRep_State()
  → UFunction::Invoke (ProcessEvent)
  → Phase 7's ApplyCapturedProperty
  → RestoreFromAttrs (in OnWorldInitializedActors)
```

The OnRep handler called into analytics, which `CastChecked<APlayerControllerBase>(GetFirstPlayerController())` — but the controller was still MainMenu at this point in world init. CastChecked is fatal.

Other failure modes you'd see at this timing:
- Gates emit "Sets gate state before begin play (Ignoring state change)" asset-check errors — game classes explicitly defend against pre-BeginPlay state writes
- Crashes in any OnRep that touches game state, mission state, or player state

## The fix: defer until HasBegunPlay()

`UWorld::HasBegunPlay()` returns true after the world has fired its initial `BeginPlay` calls — the canonical "world is alive" signal.

Pattern:
1. During restoration: **queue** OnRep calls instead of firing them inline. Store `(Actor, OnRepFunc, OldValueBuffer)` tuples.
2. After restoration completes, register an FTicker that polls each tick.
3. On each tick: if `World->HasBegunPlay()` is true, flush the queue (fire all OnReps via ProcessEvent), then unregister the ticker.

```cpp
// Engine has TArray<FPendingOnRep> PendingOnReps; mutated by ApplyCapturedProperty.

// Subsystem after RestoreFromAttrs:
if (Engine->HasPendingOnReps())
{
    TWeakObjectPtr<UWorld> WorldWeak = World;
    TWeakObjectPtr<UActionGameLudeoSubsystem> SelfWeak = this;
    FTicker::GetCoreTicker().AddTicker(
        FTickerDelegate::CreateLambda([WorldWeak, SelfWeak](float) -> bool
        {
            UActionGameLudeoSubsystem* Self = SelfWeak.Get();
            UWorld* W = WorldWeak.Get();
            if (!Self || !W) return false;  // unregister — context lost
            if (!W->HasBegunPlay()) return true;  // poll again next tick
            if (auto* Engine = Self->GetReflectionState())
            {
                Engine->FlushPendingOnReps();
            }
            return false;  // unregister
        }),
        /*Delay=*/ 0.0f);
}
```

## Why FTicker not FTimerManager

Per the `feedback: FTicker-not-FTimer while paused` learning from prior sessions, `FTicker` keeps firing while the world is paused; `FTimerManager` doesn't. For polling that needs to survive pause states, FTicker is the choice.

## Side effect of deferring

There's a one-frame visual delay where actors briefly show their .umap default state before the cascade fires. Usually invisible to the player (loading screens cover it). Acceptable.

## Worth knowing

- This is the same timing UE's replication system itself uses for late-join. The first replication packet to a newly-joining client arrives after the actor BeginPlay. OnRep handlers are written assuming this.
- If a specific OnRep STILL crashes even after `HasBegunPlay()` is true, it's a deeper class-specific issue — that class may need a stricter readiness signal (e.g., "wait for the match game state's current-state field to be initialized"). Add a more specific check in the ticker.
- Don't try shorter delays via FTicker's `Delay` parameter — the polling-until-ready pattern is correct because we don't know exactly how many frames until ready.

## How to apply

Whenever using reflection to restore property state and firing the cascade via OnRep:

1. **Queue OnReps during the restoration pass**, don't fire inline
2. **Schedule a polling ticker** that checks `World->HasBegunPlay()` after restoration
3. **Flush the queue** once ready
4. Test with a class that has OnRep handlers touching game state — those are the ones that surface timing bugs

Skipping this pattern works for simple property restores but crashes the moment any tracked class has an OnRep that touches things outside the actor itself.
