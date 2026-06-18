---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---

# Private non-UPROPERTY members cannot be read via FindPropertyByName — add public getters

## Problem

`UClass::FindPropertyByName` only finds UPROPERTY members. Private `float` members like `LevelProgression` and `IntensityScalar` on `AWaveSpawnDirector` are plain C++ members — not UPROPERTYs. Reflection silently returns null and the values are never written.

## Fix

If you need to read private non-UPROPERTY members from another module, add minimal public getters to the game's source. This is a small core game modification — two inline getter functions — and is much more reliable than memory offset hacks.

```cpp
// In the game's header (minimal modification):
float GetLevelProgression() const { return LevelProgression; }
float GetIntensityScalar() const { return IntensityScalar; }
```

## How to Apply

During Phase 3, when identifying properties to track, check whether each property is a UPROPERTY (has the macro). If not, reflection won't work — either add a getter or find an existing public API.
