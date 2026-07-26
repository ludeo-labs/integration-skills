---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# `UCLASS()` and `UPROPERTY()` cannot live inside a custom `#if` block — UHT rejects them

## The Mistake

We wanted an integration-only API export on a class, gated by our `LUDEO_OFFLINE_MODE` preprocessor flag so that production builds saw the class as before:

```cpp
// WRONG — UnrealHeaderTool rejects this
#if LUDEO_OFFLINE_MODE
UCLASS(BlueprintType)
class GAME_API AGameClass : public AActor
#else
UCLASS(BlueprintType)
class AGameClass : public AActor
#endif
{
    GENERATED_BODY()
    ...
};
```

UHT failure:

```
Error: UCLASS must not be inside preprocessor blocks, except for WITH_EDITORONLY_DATA
```

Same error fires for `UPROPERTY()` declarations placed inside arbitrary `#if FOO` blocks. UHT only allows a fixed allow-list of preprocessor symbols (notably `WITH_EDITOR`, `WITH_EDITORONLY_DATA`, `CPP`) — it will not parse user-defined flags.

## Why It Fails

UHT (UnrealHeaderTool) runs a *preprocessor of its own* over headers to discover reflected types. It does not link against the C++ preprocessor's symbol table — it has hardcoded knowledge of a small set of UE-blessed flags. Any other `#if` directive around a `UCLASS` / `UPROPERTY` makes UHT see *two* declarations (one in each branch) or *no* declaration at all, which it treats as a structural error.

## The Rule

**Reflection markers (`UCLASS`, `UPROPERTY`, `UFUNCTION`, `USTRUCT`, `UENUM`) must be declared unconditionally.** If you need conditional behavior, gate the *implementation* (method body, member initializer, included headers, friend declarations) — not the reflection declaration.

```cpp
// RIGHT — reflection unchanged, behavior gated
UCLASS(BlueprintType)
class GAME_API AGameClass : public AActor    // GAME_API always present
{
    GENERATED_BODY()
public:
#if LUDEO_OFFLINE_MODE
    void Ludeo_CaptureSnapshot(...);   // method declaration may be gated — UHT ignores non-UFUNCTION methods
#endif

    UPROPERTY()  // ← must always be visible to UHT
    int32 SomeReflectedField = 0;
};
```

Adding `GAME_API` (or `MinimalAPI`, or `<MODULE>_API`) unconditionally is *cheap*: it's just a `__declspec(dllexport)` / `dllimport` macro. The cost is one extra symbol exported in the DLL — negligible.

## The Cost of Trying to Be Clever

Each iteration of "let me gate this so production isn't affected" produces:
1. A failed UHT run (build error before compile).
2. Wasted time reasoning about why the gate isn't taking.
3. A second iteration where you give up and unconditionally add the API tag — exactly what should have been done first.

If your concern is **production binary size or symbol exposure**, evaluate that separately. For most integrations the answer is "the export is fine, ship it."

## Detection before release

Before adding any `#if` around a UCLASS/UPROPERTY, stop and rewrite as one of:
- Unconditional reflection + gated method bodies
- Unconditional reflection + a `friend` declaration that's only used inside `#if`
- Unconditional reflection + a separate non-reflected helper class that's gated

## Cross-reference

- `define-ue-api-breaks-non-minimal-classes.md` — when adding `MinimalAPI` to a UCLASS, watch for `*_API` macro conflicts.
