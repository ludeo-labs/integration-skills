# Reading Unity Logs (how the agent observes output)

The agent driving this skill **cannot see the Unity Editor Console**. To verify anything at runtime
or catch compile errors, **read Unity's log files** with Read/Grep. Used by phase 1 (native
smoke-test), phase 3 · task 5 (compile-and-fix), and the **recompile + run exit gate that ends every
code-writing phase** (4, 7, 9, 11, 12) — that gate is where the agent observes the compile result and
the live run.

## Log file locations

**Editor log** (Console output in Play mode + compile errors):

| OS | Path |
| --- | --- |
| Windows | `%LOCALAPPDATA%\Unity\Editor\Editor.log` → `C:\Users\<user>\AppData\Local\Unity\Editor\Editor.log` |
| macOS | `~/Library/Logs/Unity/Editor.log` |
| Linux | `~/.config/unity3d/Editor.log` |

**Player log** (standalone build output):

| OS | Path |
| --- | --- |
| Windows | `%USERPROFILE%\AppData\LocalLow\<Company>\<Product>\Player.log` |
| macOS | `~/Library/Logs/<Company>/<Product>/Player.log` |
| Linux | `~/.config/unity3d/<Company>/<Product>/Player.log` |

`<Company>`/`<Product>` come from Project Settings → Player (`ProjectSettings/ProjectSettings.asset`,
`companyName` / `productName`).

## Prefer a dedicated capture file (`-logFile`)

`Editor.log` is shared and rolling — for a clean, attributable capture, redirect to a known file:

```bash
# Editor, headless (compile + run a method), to a dedicated log:
Unity -batchmode -projectPath <ABS_PROJECT> -logFile <ABS>\ludeo-run.log -quit [-executeMethod <Class.Method>]
# Standalone player:
<Game>.exe -logFile <ABS>\ludeo-run.log
```

Then `Read`/`Grep` that file. (`-batchmode` runs without the GUI; omit `-quit` to keep it alive while
you tail the log.)

## What to grep for

| Looking for | Pattern |
| --- | --- |
| Ludeo init / smoke logs | `\[Ludeo\]` or your log prefix |
| Native layer didn't load | `WrapperDllNotFound` |
| SDK result codes | `LudeoResult` / `resultCode` |
| Compile errors | `error CS` |
| Runtime exceptions | `Exception`, `NullReferenceException` |
| SDK objects in use | `LudeoManager`, `LudeoSession`, `LudeoStateObject` |

## Notes

- **Play-mode `Debug.Log` goes to `Editor.log`**; a built player's logs go to `Player.log` (or the
  `-logFile` path).
- Read the **tail** of `Editor.log` (it accumulates across sessions) or, better, use a fresh
  `-logFile` per run so the capture is unambiguous.
- If the user runs the Editor interactively (not headless), have them reproduce the action, then read
  `Editor.log` — the agent doesn't need the GUI, only the file.
