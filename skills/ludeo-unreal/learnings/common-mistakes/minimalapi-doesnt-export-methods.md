---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# `UCLASS(MinimalAPI)` exports the class — NOT individual methods. Linker errors at the plugin boundary.

## The Mistake

Added `MinimalAPI` to several engine classes so the plugin could `TActorIterator<>`, `Cast<>`, and call methods on them:

```cpp
// ASecurityCameraActor.h — engine
UCLASS(MinimalAPI)
class ASecurityCameraActor : public AActor
{
    void SetCameraState(ECameraState NewState);  // unexported
};
```

Plugin code:

```cpp
// ActionGameLudeoComponent
for (TActorIterator<ASecurityCameraActor> It(World); It; ++It)
{
    It->SetCameraState(static_cast<ECameraState>(*StateRaw));  // boom
}
```

The plugin compiles fine. UHT is happy. Then **link** fails:

```
error LNK2019: unresolved external symbol
"public: void __cdecl ASecurityCameraActor::SetCameraState(enum ECameraState)"
```

## Why It Fails

`MinimalAPI` exports only the **class metadata**:
- The vtable
- `StaticClass()`
- The reflection registration

That is enough for `Cast<>`, `TActorIterator<>`, `FindComponentByClass<>`, and reading reflected `UPROPERTY` values. It is **not** enough to call individual member functions across module boundaries.

Each method you want to invoke from another module needs its own `<MODULE>_API` macro on the declaration:

```cpp
UCLASS(MinimalAPI)
class ASecurityCameraActor : public AActor
{
    GAME_API void SetCameraState(ECameraState NewState);  // ← now exported
};
```

`FORCEINLINE` methods defined entirely in the header are exempt — they get compiled directly into the calling module so there's nothing to link.

## The Rule

**Per-method `<MODULE>_API` on every method the plugin calls on a `MinimalAPI` class.** If you find yourself iterating an engine class and calling 5 methods on it, you need 5 method-level decorations.

The cost is one symbol per method exported in the engine DLL — negligible. The benefit is the plugin actually links.

## Detection before release

After adding `MinimalAPI` to a class:
1. Grep the plugin for every method-call site on that class.
2. For each method called, find its declaration in the engine header.
3. If the method body is in a `.cpp` file (not `FORCEINLINE` in the header), add `<MODULE>_API` to the declaration.

Don't wait for the linker to tell you — UHT/compile pass green-lights this and the link phase comes minutes later.

## Pattern: gate the export with the integration flag (or don't)

For methods you added solely for the integration (e.g., a `Ludeo_*` helper), you can gate the export:

```cpp
#if LUDEO_OFFLINE_MODE
GAME_API void Ludeo_ApplyDamagePools(const TArray<FDamagePool>&);
#endif
```

For pre-existing methods (e.g., `SetCameraState`), the export is unconditional and that's fine. Adding an export to an existing public method has near-zero blast radius — you're just making available across modules what's already callable in-module.

## Anti-pattern

Adding `MinimalAPI` and assuming you're done. Always check the call sites the same session — the linker's silence during compile-only builds is a trap.

## Cross-reference

- `unexported-class-escape-hatches.md` — when to reach for `MinimalAPI` vs library wrappers vs gameplay tags vs exported parents.
- `define-ue-api-breaks-non-minimal-classes.md` — macro conflicts when an existing method has explicit `*_API` decoration on a class that wasn't `MinimalAPI`.
- `uclass-cannot-be-preprocessor-gated.md` — the `MinimalAPI` decoration itself cannot be `#if`-gated; method-level `<MODULE>_API` calls can.
