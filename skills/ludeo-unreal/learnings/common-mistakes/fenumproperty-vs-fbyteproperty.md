---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# Strongly-typed `enum class` UPROPERTYs need `FEnumProperty`, not `FByteProperty` — wrong cast silently no-ops

## The Mistake

Reflection-based capture of an `EGameState` (UENUM `enum class : uint8`) member used `FByteProperty`:

```cpp
// WRONG — silently does nothing
FByteProperty* StateProp = FindFProperty<FByteProperty>(ActorClass, TEXT("State"));
if (StateProp)
{
    uint8 RawValue = StateProp->GetPropertyValue(Actor);
    // ... write RawValue
}
```

`StateProp` is always `nullptr` for a `UPROPERTY()` declared as `EGameState State` (a strongly-typed enum). The `if` body never runs. No compile warning, no runtime error — just zero captured state on every gate.

## Why It Silently Fails

UE has two distinct reflection types for enum members:
- `FByteProperty` — represents `UPROPERTY() TEnumAsByte<EFoo> Bar` or raw `UPROPERTY() uint8 Bar` declarations. The legacy way to expose unscoped enums to reflection.
- `FEnumProperty` — represents `UPROPERTY() EFoo Bar` where `EFoo` is a `enum class : <underlying>` with `UENUM()`. The modern way.

`FindFProperty<FByteProperty>(...)` only matches the first kind. For modern strongly-typed enum members it returns `nullptr` and you proceed past the guard with no error.

## The Rule

**For any `UPROPERTY()` that is a strongly-typed enum (`UENUM() enum class Foo : uint8`), use `FEnumProperty`.** Walk both paths via a cascade so legacy and modern declarations both work:

```cpp
// RIGHT — handle both shapes
uint8 RawValue = 0;

if (FEnumProperty* EnumProp = FindFProperty<FEnumProperty>(Cls, TEXT("State")))
{
    void* PropAddr = EnumProp->ContainerPtrToValuePtr<void>(Actor);
    RawValue = static_cast<uint8>(EnumProp->GetUnderlyingProperty()->GetSignedIntPropertyValue(PropAddr));
}
else if (FByteProperty* ByteProp = FindFProperty<FByteProperty>(Cls, TEXT("State")))
{
    RawValue = ByteProp->GetPropertyValue_InContainer(Actor);
}
else
{
    UE_LOG(LogX, Warning, TEXT("State property not found via reflection"));
}
```

Note that `FEnumProperty` exposes the underlying numeric type via `GetUnderlyingProperty()`. The cast through `GetSignedIntPropertyValue` works for `uint8`, `int32`, etc.

## Detection before release

Property dump the target class once, eyeball the type:

```cpp
for (TFieldIterator<FProperty> It(Cls); It; ++It)
{
    UE_LOG(LogX, Log, TEXT("%s : %s"), *It->GetName(), *It->GetClass()->GetName());
}
```

If you see `State : EnumProperty`, you must use `FEnumProperty`. If you see `State : ByteProperty`, `FByteProperty` is correct.

## Cross-reference

- `property-dump-before-reflection.md` — never write reflection code from intuition; always dump the actual property types first.
