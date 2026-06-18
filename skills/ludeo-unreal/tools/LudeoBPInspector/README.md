# LudeoBPInspector

UE Editor-only C++ plugin that exposes Blueprint internals to Python. Used by `bp_inspector.py` to read/write BP variable metadata, list components, and detect parent classes.

## Why

UE's Python bindings don't expose BP-defined variables. `dir(CDO)` only shows C++ UPROPERTYs, `NewVariables` is protected, and `find_property_by_name` isn't available on `BlueprintGeneratedClass` in UE 5.7. This plugin accesses `UBlueprint` internals directly in C++ and exposes them as `UFUNCTION(BlueprintCallable)` methods that Python can call via the `unreal` module.

## API

All functions are static on `ULudeoBPInspectorLibrary`.

| Python call | Returns | What it does |
|-------------|---------|-------------|
| `list_blueprint_variables(bp)` | Array of `FLudeoBPVariableInfo` | Iterates `BP->NewVariables`. Returns name, type, SaveGame flag, replication flag, raw PropertyFlags, and CDO default value per variable. |
| `get_save_game_flag(bp, var_name)` | bool | Checks `CPF_SaveGame` on a specific variable. |
| `set_save_game_flag(bp, var_name, enable)` | bool | Sets/clears `CPF_SaveGame`, recompiles the BP, saves to disk. Returns false if variable not found. |
| `get_blueprint_components(bp)` | Array of `FLudeoBPComponentInfo` | Iterates `SimpleConstructionScript->GetAllNodes()`. Returns component name, class, and whether it's the root. |
| `get_parent_class_name(bp)` | FName | Walks `BP->ParentClass` chain until hitting a native C++ class (path starts with `/Script/`). |

### Python property names on returned structs

UE strips the `b` prefix from bool UPROPERTYs when exposing to Python:

| C++ field | Python accessor |
|-----------|----------------|
| `FName VarName` | `info.get_editor_property("var_name")` |
| `FString VarType` | `info.get_editor_property("var_type")` |
| `bool bSaveGame` | `info.get_editor_property("save_game")` |
| `bool bReplicated` | `info.get_editor_property("replicated")` |
| `int64 PropertyFlags` | `info.get_editor_property("property_flags")` |
| `FString DefaultValue` | `info.get_editor_property("default_value")` |
| `bool bIsRootComponent` | `info.get_editor_property("is_root_component")` |

## Deployment

This plugin is deployed automatically by the integration skill during Stage 0:

1. Copy `tools/LudeoBPInspector/` to `<GameRoot>/Plugins/LudeoBPInspector/`
2. Add `{"Name": "LudeoBPInspector", "Enabled": true}` to the game's `.uproject` Plugins array
3. Build the Editor target: `Build.bat <Game>Editor Win64 Development <Game>.uproject`
4. Run `bp_inspector.py` — it auto-detects the plugin and uses it when available

If the plugin is not compiled or not present, `bp_inspector.py` falls back to `.uasset` binary scanning (less reliable, no components/defaults/flags).

## Build dependencies

- `Core`, `CoreUObject`, `Engine` (public)
- `UnrealEd`, `BlueprintGraph`, `KismetCompiler` (private)
- `#include "UObject/SavePackage.h"` required for `FSavePackageArgs` in UE 5.7+

## Compatibility

Tested on UE 5.7. Designed for UE 4.26+ (all APIs used are stable since UE 4). The `FSavePackageArgs` overload in `SetSaveGameFlag` may need adjustment on UE 4.x — the compile-fix loop handles this.

## What this does NOT do

- No runtime component (Editor-only module, zero shipping cost)
- No BP graph reading (stretch goal — see design spec)
- No variable creation/deletion (only reads metadata and modifies SaveGame flag)
