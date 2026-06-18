---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 2
question: "Does the integration plugin call UGameMapsSettings (e.g. GetGameDefaultMap() for Player Flow travel)? If so, add 'EngineSettings' to the module's .Build.cs dependencies."
sanitized: true
---

# UGameMapsSettings lives in the EngineSettings module, not Engine

## Precondition

The integration plugin calls into `UGameMapsSettings` — most commonly
`UGameMapsSettings::GetGameDefaultMap()` to resolve the ServerTravel target for Player Flow
when the game boots directly into its gameplay map (`GameDefaultMap`).

## The trap

`UGameMapsSettings` is declared in a public Engine header, so the include compiles fine and the
class *looks* like part of the `Engine` module. It is not — it is exported by the separate
**`EngineSettings`** module. Calling any of its methods from a plugin module that only depends on
`Engine` links cleanly at compile time but fails at link time:

```
error LNK2019: unresolved external symbol "__declspec(dllimport) public: static class FString
__cdecl UGameMapsSettings::GetGameDefaultMap(enum EDefaultMapRequestType)"
```

## The fix

Add `EngineSettings` to the module's dependency list:

```csharp
PublicDependencyModuleNames.AddRange(new string[]
{
    "Core", "CoreUObject", "Engine",
    "EngineSettings",   // UGameMapsSettings::GetGameDefaultMap
    // ...
});
```

## Generalization

Headers that compile but symbols that won't link is the signature of a missing *module*
dependency (vs. a missing *include*). When an `LNK2019` names a stock-engine UObject method,
the class is usually exported by a satellite module (`EngineSettings`, `DeveloperSettings`,
`GameplayTags`, `CoreOnline`, …), not by `Engine`. Find the class's module via its `*_API` macro
or its source path under `Engine/Source/Runtime/<Module>/` and add that module.
