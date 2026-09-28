# Agent test harness — capturing and replaying Ludeos without a person at the keyboard (Unity 6+)

With the Editor tooling from phase 1 ([`agent-editor-tooling.md`](agent-editor-tooling.md)), the agent can
compile and inspect, but the gates that matter most still need someone to play: capture a moment, then
play the Ludeo made from it and watch whether it restores. A small in-game **test harness** lets the agent
do both itself. It drives the game to a moment and captures it. Once the integrator has turned that moment
into a Ludeo, it replays the Ludeo, samples the running game, takes screenshots and writes a result file.

**Who does what once it exists**

| The agent | The integrator |
| --- | --- |
| Builds the harness (phase 3 task 6, extended in phase 5 task 3) | — |
| Drives the game to a moment and **captures** it | **Turns the captured moment into a Ludeo** and sends back its id (the agent names the moment) |
| **Replays** each Ludeo, reads the result file, looks at the screenshots, fixes and re-runs | Approves plans (census, restore rows), as before |
| Collects the evidence for each wave | **Signs off once per wave** from that evidence: "wave N restores — widen?" |

> **Status.** Replay was automated end to end on one integration and capture on another. The two have
> not yet been run together on one integration, and the recipe below is written from both. Treat each
> step's check as the proof, and capture a learning wherever this recipe turns out wrong.

## When to build it

Only with the Editor tooling set up (Unity 6+, phase 1 Step 0c). Without it, the gates stay with the
integrator as the phase files describe. Build it in two steps:

- **Phase 3, task 6** — the core (job file, entry point, pre-run check, runner, result writer) and the
  **capture** scenario. The capture overlay exists from phase 3 on, so capture can be automated there.
- **Phase 5, task 3** — the **replay** scenario and the stand-in Play click, because they need the
  restore flow that task builds.

All harness code is test-only: Editor-only, or fenced `#if UNITY_EDITOR || DEVELOPMENT_BUILD || LUDEO_AGENT`
(pick the define your layer uses). Put it in the integration's own folder, never in the game's code. It
must do nothing in a normal play session.

## The pieces

| Piece | What it does | Must |
| --- | --- | --- |
| **Job file** | JSON naming the scenario, its arguments, a timeout, whether to exit play mode when done, and an explicit "run the SDK in play mode" opt-in | Live **outside `Assets/` and outside `Temp/`**, because Unity deletes `Temp/` on a clean exit, taking the evidence with it. Be **consumed and deleted at run start**, so a run that dies can't re-trigger on the next Play. |
| **Entry point** (Editor-only) | Refuses if play mode is running or a compile is in progress. Runs the pre-run check, writes the job file, and enters play mode | Set `EditorSceneManager.playModeStartScene` to the boot scene while a job exists (clear it on return to edit mode). Pressing Play in any other scene may boot nothing. |
| **Pre-run check** | Checks and **repairs** every setting a run needs, then refuses loudly if something can't be repaired | Cover at least: the layer's or plugin's "Ludeo in play mode" toggle; no leaked cloud-build define; `runWithoutLauncher`; `autoStartInLudeo` + `ludeoToAutoStart` (replay only); a dirty scene (reload it, or the run stops on a save dialog). Also offer a read-only *describe* call that reports all of them. |
| **Runner** | A `MonoBehaviour` created by `[RuntimeInitializeOnLoadMethod]` **only when a job file exists**. Runs the scenario's steps in order, each with a timeout, counts errors and repeated log lines, writes the result | Stay dormant with no job file. |
| **Scenarios** | Named, ordered steps: each has a start, a done check, a timeout and a failure reason | Record per step what it saw, not just pass/fail. |
| **Stand-in Play click** (replay only) | A test-only method on the layer that re-enters the **same** begin path a viewer's Play click takes (`RoomReady` → begin), so a replay can start with nobody connected | Call the real path, never a shortcut around it. It **can't click**: a screen the run reaches is recorded, not dismissed. |
| **Result and evidence** | `result.json` (verdict, per-step detail, error counts, duration), a run log, a once-a-second sample of the running game, screenshots (`ScreenCapture.CaptureScreenshot`) | Be the only thing the agent needs to judge the run. |
| *Optional:* screen driver | Presses through blocking screens using the game's **own** button handlers | Be **off by default**. An untouched replay is the stricter test, because an unexpected screen is often the bug. |
| *Optional:* fault injection | Makes a restore stage throw or hang on purpose, to prove the player is never left in a frozen world | Log an `injected fault` line. A fault run without that line tested nothing. |

## Running one

Start it through the CLI, then **wait for the result file from the shell**. Make no call that compiles or
refreshes while it runs (`agent-editor-tooling.md` → *Play mode is running*):

```bash
unity command eval "<LayerNamespace>.AgentEntry.Run(\"replay\", \"w1-replay-3\");" --project-path "<ABS_PROJECT>"
# then poll ludeo-integration-plan/agent/runs/w1-replay-3/result.json from the shell
```

If the project's Pipeline has no `eval`, expose `Run` as a project CLI command instead (the `unity-cli`
skill covers `[CliCommand]`). **Learn the healthy duration** on the first good run. On one integration it
was about 55 s for a 30-second watch. **A run that takes several times that is a wrong setting, not a
slow boot:** stop and call the *describe* check rather than waiting.

## Capturing a moment

The overlay only runs in a **windowed** Editor (or player), so capture can't happen under `-batchmode`.

1. **Drive the game to the moment.** Use a scenario step: the game's own dev or cheat commands, scripted
   input, or simply playing on to a point in time. Capture **mid-run, past the first segment**. A
   capture at a level's origin can hide displaced-position bugs (phase 5 task 4's placement check).
   Include what the current wave tracks.
2. **Read the capture hotkey from the overlay's log**, not the docs. After activation the overlay logs its
   live bindings, and the environment can override the documented default:
   `LudeoSdkConfig received -- bindings rebuilt (… HighlightCapture='Shift + F4' …)`.
3. **Send that keypress to the Editor window while it's in the foreground** (`SendInput` / `keybd_event`
   from the shell). The overlay listens to the keyboard itself.
4. **Confirm from the log**, matching case-sensitively on exact lines: `Ludeo highlight taken!` and
   `SessionMarkHighlightTask: Finished with LudeoResult::Success`. Then take the capture's record from the SDK's
   own line, which holds the ids and the time together
   (see [enumerate-captures-from-the-sdk-log-not-from-what-you-were-handed](../learnings/common-mistakes/enumerate-captures-from-the-sdk-log-not-from-what-you-were-handed.md)):
   `onCaptureVideoRequest. gameplayId=<guid>, highlightId=<guid>, startTime=…`
5. **Hand over to the integrator.** Ask them to turn *that* moment into a Ludeo and send back the Ludeo
   id. Name it unambiguously: capture time, `highlightId`, and what the moment contains ("wave 2, mid-run,
   boss at half health"). Record it in `ludeo-integration-plan/LUDEOS.md`:

   | Ludeo id | Captured (time, highlightId) | Wave / schema | Contains | Status |
   | --- | --- | --- | --- | --- |

   Status moves `captured` → `replayed` → `confirmed` (the integrator signed off its wave), or `stale`.
   Phase 7 replays every `confirmed` Ludeo before an upload, first in the Editor and then on the build.

A capture made before the latest change to what the game writes is **stale** for the waves after it
(phase 5 → *Re-capture every wave*). Mark it so in `LUDEOS.md` rather than replaying it as proof.

If the game auto-saves during a run, **back up the save first** and restore it afterwards. A capture run
plays the game for real.

## Replaying a Ludeo

1. The pre-run check sets `runWithoutLauncher = true`, `autoStartInLudeo = true` and
   `ludeoToAutoStart = <id>`, so play mode boots straight into that Ludeo.
2. The scenario waits for each stage in turn: the Ludeo flow starting, the gameplay scene loading, the
   world being ready, the restore being applied. Then it presses the stand-in Play click and watches for
   N seconds, sampling once a second (clock advancing, time scale above zero, input not blocked, which
   screens are open, the wave's key values). It takes screenshots at the start and end.
3. For replay-twice tests, re-select the Ludeo through the layer's real re-selection path and observe
   again; the second run must show the second restore's state.
4. When testing is over, **turn `autoStartInLudeo` off.** Left on, every Play replays.

Restoring a moment is not replaying it. The SDK puts the state back and the game runs forward on its own
logic. The harness checks the restored state and that the game then runs; it does not play inputs back.

## What a pass must show

A verdict of `passed` is not the proof. Read the evidence:

- **The right Ludeo:** the id in the restore log is the one you meant.
- **The values came back:** compare the restored values against the Ludeo's own recorded ones, read from
  the restored data. A game's own "run start" setup can grant defaults on top of a restore and still let a
  shallow check pass.
- **The game runs:** the clock advances, time scale is above zero, input is live, no unexpected blocking
  screen.
- **The player sees it:** open the screenshots and check what is on screen, including counters and
  labels. On one integration every model check passed while the on-screen counter read `0/8` against a
  model correctly holding 2 of 8.
- **Placement:** nothing restored sits in empty space, through the floor or far from the geometry.

Anything the harness cannot confirm goes into the wave's evidence as an explicit open item for the
integrator's sign-off. Don't quietly drop it.

## The wave sign-off

At the end of each wave, give the integrator one short evidence bundle and the existing question, *"wave
N restores — widen to wave N+1?"*:

- the Ludeos replayed (from `LUDEOS.md`) and each run's verdict and duration;
- the screenshots;
- the restored-vs-recorded comparison for the wave's values;
- anything open (a screen the harness couldn't press, a value it couldn't read).

## Pitfalls

- **Opt in through the job file, not an Editor preference.** A running Editor can hold its own copy of
  a preference written from outside, so the toggle reads as off.
- **A game's own fast-boot or skip-intro flag** can take a less-used start-up path. If runs crash in the
  front end only with it on, the flag is the cause, not the integration.
- **Several agent sessions on one Editor:** a harness run is a play session. Tell the other sessions
  before starting one, and don't start one while another session is compiling.
- **Batch-mode runs of the same harness** (lifecycle checks only; there is no overlay, so no capture)
  need three extra guards: wait for the post-compile setup to finish before entering play mode; exit if play
  mode ends without a result, or the process holds the project lock forever; and keep the result file
  out of `Temp/`.
