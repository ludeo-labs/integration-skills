---
category: common-mistakes
tier: universal
sourceGame: EndlessFPS
phase: 0
question: "Is the Python Editor Script Plugin enabled in the .uproject? If not, bp_inspector.py runs through -ExecutePythonScript and silently produces no report (exit 0)."
sanitized: true
---

# BP Inspector silently no-ops if PythonScriptPlugin is not enabled

`bp_inspector.py` runs inside the editor via `-ExecutePythonScript`. If the **Python Editor Script Plugin** is not enabled in the project's `.uproject`, the editor boots, exits 0, and writes **no report** — there is no error, so it looks like it ran. The first inspection of a fresh project produced an empty result for exactly this reason.

**Fix:** In Stage 0, before running the inspector, ensure `.uproject` Plugins contains:
```json
{ "Name": "PythonScriptPlugin", "Enabled": true },
{ "Name": "EditorScriptingUtilities", "Enabled": true }
```
This is required for both the C++ plugin path and the `.uasset` fallback path.

**Windows invocation.** Calling the `.bat` wrapper via `cmd.exe /c` can fail outright, and a `pause` in the batch hangs non-interactive runners. The reliable headless path is PowerShell calling the editor directly:
```
& "<UE>/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "<Game>.uproject" `
  -run=pythonscript -script="<abs>/bp_inspector.py" -PythonArg="inspect" `
  -unattended -nopause -nosplash
```

See also [[redeploy-tools-on-skill-update]] and [[headless-editor-python-output-needs-fullstdout]].
