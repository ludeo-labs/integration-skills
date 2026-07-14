---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# When you gate an engine field or method, every caller must also be gated

## The rule

If you add `#if LUDEO_OFFLINE_MODE` around a field, method, method export (`GAME_API`), or include directive in the engine source, **every reference to that symbol in any translation unit must also be inside the same gate** — including references from the Ludeo plugin.

This is "byte-identical retail compile" discipline: removing `PublicDefinitions.Add("LUDEO_OFFLINE_MODE=1")` from the engine module's `.Build.cs` must produce a build that (a) compiles clean and (b) has no Ludeo-introduced symbols in the engine DLLs.

## Examples of the cascade

Adding a new field:

```cpp
// AMatchGameState.h
#if LUDEO_OFFLINE_MODE
bool bSkipSetupPhase = false;
#endif
```

Forces every reader to gate too:

```cpp
// AMatchGameState.cpp (same module)
#if LUDEO_OFFLINE_MODE
if (bSkipSetupPhase && bIsMissionActive) { /* ... */ }
#endif

// USpecialModeAbility.cpp (same module)
#if LUDEO_OFFLINE_MODE
if (GS && GS->bSkipSetupPhase) { /* ... */ }
#endif

// ActionGameLudeoSubsystem.cpp (plugin — different module!)
#if LUDEO_OFFLINE_MODE
MatchGS->bSkipSetupPhase = true;
#endif
```

## The DLL-export gotcha

When you add a method that the plugin calls into from a different module, the method needs the module's API export prefix (`GAME_API`). That export prefix itself must be gated, or retail ships a DLL with extra exported symbols:

```cpp
// UDialogManager.h — wrong (retail DLL has GAME_API export)
static GAME_API UDialogManager* GetDialogManager(const UObject* WCO);

// Right — DLL export table is byte-identical in retail
#if LUDEO_OFFLINE_MODE
static GAME_API UDialogManager* GetDialogManager(const UObject* WCO);
#else
static UDialogManager* GetDialogManager(const UObject* WCO);
#endif
```

Plus the method itself, if it's new:

```cpp
#if LUDEO_OFFLINE_MODE
GAME_API void SuppressForLudeoBoot();
GAME_API void ResumeAfterLudeoBoot();
#endif
```

And the plugin-side call:

```cpp
// ActionGameLudeoComponent.cpp
#if LUDEO_OFFLINE_MODE
if (UDialogManager* DM = UDialogManager::GetDialogManager(this))
{
    DM->ResumeAfterLudeoBoot();
}
#endif
```

## The include-directive gotcha

A `#include` that pulls in a header whose contents are gated is a lighter violation but still worth gating for hygiene:

```cpp
// AMatchGameState.cpp
#if LUDEO_OFFLINE_MODE
#include "Game/Dialog/DialogManager.h"
#endif
```

This is strictly optional if the header compiles cleanly without the gate, but makes retail byte-identical — no different include graph, no different header-parse side-effects.

## How to audit

Before committing a Ludeo engine patch, run:

```
grep -rn "LUDEO\|Ludeo\|bSkipSetup\|SuppressForLudeo" <GameModule>/Source <GameModule>/Plugins/<YourPlugin>
```

For every un-gated hit, ask: "Does this reference a symbol that only exists when `LUDEO_OFFLINE_MODE` is defined?" If yes, gate it.

## How to apply

Every stage where engine source gets edited (Stages 2, 3, 4, 5, 6b, 7):

1. For each new engine-source field / method / GAME_API / LUDEO-specific include, wrap with `#if LUDEO_OFFLINE_MODE ... #endif`.
2. Grep for every caller of that symbol across the engine module AND the plugin.
3. Wrap every caller with the same gate.
4. After editing, rebuild with the define on, then mentally walk through "if I flipped the define off, what would fail to compile?" — any surviving reference is a bug.

## Related

- `lyra-unexported-symbols.md` — when an existing engine method isn't exported and the plugin needs to call it.
- `cross-module-calls-need-module-api-export.md` (if captured) — the generic case of "plugin link fails with unresolved external symbol."
