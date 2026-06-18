---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# `RegisterEntity` / `CreateObject` must write all readable attributes synchronously — deferring to the next tick crashes on replay

## The Mistake

```cpp
void RegisterEntity(AActor* Actor, ...)
{
    FLudeoRoomWriterCreateObjectParameters Params;
    Params.Object = Actor;
    Params.ObjectType = ObjectType;

    auto Result = Room->GetRoomWriter().CreateObject(Params);  // object exists in SDK schema NOW
    // ... no WriteData calls here ...
    TrackedEntities.Add(...);
    // Attributes will be written on the next WriteTrackedState tick.
}
```

Per-tick `WriteTrackedState` is then expected to write Transform, ClassPath, etc. on the object. This usually works.

But if the Ludeo cloud snapshots a frame **between** the `CreateObject` call and the next `WriteTrackedState` tick, the snapshot contains the object metadata (it's in the schema) but **no attribute values**. On replay, `ReadData(FString)` for any of those attributes hard-asserts:

```
Assertion failed: bHasGetSize
[File: Plugins/LudeoUESDK/.../LudeoReadableObject.cpp] [Line: 362]
```

In ActionGame this manifested when the player placed a deployable mid-mission, the `OnActorSpawned` handler called `RegisterEntity`, and the cloud picked a frame within ~1 frame of registration — before the next per-tick write got a chance.

## Why This Is Different from "Always Write Attributes You'll Read"

The existing learning `sdk-readdata-asserts-on-missing-attribute.md` says: always WriteData attributes you'll later ReadData, even if empty. That covers the case where `WriteData` is conditionally skipped.

This learning covers a different case: `WriteData` is unconditional in `WriteTrackedState`, but there's a temporal gap between `CreateObject` (object becomes queryable) and the first `WriteTrackedState` tick (data gets written). If the cloud snapshots in that gap, replay crashes.

## The Rule

**Inside `RegisterEntity` (or wherever you call `CreateObject`), immediately write all attributes that the read-side code reads.** At minimum:

- `Transform` — every entity has one.
- `ClassPath` — every transient-spawnable entity needs one for the read-side `SpawnEntityFromClassPath` to work.
- Any per-type state attributes (e.g., burn state, captive state, runtime state).

Pattern:

```cpp
void RegisterEntity(AActor* Actor, const FString& ObjectType, ...)
{
    auto Result = Room->GetRoomWriter().CreateObject(Params);
    if (!Result.IsSuccessful()) return;

    FLudeoTrackedEntity Entity;
    Entity.WritableObj.Emplace(Result.GetValue());
    // ... fill other Entity fields ...

    // Initial write — close the registration-without-write window
    if (IsTransientSpawnable(ObjectType))
    {
        const FLudeoWritableObject& Obj = Entity.WritableObj.GetValue();
        FScopedLudeoDataReadWriteEnterObjectGuard<FLudeoWritableObject> Guard(Obj);
        if (Guard.HasEnteredObject())
        {
            Obj.WriteData(LudeoAttr::Transform, Actor->GetActorTransform());
            Obj.WriteData(LudeoAttr::ClassPath, Actor->GetClass()->GetPathName());
            // + any per-type state attributes
        }
    }

    TrackedEntities.Add(MoveTemp(Entity));
}
```

## When This Bites Hardest

- Mid-mission entity registrations via `OnActorSpawned` (low ratio of registration to write ticks).
- Game classes that the cloud's interesting-frame ranker tends to pick around.
- Entities that go through `WriteCharacterState` (which has internal early-out conditions) instead of the explicit Transform-and-ClassPath branch — those can have additional skip windows.

## Detection before release

For every entity type your integration registers:
- Find the `CreateObject` call.
- Find the corresponding `WriteData` calls in `WriteTrackedState` (or wherever per-tick writes happen).
- Mirror the WriteData calls inside `RegisterEntity` immediately after `CreateObject`.
- If you can't run them inside RegisterEntity (need actor state not yet ready), at least flag the entity as "needs initial write" so the next tick prioritizes it before anything else.

## Cross-reference

- `sdk-readdata-asserts-on-missing-attribute.md` — the related "always write conditionally" learning. This is the temporal cousin.
- `cold-spawned-actors-need-explicit-state-restore-for-cosmetics.md` — pairs with this for the read-side restore pattern.
