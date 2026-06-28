# Reading Unity Logs (how the agent observes output)

The agent driving this skill **cannot see the Unity Editor Console**. To verify anything at runtime
or catch compile errors, **read Unity's log files** with Read/Grep. Used by phase 0 (native
smoke-test), phase 5 (compile-and-fix), and the **recompile + run exit gate that ends every
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
| Auth failure (implicit/Steam or explicit) | `InvalidAuth` |
| Steam init failure / auth red herrings | `SteamAPI_Init`, `Session auth details not specified`, `GfnGetPartnerSecureData` |
| SDK result codes | `LudeoResult` / `resultCode` |
| Compile errors | `error CS` |
| Runtime exceptions | `Exception`, `NullReferenceException` |
| SDK objects in use | `LudeoManager`, `LudeoSession`, `LudeoStateObject` |

## Diagnosing `InvalidAuth` (implicit / Steam auth)

`InvalidAuth` from the `Activate` callback has **two unrelated cause-families** — don't conflate them:

1. **Code-ordering (the integration's responsibility):** `Activate` fired before Steam finished
   initializing. Fix = gate `Activate` on an auth-ready signal
   ([`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) → "Implicit auth: gate Activate on
   Steam-ready").
2. **Steam-environment (not code):** the Steam account doesn't own / isn't entitled to the app id
   (common for an unreleased third-party title or an integrator's account); the Editor and the Steam
   client run at **different OS privilege levels** (admin mismatch); the Editor wasn't **restarted**
   after editing `steam_appid.txt`; or the app's release-state is *Unavailable* / missing default
   packages. Also check the **App-ID-0 landmine** ([`UPM-INSTALL-AND-DEFINES.md §3`](./UPM-INSTALL-AND-DEFINES.md)).

**Red-herring logs — don't be misled:**
- Steamworks.NET prints a **generic multi-cause list** on *any* init failure; don't assume "client not
  running."
- The SDK's auth fallback chain emits GeForce-NOW noise — `GFN detected`, `GfnGetPartnerSecureData …
  Error -18`, `Session auth details not specified and automatic …` — when the real problem is simply
  that **Steam was never initialized**, not a GeForce-NOW issue.

(Exact wording varies by SDK / wrapper version — match loosely.)

## Notes

- **Play-mode `Debug.Log` goes to `Editor.log`**; a built player's logs go to `Player.log` (or the
  `-logFile` path).
- Read the **tail** of `Editor.log` (it accumulates across sessions) or, better, use a fresh
  `-logFile` per run so the capture is unambiguous.
- If the user runs the Editor interactively (not headless), have them reproduce the action, then read
  `Editor.log` — the agent doesn't need the GUI, only the file.
