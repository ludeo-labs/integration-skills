---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Did you `NewObject<UObject>(Outer, ResolvedClass)` to create the instance, and do you need to downcast to a non-API-exported subclass?"
sanitized: true
---

# `static_cast<T*>` is safe when YOU constructed the object — `Cast<T>` requires `_API` export

## Precondition

You're working in a plugin module. You've just constructed a `UObject` whose dynamic type you control:

```cpp
UClass* ResolvedClass = LoadClass<USomeBase>(nullptr, *ClassPath);
UObject* Instance = NewObject<UObject>(Outer, ResolvedClass);
```

Now you need to downcast to a specific subclass `USpecificType` (e.g., `UCosmeticPartConfig`, `UCosmeticPartConfigVariant`) and call methods or assign to a field of that type. The subclass is **not** marked `_API`-exported, so `Cast<USpecificType>(Instance)` triggers `LNK2019: GetPrivateStaticClass()` because `Cast<>` resolves `T::StaticClass()`.

## The escape hatch

`static_cast<USpecificType*>(Instance)` works because:

1. You constructed `Instance` via `NewObject<UObject>(Outer, ResolvedClass)` — its dynamic type is exactly `ResolvedClass`.
2. If `ResolvedClass` is `USpecificType::StaticClass()` (which you arranged by serializing/resolving the class path produced from a known-`USpecificType` instance on the capture side), the cast is provably correct at runtime.
3. `static_cast` doesn't require `T::StaticClass()` to be linkable — it's a compile-time cast based on the type's pointer offset, not UE reflection.

Trade-off: you lose the `Cast<>` runtime null-on-mismatch safety. If `ResolvedClass` is somehow not a subclass of `USpecificType`, `static_cast` produces a pointer that will misbehave. Mitigations:

- Symmetric capture/restore — capture the class path from a known-`USpecificType` instance, restore via the same path. The SDK's path round-trip preserves the dynamic type.
- Optional `Instance && Instance->IsA(USpecificType::StaticClass())` runtime check — but this requires `IsA()` to link, which has the same export issue. So in practice the symmetry guarantee is what you rely on.

## Reference incident (ActionGame)

Restoring polymorphic `UCosmeticPartConfig` / `UCosmeticPartConfigVariant` config sub-objects from captured `(ConfigClass, ConfigBlob)` pairs:

```cpp
// WRONG — Cast<UCosmeticPartConfig> needs UCosmeticPartConfig::StaticClass() linked
FCosmeticPartConfigGroup Group(Part, Cast<UCosmeticPartConfig>(ConfigInst));
// LNK2019: UCosmeticPartConfig::GetPrivateStaticClass()
```

Fix:

```cpp
// RIGHT — static_cast is safe by construction
// ConfigInst was just NewObject<UObject>(PS, ResolvedClass) where ResolvedClass came from
// the captured class path — guaranteed to be UCosmeticPartConfig (or a subclass thereof).
FCosmeticPartConfigGroup Group(Part, static_cast<UCosmeticPartConfig*>(ConfigInst));
```

Same pattern applied for `UCosmeticPartConfigVariant`. `Cast<UEquippablePartConfig>` was kept as-is because that base class IS `GAME_API`-exported.

## When to use this vs the other escape hatches

| Situation | Use |
|---|---|
| The class is `_API`-exported | `Cast<T>` (normal, runtime-safe) |
| You constructed the object yourself via `NewObject<UObject>(class)` and the subclass isn't exported | `static_cast<T*>` (safe by construction) |
| You're casting an arbitrary pointer of unknown dynamic type | `static_cast` is **NOT** safe — see `unexported-class-escape-hatches.md` for hatches 1-4 |

## How to apply

Whenever the linker rejects `Cast<T>` for a non-exported subclass, ask: **did I construct this instance, or did it come from an external pointer?**

- **You constructed it** (e.g. via `NewObject` with a resolved `UClass*`): `static_cast<T*>` is safe.
- **It came from elsewhere** (engine-owned pointer, returned from a getter, picked up via `TActorIterator`): apply hatch 1-4 from `unexported-class-escape-hatches.md`.

## Cross-reference

- `unexported-class-escape-hatches.md` — the four general escape hatches when a class isn't `_API`-exported. This learning is a fifth hatch that applies specifically when you control the construction.
- `capture-original-not-modified-data-when-engine-creates-per-instance-copies.md` — same export-gotcha hits the loadout struct's `GetOriginalData()` method.
