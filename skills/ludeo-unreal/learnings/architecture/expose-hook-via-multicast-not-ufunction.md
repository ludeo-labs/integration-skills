---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: "Need a hook on a private engine method but the method itself is fine and shouldn't change shape. Should the integration add `UFUNCTION()` to it, make it public, or expose a parallel multicast delegate?"
sanitized: true
---

# Expose a hook via a parallel multicast delegate — don't touch the private method

## Precondition

The integration needs to fire an SDK action (or run other plugin code) when an engine method runs. That method is currently private, has no `UFUNCTION()`, and the engine's logic flowing through it is fine — you just need a notification at the right moment.

The wrong-feeling alternatives:
- Make the method public (changes the class API; opens unrelated callers).
- Add `UFUNCTION()` to the method (drags reflection, may conflict with non-UFUNCTION call sites that pass non-UPROPERTY params, or change Blueprint visibility unexpectedly).
- Re-implement the same logic plugin-side (capture/restore drift; double-firing risks).
- Use `OnDestroyed` or a polling tick (timing wrong, fires too late or too often).

## The Pattern

Add a `DECLARE_MULTICAST_DELEGATE_*` member to the class (gated by `LUDEO_OFFLINE_MODE` — non-Ludeo builds get a bit-identical class):

```cpp
// Engine: WaveSpawnDirector.h
#if LUDEO_OFFLINE_MODE
    // Broadcast from OnSquadKilled so the plugin can fire an
    // CombatSquadKilled SDK action without binding the private method itself.
    DECLARE_MULTICAST_DELEGATE_OneParam(FOnLudeoSquadKilled, const UAISquadOrder*);
    FOnLudeoSquadKilled OnLudeoSquadKilled;
#endif
```

Broadcast at the end of the private method (also gated):

```cpp
// Engine: WaveSpawnDirector.cpp
void AWaveSpawnDirector::OnSquadKilled(const UAISquadOrder* Order)
{
    // ... existing logic untouched ...

#if LUDEO_OFFLINE_MODE
    OnLudeoSquadKilled.Broadcast(Order);
#endif
}
```

Bind from the plugin via `AddUObject` (NOT `AddDynamic` — multicast non-dynamic doesn't need `UFUNCTION`):

```cpp
// Plugin: ActionGameLudeoComponent.cpp
if (AWaveSpawnDirector* CombatMgr = MatchGM->GetCombatManager())
{
    CombatSquadKilledHandle = CombatMgr->OnLudeoSquadKilled.AddUObject(
        this, &UActionGameLudeoComponent::OnCombatSquadKilled);
}
```

The handler is a regular C++ method (no `UFUNCTION()` decorator):

```cpp
void UActionGameLudeoComponent::OnCombatSquadKilled(const UAISquadOrder* Order)
{
    SendLudeoAction("CombatSquadKilled");
}
```

## Why This Is Better Than the Alternatives

| Alternative | Cost |
|---|---|
| Make the method public | Changes class API; lets unrelated callers in. |
| Add `UFUNCTION()` to private | Drags reflection, may break call sites with non-UPROPERTY params, may surface in BP unintentionally. |
| Re-implement the logic plugin-side | Drift; double-fire if both paths run; misses edge cases the original handles. |
| `OnDestroyed` / polling | Wrong timing; fires too late, too often, or via GC instead of "the moment the game logic detected the event." |
| **Multicast delegate** | One member field. Zero existing-call-site impact. Plugin binds from outside. Gated to vanish in production. |

## When to Use

- The trigger moment is well-defined and lives in a single private method.
- You want to add observers without changing the observable's interface.
- Multiple integrations / debug systems may want to observe the same moment.

## When NOT to Use

- The trigger moment depends on per-instance gating (e.g., "fire only for some instances") — better handled in the plugin handler than at the broadcast site.
- The information you need isn't in the private method's scope — multicast can't make data appear; you need to add a parameter, which means changing the broadcast signature.
- You need ordering guarantees relative to other listeners — multicast firing order is not stable.

## Detection / How to Find Where to Put It

When the integration says "I need to know when X happens", grep for the engine code that detects X:
1. If X has a `BlueprintAssignable` `DECLARE_DYNAMIC_MULTICAST_DELEGATE` already → bind to that, no engine edit.
2. If X has a non-dynamic `DECLARE_MULTICAST_DELEGATE` already → bind via `AddUObject`, no engine edit.
3. If neither → find the private method that's the natural broadcast point, add a multicast next to it. One header field + one broadcast line.

## Anti-pattern

Modifying the private method's signature, adding `UFUNCTION()` to it just to bind, or making it public when you don't need any unrelated caller to access it. The class's public API is a contract; the integration shouldn't widen it gratuitously.

## Cross-reference

- `unexported-class-escape-hatches.md` — the `MinimalAPI` / library-wrapper / gameplay-tag escape hatches solve "I can't reach this class"; multicast solves "I can't observe this method."
- `minimalapi-doesnt-export-methods.md` — even with a multicast member added, the class still needs `MinimalAPI` (or `GAME_API`) for the plugin to access it; the multicast field itself doesn't need export decoration since `Add*` / `Broadcast` are inline templates.
