---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Instrument compound predicate filters per-predicate before guessing

## The mistake

When a compound `if (A && B && C && D)` rejects everything in a gameplay decision path, debugging by guessing which predicate fails is slow and frequently wrong. Specifically I theorized 3 different causes for "vehicle pump filters out all vehicles" on ActionGame before adding per-predicate diagnostic logs revealed the real cause.

## The rule

Add Warning-level (or equivalent) diagnostic logs that report each predicate's result for each filtered entry. Gate by the project's offline/dev define so retail isn't polluted.

For ActionGame:

```cpp
#if LUDEO_OFFLINE_MODE
for (int32 i = 0; i < WorldSettings->VehicleSpawnSettings.Num(); ++i)
{
    const FVehicleSpawnData& V = WorldSettings->VehicleSpawnSettings[i];
    UE_LOG(LogWaveSpawnDirector, Warning,
        TEXT("Ludeo VehiclePump filter[%d]: enabled=%d paths=%d squads=%d duration=%d (data=%s, %d path(s))"),
        i,
        V.bEnabled ? 1 : 0,
        PathsPredicates(V.Paths) ? 1 : 0,
        AvailableSquadsPredicate(V.VehicleSpawnData) ? 1 : 0,
        EnterDurationPredicate(V) ? 1 : 0,
        V.VehicleSpawnData ? *V.VehicleSpawnData->GetName() : TEXT("<null>"),
        V.Paths.Num());
}
#endif
```

When a predicate is itself compound, deployable in:

```cpp
// PathsPredicates is enabled-AND-unoccupied. Log per-path:
for (const FVehicleSplineData& Path : V.Paths)
{
    UE_LOG(LogWaveSpawnDirector, Warning,
        TEXT("    path[%d]: bStartsEnabled=%d enabledViaArr=%d unoccupied=%d enter=%s exit=%s"),
        ...);
}
```

User runs one replay; the log tells you exactly which predicate on which entry rejected. On ActionGame this immediately revealed `EnabledVehicleSplines` was empty post-restore — the predicate logged `enabledViaArr=0` for every path, fixing 30+ minutes of guesswork in a single replay.

## How to apply

When debugging snapshot-replay where "X is filtered out" or "X early-returns" silently:

1. Find the compound `if`/`FilterByPredicate` in the engine code path.
2. Add diagnostic logs that break it down per-clause AND per-entry (not just "filtered out" at the top level — that's the log we already had, useless for diagnosis).
3. Don't guess the cause from the engine source — let the runtime log tell you.
4. After the cause is identified and fixed, you can leave the diagnostic logs in (they only fire on the failure path, which should be rare post-fix). They're cheap insurance for the next regression.

## Anti-pattern

Diagnostic logs that say "filter rejected entry" without breaking down WHY. Useful as a tripwire that *something* is wrong, useless for telling you what.

## Anti-pattern

Reading 200 lines of engine source to deduce which predicate fails based on captured snapshot fields. Faster to log + replay than to reason from source.
