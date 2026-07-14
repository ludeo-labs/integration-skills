---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: 4
question: "Do you need to call the game's own Blueprint functions via reflection / ProcessEvent (AddItem, RemoveItem, WieldItem, reload, etc.)? If so, do you have each function's exact input/output PIN signature — not just its name? The BP-Inspector 'inspect' (variables) and 'graph' (call-graph node titles) modes do NOT report function pin signatures."
sanitized: true
---
# Discover a Blueprint function's exact pin signature before invoking it via ProcessEvent

## Precondition
You are integrating a BP-only / BP-heavy game and must drive the game's **own** Blueprint functions from
C++ via reflection (`UObject::FindFunction` + `ProcessEvent`) — e.g. re-creating inventory on restore
through an inventory's `AddItem` / `RemoveItem` / `WieldItem`, or calling a weapon reload. To build the
`ProcessEvent` params block correctly you need the function's **exact pin signature**: parameter names,
types, order, and the (often multiple) output pins — not just the function name.

## The gap in the existing BP-Inspector modes
- `inspect` (inspect-path) reports **variables** (names/types/flags/defaults) + the native parent class — not functions.
- `graph` / `graph-function` report **call-graph node titles** (what a function calls internally) — not the function's own input/output **pins**.

So neither mode tells you, for example, that an `AddItem` takes `(ItemClass: class, Optional_GUID: Guid,
OptionalSlotIndex: int)` and returns `(InventoryItem, Success, InventoryIsFull)`. Guessing the signature →
a malformed params block → silent no-op or crash. (See also [[bp-pass-by-ref-has-cpf-outparm]] for the
flag handling once you DO have the signature.)

## The technique
The BP-Inspector C++ plugin already exposes `list_blueprint_functions(asset)`, and each returned info has
`input_pins` / `output_pins`. A tiny headless Python commandlet dumps them:

```python
import unreal, json
PLUGIN = unreal.LudeoBPInspectorLibrary
TARGETS = { "/Game/<path>/BP_YourInventory": None }   # None = dump ALL functions for that BP
out = {}
for path in TARGETS:
    asset = unreal.EditorAssetLibrary.load_asset(path)
    infos = PLUGIN.list_blueprint_functions(asset)
    out[path] = [{
        "name": str(i.get_editor_property("function_name")),
        "in":  [str(p) for p in i.get_editor_property("input_pins")],
        "out": [str(p) for p in i.get_editor_property("output_pins")],
    } for i in infos]
# json.dump(out, ...) to a file
```
Run headless: `UnrealEditor-Cmd <proj> -ExecutePythonScript="dump_sigs.py" -stdout -unattended -nullrhi`.

This reveals the real signatures in seconds — **including game-native helpers you'd otherwise miss and
should prefer over hand-rolled hacking.** Dumping an inventory BP this way surfaced a clean
`RemoveItem(item) -> Removed` (so "clean before re-add" uses the game's own removal instead of emptying the
backing array reflectively and desyncing the HUD), and a native checkpoint `GetCheckpointData` /
`LoadFromCheckpoint` pair worth considering over a hand-rolled per-item capture.

Note: this works on plain `UObject`-parented BPs too (an inventory object, item data, etc.), which the
inspector's `is_gameplay_relevant()` filter skips for `inspect`/`graph` — so target them explicitly by path.

## Use the first-class command
This is now a built-in BP-Inspector command: `RunBPInspector.bat inspect-func-sigs <bp_path> [<bp_path> ...]`
→ `.ludeo/func-sigs.json`. Use it instead of hand-rolling the script above — it closes the gap between
"I know the function exists" and "I can call it correctly," and is needed on essentially every BP-only
integration (inventory/loadout/weapon restore, reload, equip, clear). If the deployed `.ludeo/tools/`
copy doesn't have the command, the deployed tools are stale — redeploy from the skill
([[redeploy-tools-on-skill-update]]); the one-off commandlet above is only the fallback when you cannot
redeploy.
