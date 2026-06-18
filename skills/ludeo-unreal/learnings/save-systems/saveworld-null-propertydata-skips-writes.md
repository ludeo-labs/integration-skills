---
category: save-systems
tier: universal
sourceGame: FPSGameStarterKit
phase: 4
question: null
sanitized: true
---

# SaveWorld with null ObjectPropertyData silently writes zero attributes

## The Problem

`ULudeoSaveGameManager::SaveWorld()` discovers and registers actors correctly (writable objects appear in the Ludeo JSON with their class paths), but all attribute arrays are empty (`"attributes": []`).

## Root Cause

In `LudeoSaveSystem.cpp` line 1102:
```cpp
if (PropertyFilter != nullptr)
{
    bIsAllDataWrittenSuccessfully &= WritableObject.WriteData(ObjectMap, *PropertyFilter);
}
```

If `PropertyFilter == nullptr`, `WriteData` is **silently skipped**. No error, no log, no warning — just empty objects.

The `PropertyFilter` comes from:
```cpp
const ULudeoObjectPropertyDataBase* PropertyFilter =
    (SaveGameObjectData->ObjectPropertyData != nullptr)
        ? SaveGameObjectData->ObjectPropertyData
        : SaveGameSpecification.DefaultPropertyData;
```

If BOTH `ObjectPropertyData` on the entry AND `DefaultPropertyData` on the spec are null → `PropertyFilter` is null → no data written.

Same issue on the load side at line 524-526 — `LoadData` is also skipped when `PropertyFilter` is null.

## Prevention

Always create and set a `ULudeoObjectPropertyData` with a `ULudeoObjectPropertyMatchCondition_PropertyFlag` filter (CPF_SaveGame):

```cpp
ULudeoObjectPropertyMatchCondition_PropertyFlag* FlagFilter =
    NewObject<ULudeoObjectPropertyMatchCondition_PropertyFlag>(Outer);
FlagFilter->PropertyFlagData.PropertyFlags = static_cast<uint64>(EPropertyFlags::CPF_SaveGame);

ULudeoObjectPropertyData* PropertyData = NewObject<ULudeoObjectPropertyData>(Outer);
PropertyData->PropertyFilter = FlagFilter;

// Set on BOTH the entry AND the spec default:
SaveObjData.ObjectPropertyData = PropertyData;
SaveSpec.DefaultPropertyData = PropertyData;
```

Do NOT leave ObjectPropertyData null and assume the SDK defaults to CPF_SaveGame — it defaults to null.
