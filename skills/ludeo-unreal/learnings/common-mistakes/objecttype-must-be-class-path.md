---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 3
question: null
sanitized: true
---

# ObjectType on writable objects must be a resolvable class path — not a custom label

## The Mistake

Setting `FLudeoRoomWriterCreateObjectParameters::ObjectType` to a custom label like `"GameMetadata"` instead of leaving it empty (which defaults to `Object->GetClass()->GetPathName()`).

## Why It Crashes

During Player Flow, `RestoreWorld` iterates every stored readable object and calls `FLudeoObjectTypeDictionary::GetClass(ObjectType)` which does:

```cpp
TSoftClassPtr<UObject> ObjectClassLoader(ObjectType);
ObjectClass = ObjectClassLoader.LoadSynchronous();
check(ObjectClass != nullptr);  // ← crashes when ObjectType is "GameMetadata"
```

`TSoftClassPtr<UObject>("GameMetadata")` cannot resolve to a class → returns null → assert.

## Why It Works In Creator Flow

Creator Flow never calls `RestoreWorld` or `LoadClass`. The custom label is stored and written successfully — the crash only surfaces during Player Flow read-back.

## Prevention

**Never set `ObjectType` to a custom label.** Leave it empty — the SDK defaults to `Object->GetClass()->GetPathName()`, which is always a valid resolvable class path.

If you need to identify an object as "GameMetadata" during read-back, match by class type instead:
```cpp
const TSubclassOf<UObject> ResolvedClass = TSoftClassPtr<UObject>(Obj.GetObjectType()).LoadSynchronous();
if (ResolvedClass && ResolvedClass->IsChildOf(AGameStateBase::StaticClass()))
{
    // This is the GameMetadata anchor
}
```

## Related

This is specific to the `ronen/lyra_and_ue57_int` SDK branch's `ULudeoSaveGameManager` API. The assert is at `LudeoSaveSystemCommon.cpp:24`.
