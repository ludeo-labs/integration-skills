---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Direct field assignment in snapshot restore can bypass setter side effects

## The mistake

In `Ludeo_RestoreSnapshot`, restoring a member via direct field assignment when in normal gameplay that field is only ever written by a setter that also does meaningful work:

```cpp
// Bug: bypasses SetProgressionIndex which also populates CachedSpawnOrders
CurrentProgressionIndex = S.CurrentProgressionIndex;
```

Symptom on ActionGame: post-restore the wave-spawn director had `CurrentProgressionIndex = 3` (correct) but `CachedSpawnOrders.Num() = 0` (stale empty). `SelectOrder()` iterates `CachedSpawnOrders` and returns nullptr, so no squads ever spawn. Looked like the wave just died.

## Why it's easy to miss

The field assignment compiles, runs, and produces the right value when you query the field. The bug only manifests in code paths that consume *derived* state (caches, broadcasts, side-table updates) computed by the setter. Without a code-reading pass on the setter, you don't realize the side effects exist.

## The rule

Whenever you restore a field by direct assignment, **read the corresponding setter** and check whether it does anything beyond setting the field:
- Updates a cached array derived from the field?
- Calls a broadcast / delegate?
- Updates a side table?
- Triggers a network replication?

If yes, mirror those side effects in the restore (or call the setter, if its other side effects are safe in restore context).

For ActionGame the fix was to mirror the cache refresh in `Ludeo_RestoreSnapshot`:

```cpp
CurrentProgressionIndex = S.CurrentProgressionIndex;
// SetProgressionIndex normally does this; bypassing it left the cache empty.
if (DifficultySettings && DifficultySettings->ProgressionArray.IsValidIndex(CurrentProgressionIndex))
{
    const TArray<FSpawnSquad>& Squads = DifficultySettings->ProgressionArray[CurrentProgressionIndex].SquadArray;
    CachedSpawnOrders     = GetSquadOrders(Squads);
    CachedOrderlessSquads = GetOrderlessSquads(Squads);
}
```

We deliberately skipped `OnProgressionIndexChangedDelegate.Broadcast()` because the listeners shouldn't react to a Ludeo restore. That's a judgment call — read each side effect, decide whether it's safe.

## How to apply

Audit every direct-assignment line in `Ludeo_RestoreSnapshot` (and any equivalent restore path):

```bash
grep -nE "^\s+\w+\s+= S\." WaveSpawnDirector.cpp
```

For each match, find the corresponding setter (`Set<FieldName>` or similar) and verify it doesn't have side effects that gameplay depends on. If it does, either call the setter or mirror the side effect inline.
