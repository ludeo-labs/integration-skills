---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Don't guess BP setter signatures — list every related UFUNCTION first

## The mistake

When you need to set state on a BP-driven actor via reflection, the natural approach is:

1. Find a function name that looks like the right setter ("SetDoorOpen", "Multicast_SetDoorState", "OnRep_DoorState")
2. Build a parameter buffer based on assumed signature
3. Invoke via `ProcessEvent`

This fails frequently because:
- Function names look like single-bool setters but actually take an enum + bool (`SetDoorOpen(Door, bOpen)` not `SetDoorOpen(bool)`).
- `Multicast_*` UFUNCTIONs called via ProcessEvent don't run their `_Implementation` body (see `engine-quirks/multicast-via-processevent-bypasses-rpc.md`).
- `OnRep_*` UFUNCTIONs may require the actual old value as parameter; zeroed buffer produces silent no-ops.
- BP-defined setter semantics may be inverted relative to the name (e.g., `SetDoorOpen(true)` could close the door if the BP graph has unexpected logic).

The result: hours spent debugging silent no-ops, mis-attributing failures to "the cascade not firing" when actually the setter call was wrong.

## The fix: dump signatures first

Build a `Ludeo.ListFunctions <ClassSubstring> <NameSubstring>` cheat command that walks every UFUNCTION on a class and shows the full signature:

```cpp
for (TFieldIterator<UFunction> FuncIt(Actor->GetClass()); FuncIt; ++FuncIt)
{
    UFunction* Func = *FuncIt;
    if (!Func->GetName().Contains(NameSubstr)) continue;

    FString Params, Flags;
    for (TFieldIterator<FProperty> PIt(Func); PIt; ++PIt)
    {
        if (!PIt->HasAnyPropertyFlags(CPF_Parm)) continue;
        if (!Params.IsEmpty()) Params += TEXT(", ");
        Params += FString::Printf(TEXT("%s %s"), *PIt->GetCPPType(), *PIt->GetName());
    }
    if (Func->FunctionFlags & FUNC_BlueprintCallable) Flags += TEXT("BPCallable ");
    if (Func->FunctionFlags & FUNC_NetMulticast)      Flags += TEXT("Multicast ");
    if (Func->FunctionFlags & FUNC_BlueprintAuthorityOnly) Flags += TEXT("AuthOnly ");

    UE_LOG(LogX, Log, TEXT("  [%s] %s(%s)"), *Flags, *Func->GetName(), *Params);
}
```

Illustrative output for an aerial-vehicle door's state functions (neutralized):

```
[BPEvent]                       void ReceiveOnDoorStateChanged(EAerialVehicleDoor Door, bool bIsDoorOpen)
[BPCallable AuthOnly]           void SetDoorState(uint8 NewState)
[BPCallable AuthOnly]           void SetDoorOpen(EAerialVehicleDoor Door, bool bOpen)
[]                              void OnRep_DoorState(uint8 OldState)
[Net Multicast Reliable]        void Multicast_SetDoorState(uint8 NewState)
```

This tells you immediately:
- `SetDoorOpen` takes TWO params (enum + bool), not one — single-arg calls misinterpret the bool as the enum
- `SetDoorState` is server-side authority-only with a uint8 (bitmask)
- `OnRep_DoorState` has an old-value parameter (uint8)
- `Multicast_SetDoorState` is a NetMulticast which may not fire via ProcessEvent
- `ReceiveOnDoorStateChanged` is the BP event the animation graph subscribes to

Now you can experiment in editor with concrete signatures via a complementary `Ludeo.InvokeSetter <Class> <Function> [Args...]` cheat that parses args into the function's parameter slots and calls ProcessEvent. Visual feedback confirms which setter actually moves state.

## Why guessing is so common

The BP authoring convention strongly suggests "setters do what their name says." For simple setters that's true. For state-machine setters in shipping game code, the name often hides:
- Multiple parameters (door enum picks which door, bool is open/close)
- Conditional dispatch (calls Multicast variant if server, OnRep if client)
- Inverted semantics (BP graph reads the bool differently than the name suggests)

Without listing signatures, you assume the simple case and waste cycles debugging the complex case.

## How to apply

1. Build `Ludeo.ListFunctions` and `Ludeo.InvokeSetter` cheats as part of any reflection-based restore work.
2. **Before writing restore code that calls a UFUNCTION**, run `ListFunctions` on the target class with the relevant name substring. Note the actual signatures.
3. **Before committing to a setter in restore code**, run `InvokeSetter` in editor with the candidate values and verify the visual change matches expectation.
4. Document the chosen setter + its signature in code comments, so future developers know why this specific function was picked.

The cost is one cheat-command implementation pair (~150 LOC). The value is avoiding hours of "the call succeeded but nothing happens" debugging.
