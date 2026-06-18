---
category: engine-quirks
tier: universal
sourceGame: VoyagerV2
phase: 7
question: null
sanitized: true
---

# Git Bash expands /Game/ asset paths to C:/Program Files/Git/Game/

When passing UE asset paths (like `/Game/Voyager/Blueprints/Components/HealthComp`) through Git Bash on Windows, the shell interprets `/Game/` as a Unix path and expands it to `C:/Program Files/Git/Game/`.

**Fix:** Prefix the command with `MSYS_NO_PATHCONV=1`:
```bash
MSYS_NO_PATHCONV=1 "C:/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" ... -PythonArg="/Game/Voyager/..."
```

**Symptom:** `LogEditorAssetSubsystem: Error: LoadAsset failed: Can't convert the path 'C:/Program' because it does not map to a root.`

This affects any tool that passes UE `/Game/` paths as command-line arguments through Git Bash (bp_inspector.py set-savegame, commandlets, etc.).
