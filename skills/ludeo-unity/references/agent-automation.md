# Running the integration automatically — what the agent does in each phase, and what it asks

**The default for every integration: the agent runs the integration itself.** It compiles headlessly,
builds a Development player with a test harness inside, plays the game through that harness, captures
moments by pressing the highlight key, replays the Ludeos the integrator sends back, reads its own logs,
results and screenshots, builds the cloud player and prepares the upload. Every phase gate is the
agent's to run and judge. It stops only for the few things that need a person, listed below, and
batches those into as few messages as it can.

This is not a shortcut around the gates. Each one is held to a stricter standard than a person watching
the screen: a written result, the restored values compared with the recorded ones, screenshots read,
and the log lines cited. How it is done: [`agent-test-harness.md`](agent-test-harness.md). The optional
in-Editor tooling (Unity 6+): [`agent-editor-tooling.md`](agent-editor-tooling.md).

> **Evidence.** One integration ran phases 1–8 this way. The agent ran every compile, about 200
> harness runs, the capture/replay loop for every wave, both action flows, regression sets after each
> change, fresh-profile runs, the cloud build and the upload (after an explicit yes). The integrator
> answered product questions, turned captured moments into Ludeos, checked Studio Lab and played the
> cloud build.

## What stays with the integrator

Ask for these, and nothing else the agent can run:

| Need | Why a person | How to ask |
| --- | --- | --- |
| **Credentials**: the Ludeo `apiKey`, a test Steam id and beta branch, the CLI access token | secrets, and accounts the agent mustn't create | once, in phase 1 (token in phase 7). Keep the token in a file outside the repo and pass it per command. |
| **Installs that need an administrator**: the Unity Editor version, a missing build module | elevation prompts the agent can't answer | name the exact version or module, and the check you'll run afterwards |
| **Product decisions**: scope, waves, what a good moment is, the launch model, what a replay may and may not do | the integrator owns the game | as concrete either/or choices, with your recommendation |
| **Plan approvals**: the census and waves (phase 4), each wave's entity rows and restore-plan rows (phase 5 gates 0 and 2), the action map (phase 6) | they are product calls in table form | batch them where you can (one message with the rows and your recommendation); keep working on what doesn't depend on the answer |
| **Turning captured moments into Ludeos** in Creator Lab, and sending back the ids | the agent has no Creator Lab access | one message per batch: `gameplayId`, `highlightId`, capture time, clip length, contents, trim hint (`agent-test-harness.md` → *Capturing a moment*) |
| **Studio Lab**: Global Triggers, goals, checking that actions are listed | the integrator's account | at phases 6–7, unless they accept the browser-control offer (`learnings/architecture/offer-to-set-up-studio-lab-with-browser-control.md`) |
| **A hand-played run**, only when no honest stand-in reaches it | progress the test profile lacks, how something feels | name what the run must reach, and play a frozen copy of the build. Read their `Player.log` yourself. |
| **One sign-off per wave**, from the evidence bundle | they decide when it is good enough | *"wave N restores — widen to wave N+1?"* with the bundle (`agent-test-harness.md` → *The wave sign-off*) |
| **The upload go-ahead**, after a reviewed dry run | outward-facing (phase 7 banner) | the exact command, in the message that asks |
| **Assigning the build to an environment and playing it on the cloud** | the agent can't play a cloud Ludeo | after `success`, with what to check and which log to send back |
| **Commits and pushes**, when their rules require approval | their repository | follow their rules. Commit checkpoints when asked; never push without asking. |

## Phase 1 readiness check (do this before the baseline)

Find out what the agent can run on this machine, fix what it can, and tell the integrator in one
message what remains:

1. **Unity Editor** for `ProjectSettings/ProjectVersion.txt` installed? If not, ask the integrator to
   install it (Hub; the CLI installer can need administrator rights).
2. **Headless compile works:** no Editor holds the project (no `Temp/UnityLockfile`, no `Unity.exe` with
   this `-projectPath`), then the baseline `-batchmode -quit -logFile` run
   (`learnings/common-mistakes/agent-can-run-unity-compile-gates-headlessly.md`).
3. **A dev player can be built and launched:** find the studio's build pipeline (Build Profile assets,
   a build-configuration asset, a CI method) and the defines it owns
   (`learnings/engine-quirks/a-build-profile-can-own-defines-the-editor-never-compiles.md`). Build once
   with the Development flag and launch it: does it reach the main menu outside the store launcher?
4. **A desktop session** where the agent's shell can open and focus windows (for capture and screenshots).
5. **Other agent sessions or Editors on this machine?** List running `Unity.exe` processes with their
   `-projectPath`, and read `learnings/common-mistakes/parallel-agent-sessions-share-one-editor.md`.
6. **Optional, Unity 6+:** offer the Editor tooling (`agent-editor-tooling.md`) for in-Editor scene
   queries. The harness does not need it.

If 2 or 3 can't be met, the agent still writes and compiles code where it can and hands the run gates to
the integrator, as each phase file describes for that case. If only 4 fails, the harness still runs
lifecycle and replay jobs, and only the key press of each capture goes to the integrator (they press it
at the moment you name, in a run you launched). Say plainly what each gap costs.

## Phase by phase

| Phase | The agent runs | Proof it reads | It asks |
| --- | --- | --- | --- |
| **1** install | plugin download and install; hand-written `LudeoSettings.asset` (`learnings/engine-quirks/hand-author-ludeosettings-asset-write-every-field.md`); baseline and SDK-enabled compiles; the `Initialize()` smoke test, headless and in the dev player; the readiness check above | `0 error CS`, `.dll` newer than the edits, your type names in it; `init=Success create=Success` in the player log | credentials, the Editor install, KYG product questions |
| **2** map code | the code map (subagents), cross-checked by the orchestrator | the map parses; key facts spot-checked against the code | nothing new |
| **3** lifecycle | the layer; the compile gate; **the harness core and the dev player build (task 6)**; the overlay check by pressing the highlight key | a capture run's `result.json` (every lifecycle call `Success`, spans balanced, save untouched); `onCaptureVideoRequest` with a `highlightId` | how to get the game to a capturable moment, if no dev command does it |
| **4** census | the census and wave plan; size checks against the object ceiling | counts per type from a harness capture run, not only from code | approval of the census and waves |
| **5** tracking and restore, per wave | deep scope; capture code; **a capture run per wave**; restore plan; restore code; **replays of the integrator's Ludeos**, judged from the result, the restored-vs-recorded values and the screenshots; the fix loop | `agent-test-harness.md` → *What a pass must show* | the Ludeo ids for each batch of captured moments; the restore-plan approval; the wave sign-off |
| **6** actions | the action map and code; a creator run and a replay that count the game's events against the SDK sends; stand-ins for what an idle player never does; one run that sends every action once, so Studio Lab lists them | equal counts in both flows, nothing rejected, nothing sent before Begin | Studio Lab triggers and goals (or the browser-control offer); a hand-played run only for unreachable actions |
| **7** cloud | the regression set and fresh-profile runs; the cloud build through the studio's pipeline (after asking once); the build gate; the folder checks; a 30-second launch test of `run.bat`; the dry run; **after an explicit yes**, the upload; polling to `success` | the gate line, the folder scan, the launch log, the dry-run file list, `builds get` status | the access token; SDK version confirmation; the upload go-ahead; environment assignment and a cloud play |
| **8** polish and widen | the gap check; new waves through phases 4–5 the same way; the regression set after every change; the re-upload | as in phases 5–7 | which gaps to close; the final scope |

A cloud-only failure after upload: mirror the game's log to the debug channel so the cloud log shows it
(`learnings/engine-quirks/cloud-proton-drops-unity-stdout-so-logfile-dash-buys-nothing.md`), reproduce it
with a harness job built around what the cloud log shows (for example a re-selection mid-boot), and ask
the integrator for the cloud session's log.

## How to work

- **Verify by running, not by reading.** A deep scope or a code reading is a hypothesis. On one
  integration three static conclusions turned out wrong on the first run that reached them (an object
  hidden by a death effect the reading missed, a profile that played a different level than assumed, a
  hazard's timing). Before building a wave on a claim about runtime behaviour, write a small harness job
  that measures it.
- **Keep working while waiting.** When a question or a Ludeo id is pending, carry on with whatever
  doesn't depend on it: the next wave's deep scope, read-only mapping, the regression set, the cloud
  folder checks. Never edit code under a build you have declared upload-ready. Note in the tracker what
  is blocked on whom.
- **Records that survive sessions** (in `ludeo-integration-plan/`; create `HANDOFF.md`,
  `PHASE_TRACKER.md` and `LUDEOS.md` at the end of phase 1). "Re-verify before trusting" means: check the
  branch and its last commits, that the builds and job folders it names exist and are as new as it says,
  and re-run one regression job before building on its claims.
  - `HANDOFF.md`: rewritten at the end of each session. What is done, what is in the cloud, the
    integrator's binding rules, the exact build/run/upload commands, known gaps and next steps. A new
    session reads it first and re-verifies before trusting it.
  - `PHASE_TRACKER.md`: an append-only log of decisions, evidence (log numbers) and learnings per phase.
  - `LUDEOS.md`: every captured moment and Ludeo, with its status.
  - `logs/NN-<topic>-<job>.log` and `.result.json`: the evidence (git-ignored).
  - Job sets in the builds folder next to the project (`jobs-<topic>/<job>/job.json`).
- **Subagents write code one at a time** on files that overlap. The orchestrator judges each task from
  the run's result file and log, not from the subagent's summary.
- **Report with evidence.** Every "it works" cites a log or result file; every failure is shown as it is.
  Say which checks a stand-in made possible and what no run reached.
- **On a shared machine**, before any Unity launch: no lockfile, no `Unity.exe` on this project, no game
  process you didn't start. Drive an MCP bridge only after confirming it is attached to this project.
  Never overwrite a shared CLI login (`learnings/common-mistakes/ludeo-cli-set-token-ignores-config.md`):
  pass the token per command and keep it out of logs.
