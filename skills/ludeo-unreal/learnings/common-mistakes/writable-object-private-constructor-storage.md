---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 4
question: null
sanitized: true
---

# FLudeoWritableObject has a private constructor — cannot be stored in TArray directly

`FLudeoWritableObject` has a private constructor (friend of `FLudeoRoomWriter` only). Attempting to store it in a struct that's default-constructed (e.g., in `TArray<FTrackedEntity>`) causes:

```
error C2280: 'FTrackedEntity::FTrackedEntity(void)': attempting to reference a deleted function
```

**Fix:** Use the SDK's own typedef `FLudeoWritableObject::WritableObjectMapType` which is `TMap<const UObject*, FLudeoWritableObject>`. The map works because `CreateObject()` returns the writable object by value and `TMap::Add` takes it by move.

```cpp
// WRONG — struct with FLudeoWritableObject member in TArray:
struct FTrackedEntity { FLudeoWritableObject WritableObj; ... };
TArray<FTrackedEntity> TrackedEntities; // compile error

// CORRECT — use SDK's map type:
FLudeoWritableObject::WritableObjectMapType WritableObjectMap; // TMap<const UObject*, FLudeoWritableObject>
WritableObjectMap.Add(Actor, Result.GetValue()); // works — moved from CreateObject result
```

Keep entity metadata (type name, flags) in a separate map keyed by the same actor.
