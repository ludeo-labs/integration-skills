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
| AppID / license mismatch (SteamAPI.InitEx) | `FailedGeneric`, `ConnectToGlobalUser` |
| SDK result codes | `LudeoResult` / `resultCode` |
| Compile errors | `error CS` |
| Runtime exceptions | `Exception`, `NullReferenceException` |
| SDK objects in use | `LudeoManager`, `LudeoSession`, `LudeoStateObject` |
| Restore two-pass counts / activation | `\[Ludeo\]` + `restore`, `spawned`, `applied`, `activate` |
| Freeze / unfreeze resolved state | `timeScale`, `restoreFreeze`, `overlayPause` |

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

**Fingerprint for the license-mismatch case:** when `SteamAPI.InitEx(out string msg)` returns
`k_ESteamAPIInitResult_FailedGeneric` and `msg` contains `ConnectToGlobalUser failed`, the logged-in
account doesn't own the AppID in `steam_appid.txt`. This is not a code or timing problem — it's a
license problem. Fix: test on an account that owns the exact AppID, or launch through Steam.

**Red-herring logs — don't be misled:**
- Steamworks.NET prints a **generic multi-cause list** on *any* init failure; don't assume "client not
  running."
- The SDK's auth fallback chain emits GeForce-NOW noise — `GFN detected`, `GfnGetPartnerSecureData …
  Error -18`, `Session auth details not specified and automatic …` — when the real problem is simply
  that **Steam was never initialized**, not a GeForce-NOW issue.
- **For `FailedGeneric / ConnectToGlobalUser failed`:** common wrong-turns are (a) *delaying the
  `SteamAPI.InitEx` call* to "let Steam settle" — it's **synchronous**, so timing is irrelevant;
  (b) *adding a `SteamAPI.RunCallbacks()` pump* — unnecessary for auth resolution; (c) *suspecting
  Editor/Steam privilege-level mismatch* — a real cause of some Steam failures but **not** of
  `ConnectToGlobalUser failed`, which is exclusively a license/ownership problem.

(Exact wording varies by SDK / wrapper version — match loosely.)

## Debugging a restore that "does nothing" — instrument before theorizing

Restore bugs (inert boss, cutscene didn't show, player mis-placed) invite confident-but-wrong theories a
single log disproves. **Read the log before hypothesizing** — get the per-restore instrumentation
(`07 §10.5`): two-pass counts, the resolved pause state, each re-driven activation.

- **Per-tick silence during the freeze is *expected*, not a hang.** A frozen/suppressed entity (CR-010)
  emits nothing from its `Update`/`FixedUpdate`/AI tick while the restore window holds. Do **not** read that
  gap as a stall.
- **Distinguish it from the real deadlock by the unfreeze, not the ticks.** If `timeScale` returns to `1`
  (or suppression lifts) at `RoomReady → Begin` and ticks resume, the earlier silence was correct. Only if
  the **unfreeze is never logged** — no `Begin`, `FixedUpdate` never resumes — on an **async** apply is it
  the genuine `timeScale = 0` deadlock (`07 §10.1`). The signal is the **absent unfreeze**, not the silence.
- **Inert vs jammed vs dead-input** all present alike; the logs separate them: inert = activation never
  fired (`07 §9.1`), jammed = a transient flag stuck `true` (`07 §1.5`), dead-input = one of three gates
  (`07 §10.4`).

## Notes

- **Play-mode `Debug.Log` goes to `Editor.log`**; a built player's logs go to `Player.log` (or the
  `-logFile` path).
- Read the **tail** of `Editor.log` (it accumulates across sessions) or, better, use a fresh
  `-logFile` per run so the capture is unambiguous.
- If the user runs the Editor interactively (not headless), have them reproduce the action, then read
  `Editor.log` — the agent doesn't need the GUI, only the file.
