---
category: save-systems
tier: universal
sourceGame: FPSGameStarterKit
phase: 4
question: null
sanitized: true
---

# Weapon/inventory restore uses manual class-path writes + BP function calls via ProcessEvent

## The Problem

`ULudeoSaveGameManager::SaveWorld()` cannot handle UObject references (weapon actors in `UT_Inventory`, `EquippedWeapon`). Writing an unregistered UObject reference triggers `check(false)` in `WritableObject.WriteData(Name, Object, ObjectMap)` because the weapon actor isn't in the ObjectMap.

Registering weapon actors as writable objects is complex (multiple weapon classes, spawn lifecycle, per-weapon properties) and not worth the effort when only the weapon SET matters.

## The Solution: Hybrid manual writes

### Creator Flow (capture)

After `SaveWorld()` and the manual Transform writes, for the player character only:

1. Read `UT_Inventory` (TArray) via `FArrayProperty` + `FScriptArrayHelper` reflection
2. Write `WeaponCount` (int32), `Weapon_0..N` (FString class paths) via `WritableObj.WriteData()`
3. Find `EquippedWeaponIndex` by comparing `EquippedWeapon` pointer against `UT_Inventory` slots
4. Write `EquippedWeaponIndex` (int32)

### Player Flow (restore)

After `RestoreWorld()` and the manual Transform restore:

1. Read `WeaponCount` and `EquippedWeaponIndex` from readable object
2. For each weapon slot: read `Weapon_N` class path → `StaticLoadClass` → `World->SpawnActor` → call `AddWeapon(WeaponActor)` via `ProcessEvent`
3. After all weapons added: call `EquipWeapon(EquippedIndex)` via `ProcessEvent`

### BP function invocation pattern

```cpp
UFunction* Func = Actor->FindFunction(TEXT("AddWeapon"));
uint8* ParamBuffer = (uint8*)FMemory_Alloca(Func->ParmsSize);
FMemory::Memzero(ParamBuffer, Func->ParmsSize);

for (TFieldIterator<FProperty> ParamIt(Func); ParamIt; ++ParamIt)
{
    // Only exclude CPF_ReturnParm — NOT CPF_OutParm (see bp-pass-by-ref-has-cpf-outparm.md)
    if (ParamIt->HasAnyPropertyFlags(CPF_Parm) && !ParamIt->HasAnyPropertyFlags(CPF_ReturnParm))
    {
        if (FObjectPropertyBase* ObjParam = CastField<FObjectPropertyBase>(*ParamIt))
        {
            ObjParam->SetObjectPropertyValue(ParamBuffer + ObjParam->GetOffset_ForInternal(), WeaponActor);
            break;
        }
    }
}
Actor->ProcessEvent(Func, ParamBuffer);
```

## Why This Works

- `WritableObj.WriteData("Weapon_0", FString)` uses native string serialization — no property filter involved
- `SpawnActor` + `ProcessEvent(AddWeapon)` uses the game's own Blueprint inventory logic (attaches mesh, registers in array, sets up animations)
- Only the class path is stored, not per-weapon state (ammo, etc.) — sufficient for a playable Ludeo

## Related

- `saveworld-cannot-write-positions.md` — same hybrid pattern for Transform
- `bp-pass-by-ref-has-cpf-outparm.md` — critical CPF flag gotcha for ProcessEvent param setup
- `sdk-asserts-on-unregistered-object-refs.md` — why SaveWorld can't handle weapon UObject refs
