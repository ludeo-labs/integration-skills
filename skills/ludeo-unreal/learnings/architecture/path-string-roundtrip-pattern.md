---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Path-string round-trip pattern for capturing TArray<UObject*> across replay

## The pattern

To capture/restore an array of `UObject*` pointers (asset references, level-placed actors, classes) across Ludeo replay sessions:

**Capture side:**
```cpp
TArray<FString> Paths;
Paths.Reset(SourceArray.Num());
for (const UObject* Obj : SourceArray)
{
    Paths.Add(Obj ? Obj->GetPathName() : FString());  // Empty string for nullptr
}
```

**Restore side (assets — `UDataAsset`, `UClass`):**
```cpp
DestArray.Reset();
for (const FString& Path : Paths)
{
    if (Path.IsEmpty()) continue;
    if (UDataAsset* Asset = LoadObject<UDataAsset>(nullptr, *Path))   // or StaticLoadClass
    {
        DestArray.Add(Asset);
    }
}
```

**Restore side (level-placed actors — `AActor` instances):**
```cpp
DestArray.Reset();
for (const FString& Path : Paths)
{
    if (Path.IsEmpty()) continue;
    if (AActor* Actor = FindObject<AActor>(nullptr, *Path))   // NOT LoadObject — actors are loaded with the level
    {
        DestArray.AddUnique(Actor);
    }
}
```

**For parallel arrays (struct-of-arrays):** capture each field as its own path array; restore in lockstep with `FMath::Min(...)` of the parallel arrays' lengths to handle truncation safely.

## Critical distinctions

- **`LoadObject<>` for assets** (`UDataAsset`, `UClass`, anything that isn't an `AActor` instance). `StaticLoadClass` is `LoadObject` for class types.
- **`FindObject<>` for `AActor` instances**. The actor is loaded with its containing level — we just look it up by name. `LoadObject` on an actor path technically works in some cases but `FindObject` is the right intent.
- **Drop on resolution failure.** `Path.IsEmpty()` (nullptr at capture) and `if (!Resolved) continue` (asset/actor moved or renamed) — never push nullptr into the destination array, gameplay code assumes non-null.
- **Empty string sentinels for nullable optional pointers.** ActionGame vehicle requests have an optional `ExitSpline` (nullable per engine `check`). Capture as `""`, on restore allow null in destination.

## Use cases on ActionGame (the wave-spawn director)

| Source | Path target | Restore API |
|---|---|---|
| `Reservations[i].Order` (UClass*) | `Reservation_OrderPaths` | `StaticLoadClass(UAISquadOrder::StaticClass(), nullptr, *Path)` |
| `VehicleSpawnRequests[i].SpawnData` (UDataAsset*) | `VehicleRequest_DataPaths` | `LoadObject<UVehicleSpawnerData>(nullptr, *Path)` |
| `VehicleSpawnRequests[i].EnterSpline` (AActor*) | `VehicleRequest_EnterSplinePaths` | `FindObject<ASplineActor>(nullptr, *Path)` |
| `EnabledVehicleSplines[i]` (AActor*) | `EnabledVehicleSpline_Paths` | `FindObject<ASplineActor>(nullptr, *Path)` |
| `OccupiedVehicleSplines[i]` (AActor*) | `OccupiedVehicleSpline_Paths` | `FindObject<ASplineActor>(nullptr, *Path)` |

## Plugin/SDK side

On the plugin side, marshal the `TArray<FString>` snapshot field into a JSON array of strings via `FJsonSerializer::Serialize`. Restore by `Deserialize` and pushing each `TryGetString` result into the snapshot field BEFORE calling `Ludeo_RestoreSnapshot`. Add the array to the structural fingerprint so dedup invalidates correctly when contents change.

## How to apply

Whenever you encounter `TArray<UObject*>` or `TArray<AActor*>` runtime state on the manager/component being snapshotted:
1. Identify whether elements are assets (load via path) or level-placed actors (find via path).
2. Capture as `TArray<FString>` of `GetPathName()` values.
3. Restore via the appropriate `LoadObject` / `FindObject` / `StaticLoadClass` call, drop on failure.
4. Use parallel `TArray<FString>` for struct-of-array data instead of trying to serialize arbitrary structs.
