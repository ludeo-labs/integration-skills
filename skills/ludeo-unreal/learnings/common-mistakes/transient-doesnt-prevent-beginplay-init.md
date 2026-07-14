---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: "Are you adding `UPROPERTY(Transient)` to an `EditAnywhere` array on a class whose entries are populated by BP editor defaults? STOP. Transient drops those defaults at load time."
sanitized: true
---

# `UPROPERTY(Transient)` on an editor-defaulted array silently zeroes the runtime array

## The mistake

I added `Transient` to a `UPROPERTY(EditAnywhere)` array thinking it was a harmless decoration that would "prevent save-game serialization from competing with our replay-side restore":

```cpp
// WRONG
UPROPERTY(EditAnywhere, ReplicatedUsing = OnRep_DamagePools, Transient)
TArray<FDamagePool> DamagePools;
```

This was not harmless. It silently broke every BP that authored its `DamagePools` array via the editor defaults UI.

## What `Transient` actually does

`Transient` tells the **UE serializer** — at every layer including the asset (`.uasset`) loader — to skip this property. That includes:

- **`.uasset` CDO loading.** When UE loads a Blueprint class's `.uasset` and constructs the CDO, `Transient` properties are skipped. Editor-configured defaults stored in the asset never make it into the runtime CDO.
- Save-game serialization (the layer most people think of).
- Cooked package loading for the same property data.

It does NOT affect:
- Network replication (that's `Replicated` / `ReplicatedUsing`, separate path).
- BeginPlay execution.
- Constructor / `OnConstruction()` execution — but those run on a CDO that no longer has the defaulted entries, so they iterate an empty array.

## Why the bug is invisible at compile time

A common code shape:

```cpp
// .h
UPROPERTY(EditAnywhere, ReplicatedUsing = OnRep_X, Transient)
TArray<FSomePool> Pools;

// .cpp BeginPlay
for (FSomePool& P : Pools)   // ← iterates EXISTING entries, doesn't add any
{
    P.Health = P.MaxHealth;
}
```

Nothing in C++ ever calls `Pools.Add` / `Emplace` / `SetNum` / etc. The array was meant to be populated **exclusively from BP editor defaults** (a destructible Blueprint, a container Blueprint, etc., each with their own pool list configured in the editor).

When `Transient` is on the property:
- Loader reads BP `.uasset`, sees the `Transient` flag, skips the array.
- Runtime CDO has `Pools.Num() == 0`.
- `BeginPlay`'s reset loop is a no-op (zero iterations).
- Game logic that depends on `Pools` (damage decrement, broadcast on hit) silently does nothing.
- Symptom: things that should break (windows, display cases, breakables gated on this pool system) **never break**.

## How to detect

For any `UPROPERTY(Transient)` you find or are about to add, ask:

1. Is the property `EditAnywhere` / `EditDefaultsOnly`?
2. Are entries (or values) configured via the BP editor defaults UI?
3. Does C++ rely on those values existing at runtime?

If yes-yes-yes, **`Transient` is wrong**. Remove it.

The reverse pattern is fine: `Transient` on a runtime-only cache that's filled by BeginPlay / Tick (e.g., overlap lists, dirty flags, frame counters). Those are exactly what `Transient` is for.

## The rule

Before adding `Transient` to a `UPROPERTY`, articulate WHY in one sentence:

- ✅ "Pure runtime cache; never authored in editor; would corrupt a save if persisted."
- ✅ "This actor IS save-game-serializable and this specific field would inflate the save."
- ❌ "It's a Ludeo-restore field, so it shouldn't compete with save-games." (wrong: `Transient` also drops `.uasset` defaults — and besides, this game probably has no in-mission save-game pipeline at all)
- ❌ "I want BeginPlay to skip this field." (wrong: `Transient` doesn't affect BeginPlay)
- ❌ "I want my restore to win over the engine's init." (wrong: sequence the restore after init)

If the WHY doesn't fit the first two, the flag is doing harm.

## Concrete diagnostic

If you suspect a `Transient`-induced empty-array bug, log the array length at the top of `BeginPlay`:

```cpp
UE_LOG(LogTemp, Warning, TEXT("%s::BeginPlay: %d entries"), *GetClass()->GetName(), MyArray.Num());
```

If the count is 0 on a BP that visibly has entries authored in the editor, `Transient` is dropping them.

## Cross-reference

- `onrep-invariants-must-be-preserved-by-restore.md` — the legitimate mechanism that DOES make replay-restore work (per-element copy + OnRep re-fire).
- `verify-actual-engine-serialization-path-before-decorating.md` — sibling lesson: don't add UPROPERTY decorators based on guesses about what they do.
