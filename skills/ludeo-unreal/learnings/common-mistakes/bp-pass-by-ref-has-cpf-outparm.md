---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 4
question: null
sanitized: true
---

# BP pass-by-reference input params have CPF_OutParm — don't exclude them when finding inputs

## The Mistake

When iterating a UFunction's params via `TFieldIterator<FProperty>` to find the input parameter for `ProcessEvent`, filtering with:
```cpp
if (ParamIt->HasAnyPropertyFlags(CPF_Parm) && !ParamIt->HasAnyPropertyFlags(CPF_OutParm | CPF_ReturnParm))
```

This silently skips ALL Blueprint function input parameters that are object references, because BP compiles pass-by-reference params with `CPF_Parm | CPF_OutParm`.

## Why

Blueprint-generated UFunction params for object inputs (e.g., `AddWeapon(ABP_WeaponBase_C*)`) get flag bits like `0x8001008000394` which includes both `CPF_Parm` (0x80) and `CPF_OutParm` (0x100). The `CPF_OutParm` flag here means "passed by reference" — NOT "this is an output-only parameter". Only `CPF_ReturnParm` (0x400) identifies actual return values.

## Observed flags

From `BP_CharacterBase::AddWeapon`:
- `AddWeapon [ABP_WeaponBase_C*]` flags=`0x8001008000394` — this IS the input param (`CPF_Parm | CPF_OutParm`)
- `IndexOfTheAddedWeapon [int32]` flags=`0x8001040000380` — output (`CPF_Parm | CPF_OutParm`)
- `CallFunc_Array_Add_ReturnValue [int32]` flags=`0x8001040000200` — internal (`CPF_ZeroConstructor`, no `CPF_Parm`)

## The Fix

Only exclude `CPF_ReturnParm`:
```cpp
if (ParamIt->HasAnyPropertyFlags(CPF_Parm) && !ParamIt->HasAnyPropertyFlags(CPF_ReturnParm))
```

To distinguish input from output among `CPF_OutParm` params, match by type: the first `FObjectPropertyBase*` param is the input for weapon functions; the first `FIntProperty*` is the input for equip-by-index functions.

## Symptom

`ProcessEvent` is called with a zeroed param buffer → the BP function receives a null weapon actor → weapon not added to inventory, no crash, just silently ignored.
