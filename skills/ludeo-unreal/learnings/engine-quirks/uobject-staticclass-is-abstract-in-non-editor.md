---
name: uobject-staticclass-is-abstract-in-non-editor
description: NewObject<UObject>(Outer, UObject::StaticClass()) succeeds in editor builds but asserts in development / shipping non-editor via FScopedAllowAbstractClassAllocation. Always subclass UObject for an opaque key, or pick a non-abstract concrete class.
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# `UObject::StaticClass()` is abstract outside editor builds

## The trap

```cpp
UObject* Key = NewObject<UObject>(GetTransientPackage(), UObject::StaticClass());
//                                                       ^^^^^^^^^^^^^^^^^^^^^^^
// Works fine in editor. Asserts in shipping / development non-editor.
```

The assert:
```
Assertion failed: GIsEditor || !FScopedAllowAbstractClassAllocation::IsDisallowedAbstractClass(InClass, InFlags)
[File: Engine/Source/Runtime/CoreUObject/Private/UObject/UObjectGlobals.cpp] [Line: 2378]
```

Callstack frame `StaticAllocateObject() → StaticConstructObject_Internal() → your NewObject<UObject>() site`.

## Why

`UObject::StaticClass()` is flagged with `CLASS_Abstract` in non-editor builds. `StaticAllocateObject` gates abstract-class allocation behind `GIsEditor`. PIE/editor lets it through; cooked builds crash hard.

This is **silent in development on a programmer's editor build** — every PIE test, every UnrealEd run, every Editor-target compile passes. The first time it fires is a packaged build, often on QA or production hardware where the dev never repros.

## Workarounds

### 1. Subclass `UObject` for the key type

Cheapest fix when you need an opaque identity UObject:

```cpp
UCLASS()
class UMyIntegrationKey : public UObject
{
    GENERATED_BODY()
};

// ...
UObject* Key = NewObject<UMyIntegrationKey>(GetTransientPackage());  // concrete — safe
```

The subclass needs `UCLASS()` and `GENERATED_BODY()` so UHT generates the metadata. Empty body is fine.

### 2. Use an existing concrete UObject class

`UDataAsset`, `UAssetUserData`, etc. are non-abstract and would compile, but they carry extra semantics (asset-typing, save flags) that may bite later. Avoid unless you have a specific reason.

### 3. Don't allocate a key at all — mutate an existing UObject

Often the cleanest path: instead of inventing a new UObject identifier, find an existing UObject in the system that maps 1:1 to the conceptual entity. For Ludeo this looks like "reuse the actor's existing writable and mutate the data instead of creating a parallel writable on a new key" — see `learnings/common-mistakes/one-writable-per-uobject-key.md` for that pattern.

## When this rule applies

- Any `NewObject<UObject>(...)` or `StaticAllocateObject(UObject::StaticClass(), ...)` call with `UObject::StaticClass()` literally.
- Any `NewObject<T>(...)` where `T` resolves to a class marked `CLASS_Abstract`. `UObject` itself, `UInterface`, etc.
- Editor-time helper code that gets copy-pasted into runtime code — the editor build masks the assertion.

## Detection

The runtime crash is unambiguous (the assert message names `FScopedAllowAbstractClassAllocation::IsDisallowedAbstractClass`). For prevention before runtime: grep your codebase for `NewObject<UObject>` and `UObject::StaticClass()` passed as a class argument. Most legitimate uses pass a `UClass*` resolved at runtime — literal `UObject::StaticClass()` is almost always a bug.

## How we got here

ActionGame Phase 5 (2026-05-14). The integration created a separate Ludeo writable for each dead AI corpse, keyed on a fresh `NewObject<UObject>(GetTransientPackage(), UObject::StaticClass())` to avoid the "one writable per UObject" trap. Compiled clean, ran fine in the editor, crashed in the development non-editor build the moment an AI died. Stack frame `UActionGameLudeoComponent::CreateDeadBodyObject()`. The fix was to drop the separate-writable model entirely and mutate the AI's existing live writable in place — see `learnings/common-mistakes/one-writable-per-uobject-key.md` for that pattern.
