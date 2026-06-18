---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: 6
question: "Do you need to use UE's debug camera (or any UCheatManager exec command) in shipping for runtime diagnosis? If yes, are you aware that force-spawning the cheat manager isn't sufficient because the methods themselves are gated `#if !UE_BUILD_SHIPPING`?"
sanitized: true
---

# UE_WITH_CHEAT_MANAGER + UE_BUILD_SHIPPING gates make debug camera unavailable in shipping even if cheat manager spawns

## Precondition

Applies whenever:

1. You're working on a packaged Shipping build of an Unreal project, AND
2. You want to use the engine's debug camera (`ToggleDebugCamera`, `EnableDebugCamera`), or any other `UCheatManager` exec command, for runtime diagnostics.

## The trap

Two separate gates have to be opened:

### Gate 1: cheat manager spawning

Default `APlayerController::AddCheats()` only spawns the cheat manager in non-shipping or when `AllowCheats()` returns true (Standalone game mode + authority). In a packaged shipping client, neither holds, so the cheat manager simply doesn't spawn.

Common workaround: override `AddCheats(bForce)` and call `Super::AddCheats(true)` in shipping under your own define (e.g., `LUDEO_OFFLINE_MODE`, `ALLOW_CHEAT_MANAGER_IN_SHIPPING`). After this, the cheat manager *exists* in shipping. **You may think you're done.**

### Gate 2: the methods themselves

`Engine/Source/Runtime/Engine/Private/CheatManager.cpp`:

```cpp
void UCheatManager::ToggleDebugCamera()
{
#if !UE_BUILD_SHIPPING
    // ...
    EnableDebugCamera();
#endif
}

void UCheatManager::EnableDebugCamera()
{
#if !UE_BUILD_SHIPPING
    // ...
#endif
}
```

In shipping, **both functions compile to empty stubs**. The cheat manager exists, the input binding to its key fires the function, the function returns immediately doing nothing. You see no debug camera. You think the binding is broken or your AddCheats override didn't fire. It did — the call landed in an empty function.

`UE_WITH_CHEAT_MANAGER` (defined in `Engine/Source/Runtime/Engine/Classes/GameFramework/CheatManager.h`):

```cpp
#ifndef UE_WITH_CHEAT_MANAGER
#define UE_WITH_CHEAT_MANAGER (1 && !UE_BUILD_SHIPPING)
#endif
```

Same story — defaults off in shipping, gates `UCheatManager::ProcessConsoleExec`'s cheat-routing path.

The engine's debug camera controller (`Engine/Source/Runtime/Engine/Private/DebugCameraController.cpp`) has multiple `#if !(UE_BUILD_SHIPPING || UE_BUILD_TEST)` blocks — the controller class still compiles, but key behaviours don't.

Project-side overrides (e.g. `UGameCheatManager::ToggleDebugCameraAndTeleport`) typically carry their own `#if !UE_BUILD_SHIPPING` gates too, mirroring the engine pattern.

## How to apply

If you need debug camera in shipping for runtime diagnostics:

1. **Define an override macro in `*.Target.cs`** so the engine module can see it:

   ```csharp
   GlobalDefinitions.Add("ALLOW_DEBUGCAMERA_IN_SHIPPING=1");
   ```

   (Don't try to use a module-local `PublicDefinitions.Add` — `Engine` module doesn't depend on yours, so it won't see it. Must be `GlobalDefinitions` in Target.cs.)

2. **Patch the engine `#if !UE_BUILD_SHIPPING` gates** in `CheatManager.cpp` (and `DebugCameraController.cpp` if needed) to `#if !UE_BUILD_SHIPPING || ALLOW_DEBUGCAMERA_IN_SHIPPING`. This is an engine-source edit; only feasible if you're on a source-built Unreal.

3. **Patch project-side overrides** (e.g. `UGameCheatManager::ToggleDebugCameraAndTeleport`) the same way.

4. **Don't override `UE_WITH_CHEAT_MANAGER` blindly to 1**. It gates a lot more than the debug camera (cheat-routing, ProcessConsoleExec exec-function discovery, etc.) and turning it on in shipping has a wider surface area than you typically want. The selective gate above is safer.

## Diagnostic for "I bound the cheat key but nothing happens in shipping"

Quick check chain:

1. Did the cheat manager spawn? Add a log to the `UGameCheatManager` constructor or `InitCheatManager`. If silent → Gate 1 failed.
2. Did the input binding register? Check `SetupInputComponent` is called in shipping. If silent → still Gate 1.
3. Did the binding's handler fire? Add a log at the very top of the bound function. If silent → input dispatch issue.
4. Did the body run? Add a log INSIDE the `#if !UE_BUILD_SHIPPING` block. If silent in shipping but loud in editor → Gate 2 (this learning).

## Reference incident

ActionGame. User asked for debug-camera cheat in shipping to inspect a misplaced mesh. `Cheat_ToggleDebugCameraAndTeleport` was bound to `M`, cheat manager was spawned (via an `AddCheats(true)` override), but pressing M did nothing. Cause: `UGameCheatManager::ToggleDebugCameraAndTeleport` (and the engine's `EnableDebugCamera` it calls into) wrapped in `#if !UE_BUILD_SHIPPING` — empty stubs. Diagnosis stalled until we found the engine-side gate.
