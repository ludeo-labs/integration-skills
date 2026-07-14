---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# BP variables are reachable via UE reflection — no BP introspection tool required

## The misconception this corrects

When state lives in a Blueprint variable rather than a C++ UPROPERTY, the natural assumption is "I need a BP introspection tool to read/write it." Common workarounds people reach for:
- Open the BP in the editor and read variables manually (slow, requires editor access)
- Build a custom commandlet that loads BPs and walks them (heavy)
- BP Inspector plugin or similar (requires plugin compatibility with the project)
- Add C++ accessor functions to the parent class (requires engine edit per class)

**These are all unnecessary.** UE's reflection system treats BP variables identically to C++ UPROPERTYs. Every BP variable is generated as a `FProperty` on the BPGC (Blueprint Generated Class) at compile time. The same `TFieldIterator<FProperty>` that iterates C++ class fields also iterates BP class fields.

## Concrete API

For any actor `AActor* SomeActor` (regardless of whether the class is C++ or BP-only):

```cpp
UClass* Cls = SomeActor->GetClass(); // could be a BPGC

// Iterate all properties (C++ and BP both)
for (TFieldIterator<FProperty> It(Cls); It; ++It)
{
    FProperty* Prop = *It;
    FString PropName = Prop->GetName();      // e.g., "DoorState" or "bIsObjectiveActive"
    FString PropType = Prop->GetCPPType();   // e.g., "uint8", "bool", "FName"

    // Read value as string (handles any FProperty type uniformly)
    FString ValueStr;
    const void* Addr = Prop->ContainerPtrToValuePtr<void>(SomeActor);
    Prop->ExportTextItem(ValueStr, Addr, nullptr, SomeActor, PPF_None);

    // Write value from string
    void* WriteAddr = Prop->ContainerPtrToValuePtr<void>(SomeActor);
    Prop->ImportText(*NewValueStr, WriteAddr, PPF_None, SomeActor);
}

// Look up by name
FProperty* Prop = Cls->FindPropertyByName(TEXT("DoorState"));
```

Same API for UFUNCTIONs:

```cpp
for (TFieldIterator<UFunction> FuncIt(Cls); FuncIt; ++FuncIt)
{
    UFunction* Func = *FuncIt;
    FString FuncName = Func->GetName();
    // ... walk Func's parameters via TFieldIterator<FProperty>(Func) ...
}

UFunction* Func = Cls->FindFunctionByName(TEXT("SetDoorOpen"));
SomeActor->ProcessEvent(Func, ParamBuf.GetData());
```

## Naming-case quirks

UE's JSON conversion (e.g., `FJsonObjectConverter::UStructToJsonObject`) emits property names in camelCase: PascalCase `DoorState` becomes `doorState` in JSON output. The underlying UE name is always PascalCase, but if you're matching against JSON keys, account for the case difference. Use case-insensitive comparison (`FCString::Stricmp`) for safety, or iterate properties and match against your expected name.

BP variables whose name starts with `b` followed by uppercase (e.g., `bIsLocked`) follow the same convention — UE keeps the `b` prefix, JSON output strips it (`bIsLocked` becomes `isLocked` in JSON).

## Type representation

BP variable types map to specific `FProperty` subclasses:
- `bool` → `FBoolProperty`
- `int32` → `FIntProperty`
- `uint8` → `FByteProperty`
- BP enum → `FEnumProperty` wrapping `FByteProperty`
- `float` → `FFloatProperty`, `double` → `FDoubleProperty`
- `FString` → `FStrProperty`, `FName` → `FNameProperty`, `FText` → `FTextProperty`
- `FStruct` (any USTRUCT) → `FStructProperty` containing a `UScriptStruct*`
- `TArray<T>` → `FArrayProperty` containing the inner FProperty
- `TMap<K,V>` → `FMapProperty` containing key + value FProperties
- Object reference → `FObjectProperty` (handle with care across sessions — see below)
- BP variable typed as another BP class → `FObjectProperty` referencing the BPGC

For most read/write workflows, you don't need to type-dispatch — `ExportTextItem` and `ImportText` handle the type-specific stringification uniformly.

## Object references across sessions

BP variables that hold `AActor*` or `UObject*` references emit as path strings via `ExportText`. Resolution on the receiving side is path-based:
- **Level-placed actor refs** resolve reliably across sessions (path is stable per `.umap`).
- **Runtime-spawned actor refs** do NOT resolve reliably — the `_C_5` suffix depends on spawn order.

For cross-session restore, expect object refs to need per-case handling: skip them, defer to a second pass after target actors exist, or rebuild from a stable identifier (`BagId`, `PlayerState` etc.).

## When this matters

Any integration that needs to capture/restore arbitrary BP state. The reflection mechanism eliminates the assumption "we need BP introspection tooling" and lets the integration code work on any UE project without requiring the project to enable specific editor-side plugins.

ActionGame integration session validated this against:
- C++ classes (`AGameCharacter` — existing well-understood case)
- BPGC level-scripting actors (a level-scripting actor instance — read its level-state booleans etc.)
- BPGC gameplay actors (an aerial-vehicle Blueprint, a container Blueprint, a door control-panel Blueprint)

Reflection worked uniformly across all of them. No BP introspection plugin or editor commandlet required.

## How to apply

When designing a state capture/restore mechanism: assume BP variables are reachable via reflection. Don't gate on BP-Inspector-style tooling. Use `TFieldIterator<FProperty>` + `ExportTextItem`/`ImportText` as the foundation. This works in editor builds, packaged builds, shipping builds — anywhere UE's reflection database is intact (which is everywhere, including cooked content).
