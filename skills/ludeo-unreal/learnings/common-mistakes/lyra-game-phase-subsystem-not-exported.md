---
category: common-mistakes
tier: game-specific
sourceGame: Lyra
phase: 3
question: "Are the game phase subsystem methods (WhenPhaseStartsOrIsActive, WhenPhaseEnds) exported with the module API macro?"
sanitized: true
---

# ULyraGamePhaseSubsystem methods are not exported by default

`ULyraGamePhaseSubsystem::WhenPhaseStartsOrIsActive()` and `WhenPhaseEnds()` do not have `LYRAGAME_API` in the base Lyra codebase. The class itself also lacks the export macro. Calling these from a plugin DLL causes:

```
error LNK2019: unresolved external symbol "public: void __cdecl ULyraGamePhaseSubsystem::WhenPhaseStartsOrIsActive(...)"
```

**Fix:** Add `LYRAGAME_API` to the class declaration in `LyraGamePhaseSubsystem.h`:
```cpp
// Preferred: class-level export (exports all public methods)
class LYRAGAME_API ULyraGamePhaseSubsystem : public UWorldSubsystem

// Alternative: per-method export (more granular but more maintenance)
LYRAGAME_API void WhenPhaseStartsOrIsActive(FGameplayTag PhaseTag, EPhaseTagMatchType MatchType, const FLyraGamePhaseTagDelegate& WhenPhaseActive);
LYRAGAME_API void WhenPhaseEnds(FGameplayTag PhaseTag, EPhaseTagMatchType MatchType, const FLyraGamePhaseTagDelegate& WhenPhaseEnd);
```

**Important:** Do NOT use `#define UE_API LYRAGAME_API` + `MinimalAPI` on this class — it doesn't have UE_API-prefixed members and the pattern will cause compilation errors. See `define-ue-api-breaks-non-minimal-classes.md`.
