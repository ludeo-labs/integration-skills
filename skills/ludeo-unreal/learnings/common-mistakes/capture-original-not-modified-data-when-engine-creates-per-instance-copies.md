---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: 4
question: "Does the host engine create per-instance / per-PlayerState modified copies of asset data (e.g., for skill modifiers, RPG attributes, loadout customization)? If yes, capture the original asset path, not the modified instance pointer."
sanitized: true
---

# When the engine creates per-PlayerState modified data sub-objects, capture the ORIGINAL asset path

## Precondition

Applies when the host engine's loadout / equipment / character system has a "data modification" pipeline that produces **per-instance** runtime sub-objects derived from asset templates. Common patterns:

- RPG-style "stat modifiers" that mutate weapon damage based on equipped skills
- Per-PlayerState weapon configuration where mods/skills change the weapon data at runtime
- Cosmetic systems where the live config differs from the asset template

The footgun: the engine's runtime data structures point at these *modified* sub-objects, not the original assets. The Ludeo capture-side reads those pointers and serializes their `GetPathName()` — and those names look like:

```
/Game/Maps/MyLevel.MyLevel:PersistentLevel.BP_PlayerState_C_0.WeaponData_0
```

Sub-object paths scoped to a runtime actor instance. **They do not resolve on replay** — the new PlayerState instance won't have a sub-object with that exact name.

## Reference incident (ActionGame, Stage 3)

ActionGame's `FPlayerLoadout::CreateDataModifications(PlayerState)` creates per-PlayerState modified copies of:

| Struct | Active field (DO NOT capture) | Original field (DO capture) |
|---|---|---|
| `FEquippableConfig` | `EquippableData` | `OriginalEquippableData` |
| `FThrowableConfig` | `Data` | `OriginalData` |
| `FArmorConfig` | `Data` | `OriginalData` |
| `FCosmeticConfigA` | `MaskData` | `OriginalMaskData` |
| `FCosmeticConfigB` | `SuitData` | `OriginalSuitData` |

Each struct exposes a `GetOriginalData()` method that returns `Original ?? Active`, but it isn't `GAME_API`-exported, so plugin code can't link against it. Direct field access works because the fields are public UPROPERTYs.

Initially captured the active fields. Cosmetic/suit/glove/armor came back fine on replay (those aren't subject to runtime modification in ActionGame) — but weapons silently failed to equip, because the captured `BP_PlayerState_C_0.RangedWeaponData_0` paths returned nullptr from `FindObject<>` / `LoadObject<>`. Diagnosed by inspecting `.ludeo/ludeo.json` and noticing `Loadout_Weapon_0_Data` had a colon-prefixed sub-object path, while `Cosmetic_Part_Data` had a clean asset path.

Fix:

```cpp
// WRONG — captures the modified instance, replay can't resolve
const FString DataPath = Config.EquippableData ? Config.EquippableData->GetPathName() : FString();

// RIGHT — captures the asset path (mirrors GetOriginalData() inlined)
const UEquippableData* OrigData = Config.OriginalEquippableData ? Config.OriginalEquippableData : Config.EquippableData;
const FString DataPath = OrigData ? OrigData->GetPathName() : FString();
```

On restore: assign the resolved original asset to the active field. The engine's `OnLoadoutChanged` cascade re-runs `CreateDataModifications` and rebuilds any per-PlayerState modifications from the original.

## How to apply

For any new game integration that captures equipped/loadout state:

1. **Survey the loadout struct headers.** Look for paired UPROPERTY fields with names like `X` and `OriginalX`, where one is `Transient` and the other is `EditDefaultsOnly`. The `Transient` one is the runtime modified copy; the `EditDefaultsOnly` one (or a matching `Original*`) is the asset reference.

2. **Look for a `CreateDataModifications` / `ApplyDataModifications` family of methods** on the loadout struct or PlayerState class. Their existence is a strong signal the engine has this pattern.

3. **Test the "asset path vs instance path" distinction in the captured JSON.** A clean asset path looks like `/Game/Path/To/Asset.Asset`. A per-instance path has a colon and an actor name: `:PersistentLevel.BP_X_C_0.SubObject_N`.

4. **Always capture via `Original ? Original : Active`** — fall back to the active field for structs that don't have an `Original*` paired field.

5. On restore, assign the resolved asset to the active field and let the engine rebuild modifications via its loadout-change cascade.

## Diagnostic value during integration

If, after Phase B is wired up, weapons / cosmetics / equipped items don't restore but other state (transform, health, ammo) does — **inspect the captured JSON for sub-object paths**. The colon-and-actor-name shape is the telltale sign you're capturing modified instances rather than original assets.

## Cross-reference

- `path-string-roundtrip-pattern.md` — general pattern for capturing `TArray<UObject*>` as path strings (this learning is a special case).
- `unexported-class-escape-hatches.md` — `GetOriginalData()` not being API-exported is a common case of escape hatch #1 (use the field directly when the method isn't reachable).
