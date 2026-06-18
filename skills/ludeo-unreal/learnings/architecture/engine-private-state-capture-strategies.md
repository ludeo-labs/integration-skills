---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 3
question: "When the integration needs to capture private/internal members of an engine class, which strategy will it use per class: (A) UPROPERTY(Transient) + reflection (LudeoSaveSystem-friendly), or (B) in-class friend FArchive snapshot (Manual-friendly)? Pick consciously per class — never silently mix."
sanitized: true
---

# Two valid strategies for capturing private engine state — pick one consciously per class

## Precondition

The integration needs to capture member state from a game/engine class, AND those members are private OR not declared `UPROPERTY`. If the members are already public + `UPROPERTY`, no engine edit is needed.

## Strategy A — Reflection-friendly (UPROPERTY exposure)

Add `UPROPERTY(Transient)` to each member you want to capture.

```cpp
// In game header — minimal edit:
UPROPERTY(Transient) // Ludeo: reflection-visible
float PhaseChangeTimeSeconds = 0.f;
```

**Pros:**
- Works directly with `LudeoSaveGameManager` declarative reflection.
- External code can read via `FindPropertyByName` without friending.
- Each member is independently addressable.

**Cons:**
- Only works for reflection-supported types (primitives, UObject*, USTRUCTs, TArray of these). Won't work cleanly for `TMap<TSubclassOf<...>, FStruct>` etc.
- Must be `Transient` (or `SaveGame`) to avoid breaking normal game save/load.
- Each captured field is a separate engine edit — accumulates.

## Strategy B — In-class snapshot (friend FArchive operator)

Add a snapshot struct + capture/restore methods inside the class.

```cpp
struct FMyClassSnapshot {
    EMyPhase Phase;
    TMap<FGameplayTag, float> Cooldowns;
    // ...
    friend FArchive& operator<<(FArchive& Ar, FMyClassSnapshot& S);
};

FMyClassSnapshot Ludeo_CaptureSnapshot() const;
void Ludeo_RestoreSnapshot(const FMyClassSnapshot& Snapshot);
```

**Pros:**
- Direct access to all privates — no reflection limitations.
- One engine edit per class regardless of field count.
- Handles complex TMaps, nested structs without `UPROPERTY` plumbing.
- Time fields can be stored as **deltas** (capture-time relative) for cross-session safety.

**Cons:**
- More code per class.
- Binary serialization is opaque (can't inspect via reflection tooling or BP inspector).
- Cannot be used by `LudeoSaveSystem` declarative path — Manual capture only.

## The rule

1. **Pick one strategy per class consciously.** Don't silently mix within one class.
2. **Strategy A** is the default if the class has few fields, simple types, and you're using `LudeoSaveSystem` (declarative reflection path).
3. **Strategy B** is the default if the class has many fields, complex types (TMaps with subclass keys, nested structs), or fields that need delta-time normalization.
4. **Document every engine edit** in the TDD with the chosen strategy. Engine edits are load-bearing for reproducibility — future maintainers must know which fields are reachable how.

## How to apply

During Stage 3 / Stage 6 state-tracking design:

1. List the engine classes you need to capture from.
2. For each class: enumerate target fields, count them, classify their types.
3. Pick strategy per class using the rule above.
4. Record in TDD: class → strategy → fields → motivation.

## Cross-reference

- `private-non-uproperty-needs-public-getter.md` — third strategy: inline public getter for read-only access to a single field. Use when you need only to read, not capture/restore.
