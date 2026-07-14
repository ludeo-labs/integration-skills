---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Entities must be added to TrackedEntities in Player Flow for kill detection

## Problem

`DetectKillActions` iterates `TrackedEntities` to check alive transitions. In Creator Flow, entities are added by `DiscoverAndRegisterEntities` + `OnActorSpawned`. But in Player Flow, `CreateWritableObjects` is skipped (no writable objects needed), so `TrackedEntities` stays empty. Kill actions never fire because there's nothing to detect.

## Fix

After spawning/matching each entity in `ReadAndApplyState`, add it to `TrackedEntities` (without a WritableObject):

```cpp
FLudeoTrackedEntity Entity;
Entity.Actor = SpawnedActor;
Entity.ObjectType = ObjType;
TrackedEntities.Add(MoveTemp(Entity));
```

Also subscribe to `World->AddOnActorSpawnedHandler` at the end of `ReadAndApplyState` for enemies spawned by the combat manager during Player Flow gameplay.

The `OnActorSpawned` handler must NOT have a `if (bIsPlayerFlow) return;` guard — it needs to track entities in both flows. In Player Flow, skip writable object creation but still add to `TrackedEntities`.
