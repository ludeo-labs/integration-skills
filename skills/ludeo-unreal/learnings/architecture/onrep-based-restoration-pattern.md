---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: "When restoring captured UPROPERTY state via reflection, how do we fire the cascade (BP graph updates, derived state, visual changes) without per-class adapter code?"
sanitized: true
---

# OnRep is the canonical restoration cascade — fire OnRep_X(OldValue) after ImportText, not the BP setter directly

## The problem

Pre-BeginPlay reflection-write of UPROPERTYs sets the property values but doesn't fire the cascades (BP_OnStateChanged, mesh swaps, navlinks, animation timelines, etc.) that depend on transitions. You end up with:
- Property says "Open" but visual shows "Closed" ("limbo state")
- Property says "Destroyed" but mesh is still the alive mesh
- Property says "Lockdown lifted" but shutter is still down

The naive fix — add per-class BeginPlay handlers that call setters when state is non-default — has problems:
- Requires engine code per class
- Setter often has "if state matches, no-op" early-exit that defeats the cascade when Phase 7 already wrote the property
- Different classes need different setters and arguments (no uniformity)
- Doesn't generalize: each new class requires custom engineering

## The mechanism that actually works

UE's network replication system already solves this exact problem for multiplayer late-join. When a client connects mid-game, the server replicates the current property values. For each `UPROPERTY(ReplicatedUsing=OnRep_X)`, UE calls `OnRep_X(OldValue)` on the client. The game-class authors wrote OnRep handlers specifically to drive cascades when state arrives from elsewhere:

```cpp
// Game-authored OnRep handler — drives the full cascade
void AContainerActor::OnRep_CurrentState(EReplicatedState OldState)
{
    SetStateInternal(OldState, CurrentState, false);  // fires OnStateChanged → BP cascade
}
```

OnRep handlers exist on every replicated UPROPERTY whose state transition has side effects. They're tested in production for the "I just received state X from elsewhere, sync up" scenario. They handle the cascade firing internally.

**The integration mechanism**: after ImportText'ing a captured value, simulate the late-join path by calling the corresponding `OnRep_<PropName>(OldValue)` via `UObject::ProcessEvent`. Same code path multiplayer uses. Tested by the game team in production. Generalizes across every class with replicated state.

## Implementation pattern

```cpp
bool ApplyCapturedProperty(AActor* Actor, FProperty* Prop, const FString& ExportedValue)
{
    // Save pre-write value — needed as OldValue param for OnRep
    uint8 OldValueBuffer[64] = {};
    const bool bHasOldValue = IsPodPropertyForOnRepParam(Prop) && Prop->ElementSize <= sizeof(OldValueBuffer);
    if (bHasOldValue)
    {
        FMemory::Memcpy(OldValueBuffer, Prop->ContainerPtrToValuePtr<void>(Actor), Prop->ElementSize);
    }

    // Write captured value
    void* Addr = Prop->ContainerPtrToValuePtr<void>(Actor);
    if (!Prop->ImportText(*ExportedValue, Addr, PPF_None, Actor)) return false;

    // Fire OnRep_<PropName>(OldValue) — same path as multiplayer late-join
    if (bHasOldValue && !IsClassExcludedFromOnRep(Actor->GetClass()))
    {
        const FString OnRepName = FString::Printf(TEXT("OnRep_%s"), *Prop->GetName());
        if (UFunction* OnRepFunc = Actor->GetClass()->FindFunctionByName(*OnRepName))
        {
            // Queue for deferred firing — see deferred-onrep-flush-timing learning
            QueueOnRep(Actor, OnRepFunc, OldValueBuffer, Prop->ElementSize);
        }
    }
    return true;
}
```

## What's important about this pattern

1. **Universal mechanism, not per-class.** Works for every class with `UPROPERTY(ReplicatedUsing=OnRep_X)`. No per-class adapter list grows.
2. **Faithful to the game team's design.** OnRep handlers are written by the game team's engineers explicitly for the "I just received state X" scenario. We're using the path they designed, not inventing a new one.
3. **Preserves authored semantics.** Whatever flags the OnRep passes to its cascade-firing functions (e.g., `bIsInitialStateChange=true`, `bDoCosmetics=false`) reflect the author's intent for "state arriving from elsewhere." They handle which side effects to suppress.
4. **No early-exit-if-equal bug.** Unlike custom `Ludeo_RestoreState` helpers that short-circuit when the property already matches, OnRep handlers run unconditionally — they always fire the cascade because in the late-join case, the property was JUST written and the cascade hasn't run yet locally.
5. **Bypasses the per-class adapter list trap.** Earlier sessions tried adding per-class BeginPlay handlers (one per Pattern 2 class) — each had subtle quirks (PreviousState set wrong, wrong default state, cascade-firing function takes different params). OnRep dodges all this.

## Caveats

### Timing — must defer to after `World->HasBegunPlay()`

OnRep handlers assume the world is in a post-BeginPlay state (game state initialized, player controllers spawned, etc.). Firing inline during `OnWorldInitializedActors` (pre-BeginPlay) crashes in handlers that touch the player controller or game state. See learning `engine-quirks/defer-onrep-to-post-beginplay.md`.

### Per-class exclusion for classes with native BeginPlay handlers

Some classes have their own BeginPlay-time SaveGame-pattern handler (e.g., `ASecurityCameraActor::BeginPlay` calls `SetCameraState(CameraState)` when non-default). Firing OnRep on top of these crashes via double-cascade — the first cascade tears down state the second one tries to read.

Maintain a class-exclusion list. Check: does the target class's BeginPlay contain `if (<StateProperty> != <Default>) <Setter>(<StateProperty>);`? If yes, exclude.

### POD-only

OnRep parameter passing via raw memcpy works for primitive types (bool, enum, int, float, FName, pointers). For FString/TArray/TMap-typed OnReps, the OldValue passing needs proper InitializeValue/CopyCompleteValue lifecycle that's harder to safely manage. Most replicated state-driving properties are primitives, so skipping the non-POD case isn't a major loss.

### Field-coverage limitation

OnRep only fires the cascade for properties Phase 7 captured. If a property's "taken" / "destroyed" / "modified" state lives somewhere we don't capture (e.g., on a child actor that's destroyed when picked up, like a container's objective item item), OnRep doesn't restore that state. Separate "runtime-spawned/destroyed actor" handling needed.

### Pattern 2 visual gaps

Some BP graphs gate animation play on `bIsInitialStateChange=false` (i.e., they only animate for "live gameplay" transitions, not restore). OnRep firing with the game-default flags (which usually have `bIsInitialStateChange=true`) won't trigger those animations. Door swing animations on `AGateActor` are an example — state restores functionally but the door visual sometimes stays at the .umap default position.

## How to apply

1. **Default approach for any Pattern 2 class with replicated state**: rely on OnRep firing via Phase 7. Don't add per-class BeginPlay handlers.
2. **Verify the class has an `OnRep_<PropName>` UFUNCTION** before assuming it'll work: `grep "OnRep_" <Class>.h`. If none, OnRep mechanism doesn't apply — that property's restoration is just an ImportText with no cascade.
3. **Check the class's BeginPlay for native handlers** before migration. If present, add to exclusion list.
4. **Defer OnRep firing until `HasBegunPlay()`** — never call OnRep during `OnWorldInitializedActors` directly.
5. **For runtime-modified state outside reflection's reach** (objective item-item attachment, runtime-spawned actors), OnRep doesn't help — separate mechanism needed.
6. **For Pattern 2 visual gaps where BP gates on flags**, accept partial restoration unless visual fidelity is a hard requirement — fixing requires BP-level changes or alternative mechanisms (component transform restore, explicit setter call with different flags).

## Why this is universal

The OnRep pattern is UE-native. Every multiplayer-aware UE codebase uses it. The replication system calls OnRep handlers as part of standard client-server synchronization. Any UE game whose state lives in replicated UPROPERTYs has OnRep handlers we can leverage for restoration.

ActionGame findings, validated across three replicated-state archetypes:
- `ASecurityCameraActor`: native BeginPlay handler exists — exclude from OnRep
- `AContainerActor`: OnRep_CurrentState exists, works correctly
- `AGateActor`: OnRep_State exists, works (functional) — visual fidelity partial
- Camera + container + gate validated end-to-end via this mechanism
