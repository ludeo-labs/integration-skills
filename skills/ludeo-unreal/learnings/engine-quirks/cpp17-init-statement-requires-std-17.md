---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Does the target's .Target.cs set CppStandard = CppStandardVersion.Cpp17 (or Cpp20)? If not, avoid C++17-only syntax."
sanitized: true
---

# C++17 init-statements fail on default UE4 toolchain

## Precondition

This applies when:
- The target is UE4 (or an older UE5 branch) with `Target.CppStandard` unset or set to `Default`.
- The MSVC toolchain compiles with the C++14 language level (observed on VS 2022 14.50 / MSVC 14.50.35717 against a ActionGame UE4 source build).

## Problem

This syntax is C++17 only:

```cpp
if (const AMatchGameState* GS = World->GetGameState<AMatchGameState>();
    GS && GS->bSkipSetupPhase)
{
    // ...
}
```

MSVC on a C++14 target emits:

```
error C2429: language feature 'init-statements in if/switch' requires compiler flag '/std:c++17'
```

UE automatically enables C++17 on newer targets, but not on older UE4 source builds. The compile failure surfaces only on the one translation unit that uses the syntax — it's easy to write this in one patch and get bitten at compile time.

## Mitigation

Split the declaration and the condition:

```cpp
const UWorld* World = Character->GetWorld();
const AMatchGameState* GS = World ? World->GetGameState<AMatchGameState>() : nullptr;
if (GS && GS->bSkipSetupPhase)
{
    // ...
}
```

Verbose but works on C++14.

## How to apply

During any Ludeo engine patch (Stage 2+), check `Source/<TargetName>.Target.cs` for:

```csharp
CppStandard = CppStandardVersion.Cpp17;
```

If absent (or set to `Default` on an older engine), avoid C++17 syntax:
- `if/switch` with init-statement
- Structured bindings outside simple uses
- `std::optional`, `std::variant` (usually not available anyway in UE)
- `[[nodiscard]]` on UE-generated code paths

If you write such code accidentally, the compile-fix loop catches it — just split the statement. But knowing upfront avoids the detour.
