---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "When the API you need lives on a class that isn't `*_API`-exported, which of the four escape hatches do you use — library/singleton getter, exported parent, gameplay-tag container, or adding MinimalAPI?"
sanitized: true
---

# Four escape hatches when the class you need to call isn't API-exported

## Precondition

You're writing integration code in a *plugin module*. You need to call a method (or read a property) on a game class, but the class isn't marked with `GAME_API` / `<MODULE>_API`. The linker will reject any direct reference with `LNK2019 unresolved external symbol`.

Don't give up and start mocking or reimplementing. There are four escape hatches — use them in this order of preference.

## 1. Library / singleton getter (preferred)

If the functionality is exposed through a Blueprint function library or a singleton, use that. Libraries are almost always exported (they're designed for Blueprint visibility, which requires API export).

**Example — ActionGame game event broker:**

```cpp
// WRONG — UGameEventBroker itself is not exported
UGameEventBroker* Broker = UGameEventBroker::Get(GetWorld()); // LNK2019

// RIGHT — exported library wraps the same broker
UGameEventBroker* Broker = UGameEventLibrary::GetGameEventBroker(GetWorld());
```

**Example — ActionGame inventory bag manager:**

```cpp
// UInventoryBagManager::Get is on a non-exported subsystem
// Instead, bind through the exported manager-retrieve helper if one exists.
```

Check: grep for `<YourClass>` mentions in `FunctionLibrary` headers — usually the library wraps the private singleton.

## 2. Exported parent class

If you only need shared parent-class behavior, upcast. Parent classes are more likely to be exported, and most of the API surface you want is usually there.

**Example — ActionGame aerial vehicles:**

```cpp
// Vehicle-specific BP classes aren't exported (they're Blueprints anyway)
// But the C++ parent is:
class GAME_API AAerialVehicleActor : public APawn, public IVehicleInterface
```

So `TActorIterator<AAerialVehicleActor>` works, even though individual vehicle BPs aren't reachable by type in C++. You lose access to BP-only methods but that's usually fine — Transform + ClassPath is enough for Ludeo capture.

## 3. Gameplay tags

If the behavior you need is "does X have property/state Y", and the game already drives this through `FGameplayTag` / `FGameplayTagContainer`, bypass the class entirely. Gameplay tags are a module-boundary-safe way to query state.

**Example — ActionGame pawn categorization:**

Instead of `if (Pawn->IsSpecialEnemy()) { ... }` (method not exported), do:

```cpp
FGameplayTagContainer Tags;
Pawn->GetOwnedGameplayTags(Tags);  // IGameplayTagAssetInterface — exported
if (Tags.HasTag(FGameplayTag::RequestGameplayTag(TEXT("PawnType.Special")))) { ... }
```

This works across modules, across DLCs, and survives the game renaming/refactoring its internal classification methods.

## 4. Add `MinimalAPI` to the UCLASS (last resort)

If the other three don't fit, add `MinimalAPI` to the UCLASS declaration. This exports only the vtable and reflection glue — no member functions — which is often what's needed for `Cast<>`, property reflection, and basic construction.

**Example — ActionGame prop damage:**

```cpp
// Before
UCLASS(Blueprintable)
class UDestructibleComponent : public UActorComponent

// After (header edit, needs rebuild)
UCLASS(Blueprintable, MinimalAPI)
class UDestructibleComponent : public UActorComponent
```

**Cost:** engine rebuild, slight DLL size bump, you own the edit forever (rebase burden). Only do this when hatches 1-3 don't fit the access pattern.

**Gotcha:** if the class already uses `<MODULE>_API` on individual methods (`MODULE_API void Foo();`), you can't also mark the class `MinimalAPI` or you'll get a macro conflict. See `define-ue-api-breaks-non-minimal-classes.md`.

## Decision matrix

| You need… | Use escape hatch |
|---|---|
| To call a method that's also in a BP library | 1. Library |
| A parent-class method, not a subclass-specific one | 2. Parent upcast |
| "Is this thing a type/state of X" | 3. Gameplay tags |
| `Cast<>`, reflection, `TActorIterator<>` of the exact class | 4. MinimalAPI |
| A method that's on exactly this class and nowhere else | 4. MinimalAPI (or add a getter/wrapper via engine edit) |

## Anti-pattern

**Don't silently stub around the missing class** ("we'll just fake the state for now"). This creates capture-side drift that surfaces as mysterious replay mismatches weeks later. Pay the cost of the right escape hatch *now*.

## Cross-reference

- `define-ue-api-breaks-non-minimal-classes.md` — `MinimalAPI` macro conflicts.
- `private-non-uproperty-needs-public-getter.md` — even when the class IS exported, private members aren't accessible.
