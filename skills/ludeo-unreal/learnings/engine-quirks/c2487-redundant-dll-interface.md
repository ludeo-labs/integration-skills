---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# C2487 — adding GAME_API (or equivalent module-API macro) to a method inside a class-level-exported class

## The error

```
error C2487: 'Foo': member of dll interface class may not be declared with dll interface
```

MSVC rejects per-method DLL export when the containing class is already declared with the module API macro at class scope.

## Right vs wrong

```cpp
// Class is already exported at class scope:
class GAME_API AMissionState : public AMatchGameStateBase
{
    // WRONG — C2487
    GAME_API void Ludeo_Foo(int32 X);

    // RIGHT — no per-method prefix needed; class export covers it
    void Ludeo_Foo(int32 X);
};
```

```cpp
// Class is NOT class-scope exported:
class UTrafficManager : public UObject  // no GAME_API here
{
    // RIGHT — needed for plugin linkage to the method
    GAME_API int32 Ludeo_GetWaveToSpawn() const { return WaveToSpawn; }
};
```

## How to apply

Before adding a module-export macro to a method (e.g., when creating a plugin-callable accessor), grep the class declaration:

```bash
grep -nE "^class\s+\w+_API\s+\w*<TargetClassName>" path/to/header.h
```

If the class line shows a module API macro, **drop the per-method macro**. If it doesn't, **keep the per-method macro**.

## Where it bit on ActionGame

Adding a plugin-callable wave-count setter to `AMissionState` (class is `class GAME_API AMissionState`) with a `GAME_API void Ludeo_Set...` prefix — built fine on adjacent classes (`UTrafficManager`, no class-scope API), failed on `AMissionState`. Burned ~5 min. Same session also touched `AWaveSpawnDirector` which IS class-scope exported (`class GAME_API AWaveSpawnDirector`) — no per-method API needed there either; followed this rule on the second touch.
