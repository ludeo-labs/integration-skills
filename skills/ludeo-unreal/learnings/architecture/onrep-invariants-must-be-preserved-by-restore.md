---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 5
question: "When the integration restores replicated state through an `OnRep_X` broadcast helper, what invariants does the engine's existing OnRep code assume about the array/map shape — and does the restore preserve them?"
sanitized: true
---

# `OnRep_X` may assume invariants — preserve them when calling from a restore helper

## Precondition

The integration restores some replicated state by calling (or re-firing) the engine's existing `OnRep_X` callback. The engine's OnRep was originally written for the network-replication path, where data structure SHAPE is fixed and only VALUES change between replications. A restore helper that replaces the array wholesale can violate that assumption.

## The Trap

`UDestructibleComponent::OnRep_DamagePools` (shape illustrated with neutral names):

```cpp
void UDestructibleComponent::OnRep_DamagePools(const TArray<FDamagePool>& OldDamagePool)
{
    check(OldDamagePool.Num() == DamagePools.Num());  // ← engine invariant
    for (FDamagePool& DamagePool : DamagePools)
    {
        UActorComponent* PoolComponent = DamagePool.PrimitiveComponent.GetComponent(GetOwner());
        OnDamageHealth.Broadcast(PoolComponent, DamagePool.Health, false, DummyContext);
        OnDamageHits.Broadcast(PoolComponent, DamagePool.Hits, false, DummyContext);
    }
}
```

The check fires because the array's shape (Num and per-element `PrimitiveComponent` references) is data-asset-fixed at BeginPlay. Replication never changes pool count — it only updates Health/Hits per-pool. The OnRep encodes that assumption.

A naive restore:

```cpp
// WRONG — replaces array; if N differs, check fires; even if N matches, you've
// destroyed the per-pool PrimitiveComponent refs the engine set up at BeginPlay.
void Ludeo_ApplyDamagePools_Naive(const TArray<FDamagePool>& InPools)
{
    DamagePools = InPools;
    OnRep_DamagePools(InPools);
}
```

## The Fix

Copy mutable fields per-element. Preserve the array length and per-element refs.
Pass a pre-edit copy of the *current* array as the "old" parameter so OnRep's broadcast loop sees the diff it expects:

```cpp
void Ludeo_ApplyDamagePools(const TArray<FDamagePool>& InPools)
{
    const int32 N = FMath::Min(InPools.Num(), DamagePools.Num());
    TArray<FDamagePool> OldPoolsForOnRep = DamagePools;  // pre-edit snapshot
    for (int32 i = 0; i < N; ++i)
    {
        DamagePools[i].Health      = InPools[i].Health;
        DamagePools[i].Hits        = InPools[i].Hits;
        DamagePools[i].RejectDamage = InPools[i].RejectDamage;
        DamagePools[i].RejectHits   = InPools[i].RejectHits;
        // PrimitiveComponent ref left untouched — was set up at BeginPlay
    }
    OnRep_DamagePools(OldPoolsForOnRep);
}
```

Now: array shape preserved, per-element refs preserved, OnRep's invariant satisfied, broadcast fires with a meaningful diff.

## The Generalizable Rule

When restoring through an existing `OnRep_X`:

1. **Identify what the OnRep assumes.** Read it. Look for `check()` calls, references to per-element pointer fields, or any logic that depends on "the new value should look like a small delta from the old value."
2. **Preserve those invariants.** Don't reshape arrays; don't blank out fields the engine populated outside the replication path; don't pass an `Old` parameter that's identical to `New` if OnRep diffs them.
3. **Pre-snapshot the current state** to pass as the `Old` parameter. The engine OnRep is the source of truth for what "before" should look like.

## Detection before release

For any `OnRep_X` you plan to invoke from a restore helper:

- Read the OnRep body end to end.
- List every `check`, every dereference of a member that isn't in the replicated payload, every comparison with the `Old` parameter.
- For each, verify your restore helper preserves that assumption.

If the OnRep is a one-liner that just broadcasts, this is trivial. If it does cosmetic-rebuild logic that depends on per-element data-asset state, the helper has to be careful.

## Alternative: skip OnRep entirely

If the OnRep does too much, write the restore helper to skip OnRep and broadcast the gameplay-relevant subset directly:

```cpp
void Ludeo_RestoreVisibleState(...)
{
    // assign just the values we want
    // broadcast just the cosmetic delegates we want
    // do NOT call OnRep_X
}
```

This trades "use existing path" for "explicit control." Worth it when the OnRep has rebuild logic that crashes or misbehaves on cold-restore inputs.

## Anti-pattern

Calling OnRep with `Old == New` (you'll skip the broadcast loop entirely if the engine diffs them) or with a default-constructed `Old` (you'll trip every per-element check that compares pre/post structure).

## Cross-reference

- `sdk-readdata-asserts-on-missing-attribute.md` — the SDK side has analogous "check fires on missing input" behavior. Engine OnRep code follows the same defensive-check pattern.
- `expose-hook-via-multicast-not-ufunction.md` — when the OnRep is too tangled to safely re-fire, expose a parallel multicast for the integration.
