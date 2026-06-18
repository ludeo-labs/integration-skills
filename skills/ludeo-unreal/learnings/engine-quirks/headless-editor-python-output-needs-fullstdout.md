---
category: engine-quirks
tier: universal
sourceGame: VoyagerV2
phase: 7
question: null
sanitized: true
---

# Headless editor Python output requires -FullStdOutLogOutput

When running UE Editor headless (`UnrealEditor-Cmd.exe ... -ExecutePythonScript=...`), Python script output via `unreal.log()` and `print()` is routed through UE's logging system under `LogPython`. By default, `-stdout` alone does NOT show all log categories.

**Fix:** Add `-FullStdOutLogOutput` to the command line to see `LogPython` messages:
```bash
UnrealEditor-Cmd.exe Game.uproject -ExecutePythonScript="script.py" -stdout -FullStdOutLogOutput -unattended -nopause -nullrhi
```

Then grep for `LogPython` to find the script's output in the editor log stream.

**Without this flag:** The script runs but its output is invisible, making debugging impossible. The `inspect` command works around this by writing to a JSON file, but `set-savegame` only uses stdout.
