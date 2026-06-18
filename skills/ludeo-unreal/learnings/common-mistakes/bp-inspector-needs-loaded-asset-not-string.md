---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 7
question: null
sanitized: true
---

# LudeoBPInspector C++ functions expect loaded UBlueprint*, not string path

When calling `LudeoBPInspectorLibrary.set_save_game_flag()` from Python, pass the **loaded Blueprint asset object**, not the string path.

**Wrong:**
```python
lib.set_save_game_flag("/Game/Path/BP_Name", "Health", True)
# Error: Failed to convert parameter 'bp'
```

**Correct:**
```python
bp_asset = unreal.EditorAssetLibrary.load_asset("/Game/Path/BP_Name")
lib.set_save_game_flag(bp_asset, "Health", True)
```

The `bp_inspector.py` `cmd_set_savegame` function handles this correctly (loads via `EditorAssetLibrary.load_asset`). Custom batch scripts must do the same.
