# Agent test harness — playing, capturing and replaying the game without a person at the keyboard

The gates that matter most in a Ludeo integration need the game to **run**: does the overlay take a
capture, does a Ludeo restore, do the actions fire in both flows, does the cloud build start. A small
test harness inside a **Development player build** lets the agent do all of that itself. It builds the
player headlessly, launches it with a job file, lets the harness drive the game, sends the capture
hotkey to the window, replays the Ludeos the integrator sends back, reads its own logs and screenshots,
and judges a `result.json`. The integrator is left with what only a person can do: turning captured
moments into Ludeos in Creator Lab, product decisions, and one sign-off per wave.

This is the **default route** for every integration. [`agent-automation.md`](agent-automation.md) says
what the agent runs in each phase and what it asks; this file is how.

> **Status.** One integration ran the whole loop this way: about 200 harness runs covered capture,
> replay, actions in both flows, regression sets, fresh-profile runs and the cloud build, on Unity 6,
> with no Editor open. Another integration ran the replay half from Editor play mode instead
> ([`agent-editor-tooling.md`](agent-editor-tooling.md)). Treat each step's check as the proof, and
> capture a learning wherever this recipe turns out wrong.

## Why a player build, not the Editor

| | Development player + harness (default) | Editor play mode ([optional](agent-editor-tooling.md)) |
| --- | --- | --- |
| Unity version | any the project builds with | 6000.0+ (the Pipeline package) |
| Needs an open Editor | no. Batch mode builds it with the Editor **closed** | yes, and it is shared with the integrator and other sessions |
| A compile during a run | impossible: the run is a separate process | a domain reload silently wipes the run's state |
| Native SDK state between runs | gone: every run is a fresh process | the overlay/native layer survives play-stop (CR-007) |
| What it tests | the player code that ships, with the store client and overlay as players get them | Editor paths (`UNITY_EDITOR`, often no store client) |
| Capture (overlay hotkey) | yes: the player is a normal window | yes, in a windowed Editor |

## When it applies

Check in phase 1 ([`agent-automation.md`](agent-automation.md) → *Phase 1 readiness check*):

| Needs | How to check | If not met |
| --- | --- | --- |
| The project's Unity Editor installed on this machine | `ProjectSettings/ProjectVersion.txt` against the Hub's editor folder | Ask the integrator to install it. A Hub or CLI install can need an administrator prompt the agent can't answer. |
| The project **not open** in an Editor while you compile or build | no `Temp/UnityLockfile`, and no `Unity.exe` with this `-projectPath` (on Windows, `Get-CimInstance Win32_Process`) | Ask the integrator to close it for the build, or use the Editor route for that step. Batch mode refuses a locked project. |
| A desktop session where the agent's shell can open windows and focus them | launch any windowed app and read its window handle | Capture and screenshots need it. Without it the harness still runs lifecycle and replay checks, and capturing goes to the integrator. |
| The player starts outside its store launcher | the first dev build launches and reaches the main menu | Fix that first. Steam needs `steam_appid.txt` next to the exe (see *Building the dev player*). |

## The pieces

| Piece | What it does | Must |
| --- | --- | --- |
| **Harness assembly** | All harness code, in its own `.asmdef` under the integration folder, with `"defineConstraints": ["UNITY_EDITOR \|\| DEVELOPMENT_BUILD \|\| LUDEO_AGENT"]` | Never compile into a release or cloud build. Phase 7's folder check confirms no harness `.dll` ships. |
| **Job file** | JSON naming the scenario and its arguments (Ludeo id, how long to play, what to drive, which checks to make, a timeout). Read with `JsonUtility.FromJsonOverwrite` onto a class whose fields hold the defaults, so old jobs keep working as fields are added. | Live **outside the project**, one folder per job, with `result.json` written next to it. Be passed as `-ludeoAgentJob <path>` (fallback: `<persistentDataPath>/LudeoAgent/job.json`). Be **taken at start** (renamed `job.taken.json`), so a run that dies can't re-trigger on the next launch. |
| **Bootstrap** | `[RuntimeInitializeOnLoadMethod(AfterSceneLoad)]`: if a job exists, take it and create a `DontDestroyOnLoad` runner | Do nothing at all when there is no job. |
| **Launch override** _(replay)_ | Makes the SDK auto-start the job's Ludeo: sets `autoStartInLudeo = true` and `ludeoToAutoStart = <id>` on the **in-memory** `LudeoSettings` | Run at `BeforeSplashScreen`, before the layer calls `LudeoManager.Initialize()`: the SDK copies those settings **once**, at `Initialize`. Keep a strong reference to the settings object. Never write the asset, and refuse in the Editor, where a changed ScriptableObject can get saved into it. Requires `runWithoutLauncher = true`. Record what it did in the result ([an-auto-start-override-must-land-before-initialize-copies-the-settings](../learnings/engine-quirks/an-auto-start-override-must-land-before-initialize-copies-the-settings.md)). |
| **Runner and scenarios** | Runs the scenario as ordered steps, each with a start, a done check, a timeout and a failure reason, and logs every step on the integration's own trace (SDK clock format) | Record per step what it saw, not just pass/fail. Two scenarios cover most work: `capture-run` and `replay`. |
| **Game drivers** | Start a run, clear a room, open and close a screen, end a run, return to the menu, **through the game's own entry points** (its methods, its button handlers) | Never take a shortcut around game code, or the run tests the shortcut. |
| **Stand-ins** | Do what an idle test player never does: damage one enemy through its normal damage method (a kill), kill the player through the damage path (a death), give the player invulnerability frames so a damage objective doesn't end the replay mid-test | Enter at the **earliest game-owned seam**, so the game's own feedback, run-end flow and action code run. Say in the report which run used a stand-in. |
| **Profile borrow + save block** | Runs play on an in-memory copy of a fixed profile; the game's save is refused for the run, and the result says the save file is untouched | Keep runs independent of the integrator's own save, which changes as they play ([harness-runs-must-not-depend-on-the-integrators-own-save](../learnings/common-mistakes/harness-runs-must-not-depend-on-the-integrators-own-save.md)). |
| **Stand-in Play click** _(replay)_ | `AgentSimulateRoomReady()` on the layer re-enters the **same** begin path a viewer's Play click takes, so a replay can begin with nobody connected ([stand-in-for-the-play-click-so-the-harness-can-replay-alone](../learnings/architecture/stand-in-for-the-play-click-so-the-harness-can-replay-alone.md)) | Call the real path. It can't click, so a screen the run reaches is recorded, not dismissed. Also offer a mode where the launcher presses the overlay's own Play key (read from the log) and the harness waits for the real `RoomReady`. |
| **Log watch** | Hooks `Application.logMessageReceived`. Counts exceptions, collects SDK teardown signatures (`LudeoResult::Canceled`, `still alive at shutdown`), and **aborts the run** when one message (digits normalised) repeats more than about 200 times | Never log from inside its own handler. |
| **Result** | `result.json`: verdict, per-check `{name, pass, detail}`, the SDK calls with result and time, actions sent/rejected/dropped, the wave's restore tables, a one-line SDK state (`init=… session=… flow=…`), duration | Be written atomically **before** the player quits. Lines logged during the quit itself are only in the player log. If the capture lasts until the quit (no game event closes it), write a `provisional` result after the last step and the final one from the quit hook after teardown, and judge `EndGameplay`/`CloseRoom` only on the final one. |

Optional extras: a per-frame probe of both clocks around the freeze and unfreeze, and fault injection
that makes a restore stage throw on purpose. Log an `injected fault` line, or the run tested nothing.

## Building the dev player

Build it the way the studio builds, plus the Development flag: through the studio's Build Profile, its
build-configuration asset or its CI build method. Never use Unity's Build Settings dialog or a bare
`BuildPlayer` call with your own options
([build-players-only-through-the-studios-own-pipeline](../learnings/common-mistakes/build-players-only-through-the-studios-own-pipeline.md)).
With a Unity 6 Build Profile:

```csharp
// Editor-only, in the integration's Editor folder.
public static void BuildDev()
{
    var profile = AssetDatabase.LoadAssetAtPath<BuildProfile>("<the studio's profile asset>");
    var report = BuildPipeline.BuildPlayer(new BuildPlayerWithProfileOptions {
        buildProfile = profile,
        locationPathName = GetArg("-ludeoBuildOut") ?? "../<Game>-builds/dev/<Game>.exe",
        options = BuildOptions.Development,      // the harness assembly only compiles into Development builds
    });
    Debug.Log($"[LudeoBuild] result={report.summary.result} errors={report.summary.totalErrors}");
    if (report.summary.result != BuildResult.Succeeded && Application.isBatchMode) EditorApplication.Exit(1);
}
```

```bash
"<Unity.exe>" -batchmode -quit -projectPath "<ABS_PROJECT>" \
  -executeMethod <Ns>.LudeoAgentBuild.BuildDev -ludeoBuildOut "<ABS_BUILDS>/dev/<Game>.exe" -logFile "<ABS_LOG>"
```

- **Judge it from the log and the files:** `[LudeoBuild] result=Succeeded`, the exe and
  `<Game>_Data/Managed/*.dll` newer than your last edit, and your harness assembly present in
  `Managed/`. Exit code 0 alone proves nothing.
- **Keep the builds folder next to the project, not inside it.** Agree the folders with the integrator
  and keep only those, for example `dev` for the harness build and `cloud` for the upload. Job sets
  live there too (`<builds>/jobs-<topic>/<job>/job.json`).
- **The store launcher.** A Steam game launched outside Steam asks Steam to relaunch it and quits
  (`SteamAPI.RestartAppIfNecessary`) unless `steam_appid.txt` is next to the exe. A Unity build doesn't
  write that file, so copy it in with a post-build step. Every job in a folder without it exits in about
  two seconds with no `result.json`.
- **The dev build's Ludeo login** comes from `LudeoSettings`, or better from a `LudeoConfig.ini` next to
  the exe that the layer applies before `Initialize()`. Then the cloud build carries no test id.
- **Never rebuild into a folder someone is playing from.** A file held open by the integrator's running
  game makes the build replace the folder only partly (new managed code, old native code). If the
  integrator hand-plays, give them a frozen copy (`<builds>/handrun`).

## Launching a run

Launch from a **script file**, not an inline command: nested quoting in an inline launch once started
the game without its job. A minimal launcher (PowerShell):

```powershell
param([string]$JobDir, [string]$Log, [int]$TimeoutSec = 480)
$exe = '<ABS_BUILDS>\dev\<Game>.exe'
$job = Join-Path $JobDir 'job.json'; $res = Join-Path $JobDir 'result.json'
if (-not (Test-Path $job) -and (Test-Path "$JobDir\job.taken.json")) { Copy-Item "$JobDir\job.taken.json" $job }
if (Get-CimInstance Win32_Process | Where-Object Name -eq '<Game>.exe') { 'a game process is already running: not starting'; exit 3 }
if (Test-Path $res) { Move-Item $res "$res.prev" -Force }
$p = Start-Process $exe -WorkingDirectory (Split-Path $exe) -PassThru -ArgumentList @(
  '-screen-fullscreen','0','-screen-width','1280','-screen-height','720',
  '-ludeoAgentJob', "`"$job`"", '-logFile', "`"$Log`"")
if (-not $p.WaitForExit($TimeoutSec * 1000)) { "TIMEOUT: stopping my own pid $($p.Id)"; Stop-Process -Id $p.Id -Force }
$r = Get-Content $res -Raw | ConvertFrom-Json
"pass=$($r.pass)"; $r.checks | Where-Object { -not $_.pass } | ForEach-Object { "FAIL: $($_.name) :: $($_.detail)" }
```

- **One game process at a time**, started from its own folder, windowed. **Stop only a process you
  started**, by its id. Never kill one by name: it may be the integrator's.
- **One numbered log per run** in `ludeo-integration-plan/logs/` (git-ignored), named
  `NN-<topic>-<job>.log`, with a copy of `result.json` beside it. The tracker cites those numbers as
  evidence.
- **Learn the healthy duration** on the first good run. A run that takes several times that is a wrong
  setting, not a slow boot. Read the log rather than waiting.

## Capturing a moment

The creator's real job is pressing the highlight key, and a script can press it. The overlay listens to
the keyboard of the focused window, so this needs a desktop session, not `-batchmode -nographics`.

1. **The job decides when.** It drives the game to the moment and logs a marker line
   (`agent: MARK <label>`) at the planned second. Pick a moment mid-run, past the first segment, with the
   current wave's state on screen, and before the game's own run timer can end the run.
2. **The launcher presses the key** when the marker appears in the log:
   - Read the key from the overlay's own line,
     `LudeoSdkConfig received -- bindings rebuilt (… HighlightCapture='F9' …)`. The platform config sets
     it per environment and it has changed between SDK versions (`Shift + F4`, then `F9`), so a
     hard-coded key silently marks nothing.
   - Bring the game to the front. First press and release Alt with `keybd_event` (otherwise Windows
     ignores a background process's first `SetForegroundWindow`), then call `ShowWindow` and
     `SetForegroundWindow`. Check that `GetForegroundWindow` returns the game before sending.
   - Send the key: `[System.Windows.Forms.SendKeys]::SendWait('{F9}')`, with `+` for Shift, `^` for
     Ctrl, `%` for Alt.
3. **Confirm from the log**, matching exact lines case-sensitively. The wording differs between SDK
   versions. One integration saw `Ludeo highlight taken!` then
   `SessionMarkHighlightTask: Finished with LudeoResult::Success`. Another saw
   `broadcastEvent name='LudeoMarkHighlight'` then `ludeo_Session_MarkHighlight succeeded`, then
   `Sending video data … <N> bytes` and the upload's `close graceful=true`. Both end in the SDK's record
   of the capture, which holds the ids and the time together:
   `onCaptureVideoRequest. gameplayId=<guid>, highlightId=<guid>, startTime=…`
   ([enumerate-captures-from-the-sdk-log-not-from-what-you-were-handed](../learnings/common-mistakes/enumerate-captures-from-the-sdk-log-not-from-what-you-were-handed.md)).
   A screenshot right after the key shows the overlay's saving toast. This is also the agent's own
   proof of phase 3's "the capture overlay works". It needs no person, and an idle overlay widget that
   never draws proves nothing either way. Two lines are noise, not failure:
   `[LegacyMediaCapture] Failed calling capture service with MarkHighlight data!` when the log earlier
   says `Core video enabled. Setting Legacy video to: Dummy`, and
   `failed to parse gameplays.gameplay-ready payload`. A capture proves the clip was taken and uploaded,
   not what it shows: open the clip before trusting it. A highlight taken before phase 5 has no tracked
   state, so it can't become a playable Ludeo; say so when you report it.
4. **Know what the clip will contain.** A clip starts about two seconds after `BeginGameplay`, whatever
   the maximum duration. A playable Ludeo ends when its own time limit runs out, which on the integrations
   so far was roughly the clip's length (the local overlay pauses the game and shows its end screen). So
   a replay of a short clip ends early, and a scripted flow longer than the clip is cut off by the
   content, not by a bug.
5. **Hand over in one message.** For each moment give the `gameplayId`, `highlightId`, capture time
   (UTC), clip length and what it contains ("wave 2, mid-run, boss at half health"). Add a trim hint when
   the useful part starts later ("trim the start to after +40 s"). Flag clips that are too short or missed
   the content. Ask the integrator to turn them into Ludeos in Creator Lab and send back the Ludeo ids.
   Record every moment in `ludeo-integration-plan/LUDEOS.md`:

   | Ludeo id | Captured (UTC, highlightId) | Wave / schema | Contains | Status |
   | --- | --- | --- | --- | --- |

   Status moves from `captured` to `replayed` to `confirmed` (its wave was signed off), or to `stale`.
   A capture made before the latest change to what the game writes is stale for the waves after it.

A capture run plays the game for real. Keep the integrator's save out of it with the profile borrow
and save block, or back the save up first and restore it afterwards.

## Replaying a Ludeo

```json
{ "id": "w1-replay-3", "scenario": "replay", "ludeoId": "<guid>", "pressPlay": "simulate",
  "observeSeconds": 15, "quitWhenDone": true, "requireSdk": true, "timeoutSeconds": 240 }
```

1. The launch override auto-starts the Ludeo. The scenario waits for each stage of the layer's replay
   boot in turn: Ludeo selected, `GetLudeo` delivered, scene loaded, world ready, restore applied and
   verified, frozen and waiting. Then it presses the stand-in Play click (`simulate`), or has the launcher
   press the overlay's Play key (`overlay`).
2. After Begin it samples once a second: the clock advancing, time scale above zero, input live, which
   screens are open, the wave's key values. It takes screenshots on the frozen pre-play screen and after
   Begin.
3. **Replay to replay is simulated locally.** The auto-start delivers exactly one `LudeoSelected`. When
   the clip's time runs out, the local overlay pauses the game for good (`PauseGameRequested`, with no
   resume) and asks for end-of-run recommendations. A second selection comes only from the platform,
   when someone clicks one. A harness step that re-selects through the layer still tests the layer's
   own re-entry, including a re-selection **during** the first boot (a viewer pressing Replay early),
   which reaches code no clean replay does. Label it simulated, and put the real replay-to-replay on the
   cloud checklist for the integrator.
4. **Fit the flow inside the clip.** Everything the job does after Begin must finish within the Ludeo's
   clip length. Split long flows (run to the end, continue, start another run) into separate jobs.

Restoring a moment is not replaying it. The SDK puts the state back and the game runs forward on its own
logic. The harness checks the restored state and that the game then runs; it does not play inputs back.

## Actions (phase 6)

- **Count the game's own events independently.** Have the harness count the event each action hangs
  off, and compare that with the SDK sends in `result.json` (`sent`, `rejected`, `dropped`). A pass is
  equal counts in both flows, nothing rejected, and **zero sends before Begin** in a replay.
- **Plan which runs can reach each action.** An idle player never dies, kills or completes much, so a
  replay can pass every check while sending no gameplay action at all. List which actions each scenario
  can physically reach. Failures (death, game over) and hard successes (a boss kill) need a stand-in,
  forced through the game's damage path and never by calling the action directly, or a hand-played run.
  Run a forced outcome in a replay as well as a capture: suppression during the restore and the hand-back
  after it live in the replay path.
- **Make Studio Lab list every action.** Run one creator job that sends each action once after Begin.
  Studio Lab lists an action only after a build has sent it
  ([studio-lab-lists-an-action-only-after-a-build-sent-it](../learnings/common-mistakes/studio-lab-lists-an-action-only-after-a-build-sent-it.md)).

## What a pass must show

A verdict of `passed` is not the proof. Read the evidence:

- **The right Ludeo:** the id in the restore log is the one you meant.
- **The values came back:** compare the restored values with the Ludeo's own recorded ones, read from the
  restored data (expected == live, per object and per value), not with defaults. A game's own "run
  start" setup can grant defaults on top of a restore and still let a shallow check pass.
- **The game runs:** the clock advances, time scale is above zero, input is live, and no unexpected
  screen is open.
- **The player sees it:** open the screenshots and read what is on screen, including counters and
  labels. On one integration every model check passed while the on-screen counter read `0/8`, against a
  model correctly holding 2 of 8.
- **Placement:** nothing restored sits in empty space, through the floor or far from the geometry.
- **The number of checks**, not only the failures. A run that stalled before the restore writes no
  restore checks, and a grep for failures calls it a pass.

Anything the harness can't confirm goes into the wave's evidence as an open item. Don't drop it.

## Regression sets and fresh profiles

- **Keep job sets.** Every replay job that once passed stays in a set (`jobs-<topic>/`). After each
  change to capture or restore code, re-run the whole set with one script that prints one line per job
  (pass, failed checks). On one integration 28 jobs ran unattended after every change.
- **When a set breaks, check the environment before the code.** Once, 9 of 45 jobs failed because the
  integrator's save had changed, and the same jobs passed on a fresh profile. That's why runs borrow a
  fixed profile.
- **Fresh-profile runs.** Before the cloud, run the key replays on an empty profile: move the game's save
  folder aside, run, and restore the folder in a `finally`. Check that the run created no save.
  First-time popups and tutorials that the integrator's own save dismissed long ago appear only here,
  and every cloud viewer sees them.
- **A local build of the cloud configuration.** The cloud build has no harness. To test cloud-only code
  (store client removed, menu exits locked) with the harness, build the cloud configuration plus the
  harness define and the Development flag into its own folder, with a `NOT_FOR_UPLOAD.txt` in it. Let
  the phase-7 build gate accept the cloud define only together with the harness define.
- **A held quit:** close the player with `CloseMainWindow`, time the exit, and check the exit code, both
  with a live capture and without one. A quit hold that finishes synchronously can leave the window open
  forever, and only a player build shows it.

## The wave sign-off

At the end of each wave, give the integrator one short evidence bundle and the existing question,
*"wave N restores — widen to wave N+1?"*:

- the Ludeos replayed (from `LUDEOS.md`) and each run's verdict and duration;
- the screenshots;
- the restored-vs-recorded comparison for the wave's values;
- anything open: a screen the harness couldn't press, a value it couldn't read, an action no run reached.

## When a person still has to play

Some things no honest stand-in can reach: content locked behind progress the test profile lacks, how a
fight feels, whether a button is clickable. Ask for a short hand-played run of a frozen copy of the build.
Then read their log yourself (on Windows,
`%USERPROFILE%\AppData\LocalLow\<Company>\<Product>\Player.log`) instead of asking what happened.

## Pitfalls

- **An external click ends a pre-play wait early.** On a shared machine another session or a person can
  press the overlay's Play button. Re-run rather than loosen the check.
- **A game's own fast-boot or skip-intro flag** can take a less-used start-up path. If runs crash in the
  front end only with it on, the flag is the cause, not the integration.
- **Screenshots of a covered window.** `CopyFromScreen` captures whatever window is on top. Use
  `PrintWindow(hwnd, dc, 2)` (`PW_RENDERFULLCONTENT`) on the game's window handle, or
  `ScreenCapture.CaptureScreenshot` from inside the harness.
- **Let in-flight work land before a scripted end.** A harness that ends a run through the game's own
  end-run call while a pickup or projectile is still animating can hit the game's own exceptions, and a
  "0 exceptions" check then fails on a game bug. Wait a few seconds (bounded) for in-flight work first,
  and record the game's bug in the handoff rather than hiding it.
- **Pause spans need a per-frame watcher.** When screens pause the Ludeo, check every frame on every
  job: no pause left open after its screen closed, no screen open without its pause, opened == closed
  at the end, and nothing kept progressing under a pause.
- **Watch for exact result markers.** A watcher matching `FAIL` was fooled by the harness's own
  "no failures" line. Match whole lines such as `RESULT (DONE|FAIL)`.
- **Delete files by literal path**, never through a pattern built from a variable that may be empty.
- **The Editor play-mode variant.** The same runner works in Editor play mode through the Unity CLI
  ([`agent-editor-tooling.md`](agent-editor-tooling.md)). There, write the job file **before** focusing
  the Editor, because the reload on focus is what arms the runner. Batch-mode play runs (lifecycle only,
  with no overlay and so no capture) need three extra guards:
  - wait until the Ludeo package's post-compile setup has run (`!EditorApplication.isCompiling &&
    !isUpdating` and some `EditorApplication.update` ticks) before entering play mode, or it throws
    `should not call UpdateDllName at runtime`;
  - call `EditorApplication.Exit(nonzero)` if play mode ends without a result, or the process holds
    the project lock forever;
  - keep the result out of `Temp/`, which Unity deletes on a clean exit.
