---
category: architecture
tier: generalizable
sourceGame: Lyra
phase: 4
question: "Does Player Flow need to call an exported game API (e.g. StartPhase) whose parameter is a TSubclassOf<SomeUnexportedAbilityType>? If so, add a UClass*-taking wrapper in the GAME module instead of constructing the TSubclassOf in the plugin."
sanitized: true
---

# Passing an unexported ability/class to an exported `StartPhase`-style API from a plugin

## Precondition

You must call an **exported** game API from the integration plugin, but its parameter is a
`TSubclassOf<T>` where `T` is **not** module-API-exported (the class is `UCLASS()` / `UCLASS(Abstract)`
with no API macro). Example: a game-phase subsystem exposes
`void StartPhase(TSubclassOf<UGamePhaseAbility>)` (the subsystem class is exported) but
`UGamePhaseAbility` itself is not exported.

## The trap

`StartPhase` is callable (exported), so it looks fine. But to *call* it you have to build the
argument:

```cpp
UClass* Loaded = StaticLoadClass(UObject::StaticClass(), nullptr, TEXT("/Plugin/.../Phase_Playing_C"));
PhaseSub->StartPhase(TSubclassOf<UGamePhaseAbility>(Loaded));   // <-- linker error
```

`TSubclassOf<UGamePhaseAbility>`'s constructor/assignment does a checked
`IsChildOf(UGamePhaseAbility::StaticClass())`, and `StaticClass()` of a non-exported `UCLASS()` is
**not** exported across the module boundary → unresolved external at link. You cannot name the type
in the plugin at all without dragging in its `StaticClass()`.

## Fix: add a `UClass*`-taking wrapper in the GAME module

Put a thin wrapper next to the exported API, **inside the game module** where `StaticClass()` is
available, and export the wrapper:

```cpp
// Game module header (exported):
void StartPhaseByClass(UClass* PhaseAbilityClass);

// Game module .cpp:
void U<Game>GamePhaseSubsystem::StartPhaseByClass(UClass* PhaseAbilityClass)
{
    if (PhaseAbilityClass && PhaseAbilityClass->IsChildOf(U<Game>GamePhaseAbility::StaticClass()))
    {
        StartPhase(TSubclassOf<U<Game>GamePhaseAbility>(PhaseAbilityClass)); // checked here, in-module
    }
}
```

The plugin then loads the BP class as a bare `UClass*` and calls the wrapper — never naming the
unexported type:

```cpp
UClass* Playing = StaticLoadClass(UObject::StaticClass(), nullptr, TEXT("/.../Phase_Playing.Phase_Playing_C"));
PhaseSub->StartPhaseByClass(Playing);
```

This is the same family of escape hatch as [[unexported-class-escape-hatches]] (the "exported
wrapper/getter" variant), applied to a `TSubclassOf` argument. Prefer it over adding `MinimalAPI`
to the ability class (smaller, more local core mod; doesn't change the ability's export surface).

## Related: a reference sample can assume game APIs that the current build doesn't have

The known-good reference integration for this game called `SkipPhase()` / `ClearSkippedPhases()` on
the phase subsystem — methods that **did not exist** in the current game source (the sample's game
version was ahead). Don't assume an API named in a reference sample exists; grep the current game
headers first, and add the missing methods as a small generic core mod (here: a `SkippedPhases`
set + a skip check in `StartPhase` that fires the phase-ended callback so the phase system doesn't
stall — see [[skip-phase-must-fire-callback]]).
