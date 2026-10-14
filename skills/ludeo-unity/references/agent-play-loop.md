# Playing the game yourself: capture, Ludeo, replay

Phase 5's gates need the game to run: capture a moment that holds the wave's state, turn it into a Ludeo,
replay it, and judge the restore. Run that loop yourself on a Development build, once per gate, until the
gate passes. The user plays only to make a save you can't reach, for the checks one auto-started launch
can't do (Sign-off), and when you can't run the game (last section). They sign off each wave unless they
waive it.

## Set up once, before wave 1's task-1 gate

1. **The login.** Replay by Ludeo id runs only with explicit login, so the build's `LudeoSettings` holds it:
   `runWithoutLauncher = true`, `launcherUserId`, `betaVersion`. Keep it there, not in the ini.
2. **The dev override.** The `LUDEO_DEV` shim
   ([`UPM-INSTALL-AND-DEFINES.md`](ludeo-integration-docs/unity/UPM-INSTALL-AND-DEFINES.md) → *Dev/QA
   runtime overrides*) reads `ludeo-dev.ini`, next to the exe: `ludeoLogLevel = Log` always (at the default
   `Error`, none of the SDK lines below are logged), plus the per-run keys below.
3. **The way in.** A `LUDEO_DEV` hook, written by a subagent like any task's code, that runs once the first
   scene has loaded. It sets `Application.runInBackground = true` (else the game pauses when its window
   isn't in front), enters the ini's `devEnter` through the game's own calls (what its menus call, its
   first-run setup's confirm included; never sent input), and logs `[Ludeo][dev] entered` once the player
   has control. `devEnter` names the target in whatever form the hook reads (`level=Forest;mode=Survival`, a
   save slot), so a new target changes the ini, not the code.
4. **Build** a Development player with `LUDEO_DEV`, the way the project builds (its build method or Build
   Profile, plus `BuildOptions.Development`, and `extraScriptingDefines = { "LUDEO_DEV" }` if its dev
   configuration lacks the define), headless:
   `Unity.exe -batchmode -quit -projectPath <ABS> -executeMethod <its build method> -logFile <ABS>`.
   Batch mode refuses a project open in an Editor: ask the user to close it for the build. Judge the build
   by its log and fresh `<Game>_Data/Managed/*.dll` timestamps, never the exit code. A Steam game launched
   outside Steam relaunches through it and quits unless `steam_appid.txt` sits next to the exe.

**Per wave, the target:** mid-run, past the first segment, with the wave's state on screen (`OBJECT_TRACKING.md`
→ `## Wave Rollout`, `CODE_MAP.json` → entry/bootstrap and session boundaries). The script sends no input,
so the player stands idle for the whole run: pick a spot where an idle player stays alive and in play for
90 s. If no save holds one, ask the user once to play there and save. Copy the save folder aside before the
first run, since runs can autosave over it, and put it back when phase 5 ends.

## Running one game

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File <this skill>/scripts/play-game.ps1 `
  -Exe <ABS exe> -Log <ABS Player.log> -Mode capture|replay [-AfterLine '<line>']
```

`-Log` is the default `Player.log` (`%USERPROFILE%\AppData\LocalLow\<Company>\<Product>\`); each run moves
the last one aside, so judge a run before starting the next. The run stops at the first `InvalidAuth` or
`continuing without Ludeo`: fix the build's login before the next. Pictures of the game window land next to
the exe: `capture.png` just before the press, `replay.png` 3 s after Play. The game opens in a window on
the second screen when there is one; without asking, tell the user when a batch of runs starts and where.

## Each gate

**Capture** (task 1). In the ini, `devEnter` set and `ludeoToAutoStart` blank. Run with `-Mode capture`: it
waits for `[Ludeo][dev] entered`, leaves the game alone 90 s (the clip holds about the last 60 s, and all of
it must be play), then presses the overlay's capture key. Pass:
- the task-1 lines (registration, the wave's writers, no `LudeoResult` errors), then
  `onCaptureVideoRequest. gameplayId=<id>, highlightId=<id>` and `Finished uploading video data for
  highlightId <id>`;
- `capture.png` shows play: the game's HUD or the player's character in the target, with no menu, dialog or
  loading screen over it. The lines alone never pass it: a layer can begin gameplay behind a menu page, and a
  title screen can be a 3D scene. A capture that fails the picture is never cut.

If the script printed `pressed HighlightCapture` and no `onCaptureVideoRequest` followed, check that the
build's login account is a member of the environment ([`ludeo-studio-mcp.md`](ludeo-studio-mcp.md) →
invites); if it didn't print it, read its message. Record each capture (highlightId, UTC time, wave, what it
holds) in `ludeo-integration-plan/LUDEOS.md`.

**Turn it into a Ludeo.** When [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md) has a row for cutting Ludeos and
the tool is in your tool list, use it. Otherwise hand over, one message per batch: each highlightId, its
capture time and what it holds. The user makes the Ludeos in Creator Lab and sends back their ids.

**Replay** (tasks 3 and 4). In the ini, `ludeoToAutoStart = <Ludeo id>` and `devEnter` blank, so the save
doesn't load over the restore. Run with `-Mode replay` and, as `-AfterLine`, your layer's line once the
restore is applied and the game waits for Play; the script presses the overlay's Play key. Pass, both
tasks:
- `Opening room … ludeoId='<id>'` names this Ludeo, not an earlier one;
- freeze → scene load → the restore reached → `Begin`, the layer's ticks continue after it, no exceptions.

Task 4 adds: the per-restore instrumentation shows wave N's attributes applied, with non-zero two-pass
counts and no `keyMap` miss, and `replay.png` shows nothing floating in empty space, through the floor or
far from the geometry (the placement check).

**On a failure,** give the run's log and picture to the task's fix subagent (orchestrator §3), rebuild, and
re-run the same step.

**Sign-off.** When the wave passes, send the user the evidence (Ludeo ids, the pass lines, `replay.png`) with
the checks one auto-started launch can't do: replay one Ludeo then another, the overlay's pause and resume,
and play the moment to its win or lose. Replay-to-replay needs a second Ludeo, so capture twice for a wave
whose sign-off carries these checks. Ask the user to sign the wave off before you widen. After the first
sign-off, offer once: *"Want me to go through the remaining waves without stopping for sign-off? I'll still
stop for a failure I can't fix or a decision only you can make."* Record the answer in `KYG.md` so later
sessions keep it; the user can take it back anytime. With sign-off waived, the user's checks run once, on
the last wave's Ludeos, at the end of phase 5.

## When you can't run it

The user captures and replays instead, and you still judge from the logs, when:
- the game has no window you can reach (no desktop session: the script reports `MainWindowHandle` 0);
- the build won't start outside its store launcher, or batch mode can't build it;
- the overlay's key is a chord the script can't send;
- the script's pictures come back all black on a lit scene (ask the user what's on screen instead);
- the user asks to play it themselves.
