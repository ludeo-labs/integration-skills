# Agent Editor tooling — letting the agent work in the Unity Editor itself (Unity 6+)

Without this, the agent can edit files but cannot touch the Editor: every compile check, every "does it
still run", every test run goes through the integrator ("focus the Editor", "press Play", "read me the
Console"). Unity's command-line tool, with one package in the game's project, gives the agent its own
way into the open Editor. It can compile, inspect the scene, run C# and start test runs by itself, and
the integrator is left with only what needs a person — playing a Ludeo and judging whether it looks
right.

| Piece | What it is | Where it lives |
| --- | --- | --- |
| **`unity` CLI** + its agent skill | Unity's command-line tool. Drives a running Editor (`unity status`, `unity command …`, `unity command eval "<C#>"`), and reads logs, lists Editors, etc. The skill teaches the agent how to use it. | The agent's machine. In Claude Code the skill is `unity:unity-cli`, from Unity's `unity` plugin. |
| **Pipeline package** (`com.unity.pipeline`) | The Editor side of the CLI. Without it the CLI can see no Editor at all. | The game's `Packages/manifest.json` |

This file is the single place for this tooling. Phase files point here instead of repeating it.

> **Status of this route.** Unity's AI Assistant documentation marks the Assistant's MCP server
> deprecated and points to the CLI instead. Earlier integrations drove the Editor through that MCP
> server, not the CLI, so no Ludeo integration has yet run end to end on the CLI. The rules below are
> only those that are about **Unity itself** (and so hold whichever tool triggers them) or that come
> from the CLI's own documentation. Problems seen only on the MCP server are in
> [the bridge section](#if-the-project-already-has-an-mcp-bridge-into-the-editor), not here. When
> the CLI behaves differently from what this file says, capture a learning.

## When it applies

Decide from facts you can check, before offering anything:

| Check | How | If not met |
| --- | --- | --- |
| Unity **6000.0 or later** | `ProjectSettings/ProjectVersion.txt` (recorded in phase 1 Step 0b) | **Skip this whole file.** The Pipeline package declares `"unity": "6000.0"`. Stay on the headless route: `-batchmode` compiles with the Editor closed (phase 3 · task 5). Tell the integrator the agent will ask them to compile and play more often. |
| The integrator **agrees** | the offer below | Skip it and say what that costs (more hand-offs). Don't ask again unless they bring it up. |

## The offer (phase 1, Step 0c)

Offer it; don't install it silently, because it adds a package to the game's project. Say, in plain
words:

> "Before the first compile I'd like to set myself up to work in your Unity Editor directly: Unity's
> command-line tool plus its agent skill on my side, and one Unity package, **Pipeline**, in your
> project, which lets the command-line tool talk to the open Editor. With it I can compile, check the
> scene and start test runs myself instead of asking you each time. Later I'll also build a small test
> harness so I can capture moments and replay Ludeos myself; you'd only turn captured moments into
> Ludeos for me and sign off each stage from the screenshots and results. The package goes on the integration
> branch only; at the end I'll ask whether you want to keep it. **(Recommended.)** Want me to go ahead?"

## Install — each piece, then check it

Run the checks. Don't report a piece as set up because its install command exited cleanly.

### 1. The `unity` CLI

```bash
unity --version            # already installed? stop here
```
If not, install it with Unity's installer (current commands are in the `unity-cli` skill, or at
docs.unity.com → Unity CLI). On Windows:
```powershell
$env:UNITY_CLI_CHANNEL='beta'; irm https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.ps1 | iex
```
Open a new shell so `unity` is on PATH. **Check:** `unity --version` prints a version.

### 2. The CLI's agent skill

- **Claude Code:** install Unity's plugin, which carries the `unity:unity-cli` skill:
  ```bash
  claude plugin marketplace add Unity-Technologies/unity-agent-plugin
  claude plugin install unity@unity-agent-plugin
  ```
  It loads in the **next** session, or after `/reload-plugins`. **Check:** `/unity:` lists `unity-cli`.
- **Any other agent:** the CLI installs the same skill into supported clients:
  `unity skill install --list`, then `unity skill install <client>`. If the client isn't listed,
  `unity skill show` prints the skill so the agent can read it.

**Load that skill before any Editor, package or build step** from here on. The rules below are the
Ludeo-specific additions; the skill is the reference for the CLI itself.

The agent drives the CLI from its shell, so it needs no MCP server for this. The CLI can also register
itself as one (`unity mcp configure`); skip that unless the agent has no shell.

### 3. The Pipeline package

```bash
unity pipeline install --project-path "<ABS_PROJECT>"
```
Quote the path; a space in it splits the argument. The Editor resolves the package on its next focus or
refresh. With more than one Editor open, pass `--project-path` to **every** Editor-driving `unity`
command from here on.

**Check, in this order:**
1. `unity status --format json` shows this project with state `ready`.
2. `unity command --project-path "<ABS_PROJECT>"` lists the commands this Editor exposes. **Look for
   `eval`.** Unity's docs say only some projects and Pipeline versions register it, and `eval` is what
   lets the agent run arbitrary C#.
3. One harmless call returns **this** project:
   ```bash
   unity command eval "return UnityEngine.Application.dataPath;" --project-path "<ABS_PROJECT>"
   ```

**If `eval` isn't listed**, use the commands that are. The `unity-cli` skill covers adding a project
command (`[CliCommand]`) for anything missing; put it in the integration's Editor-only folder. Tell the
integrator what the agent can and can't do without it, rather than falling back to asking them silently.

### 4. Commit the package change

Commit `Packages/manifest.json` and `Packages/packages-lock.json` **on the integration branch**, as their
own commit ("add Pipeline package for agent Editor access"). An integration whose Editor-access package
existed only in one machine's working copy lost it on the first revert. Every tool that depended on it
vanished with no error. Phase 8 asks whether to keep it before the branch merges.

## Which route when

| Situation | Use |
| --- | --- |
| Editor open, Pipeline `ready` | **The CLI** (`unity command …`, `unity command eval`) |
| No Editor open | Headless `-batchmode` with `-logFile` (phase 3 · task 5). **Only then:** an open Editor holds `Temp/UnityLockfile`, and batch mode refuses a locked project. |
| Player builds | The studio's own build pipeline (phase 7). Don't substitute `unity build` or Unity's Build Settings dialog: on one integration a player built with the dialog, outside the studio's pipeline, broke Steam launch, Addressables and audio at once. `unity build` was never tried there, so treat it the same until it's shown to run the studio's steps. |
| `unity test`, or `unity run` without `--command` | The CLI docs say each launches its own batch-mode Editor, so it hits the same lock while an Editor holds the project. `unity run --command <name>` is different: the same docs say it reuses an open Editor. |

## Rules learned the hard way

| When… | Do this | Why |
| --- | --- | --- |
| **Play mode is running** | **Trigger no compile and no asset refresh** until play stops: no `.cs` edit the Editor will pick up, no `AssetDatabase.Refresh`, no recompile command, no `eval` that does any of these. | A domain reload mid-play wipes every static while `isPlaying` stays true, so the session looks healthy and every value read afterwards is meaningless; on one integration it went on to crash the Editor. That is Unity's behaviour, whatever triggers it. (There, the trigger was an MCP bridge that compiles on every call.) The CLI docs say `command` and `eval` themselves run **with no recompile and no domain reload**, so a read-only `eval` mid-play is not that risk. No Ludeo integration has tested one yet, so the first time, check `Editor.log` around the call for a reload. |
| **Before compiling after a play run** | Believe play has stopped only on a signal this run created (its own result file, or the integrator saying so). | Log lines that look like "play exited" recur once per run, so an old one reads as a new one. |
| **Designing test runs** | Prefer an in-game runner: write a job file, enter play mode, let the runner do the work and write a result file, read that file from disk. | The same runner works unchanged under `-batchmode` and in a player build, and the evidence is a file on disk rather than text parsed out of a log. With the CLI this is a design choice, not a workaround. |
| **Judging a compile** | Order the timestamps (your edit, then the `.dll` in `Library/ScriptAssemblies/`, then the log), and look for your **type names** in the `.dll`. | A failed compile leaves the previous `.dll` in place. Zero `error CS` only proves *an* assembly exists. String literals survive from anywhere. |
| **`unity status` is empty** | Don't conclude "no Editor". Run `unity pipeline list`: the Pipeline hasn't resolved, or the Editor is in **Safe Mode** because of compile errors. | Safe Mode loads no packages (Unity behaviour), and the Pipeline is a package, so the CLI can't connect, precisely when you need it to fix the errors. Per the CLI's own docs: `unity-cli` → *Recovering from Safe Mode*. |
| **A new `.cs` file** would fix the current compile errors | Prefer fixing inside existing files. Otherwise close the Editor and compile headless. | Unity defers importing new scripts while the project has compile errors, so the file that would fix them never gets imported. |
| **Restarting the Editor** | Only when you must (leaving Safe Mode). Ask the integrator first. | It costs import time and any command-line flags the Editor was launched with. |
| **Several agent sessions share one Editor** | Before any compile or reload, ask the other session and wait for an answer. | Every compile is a domain reload in everyone's Editor. It kills their play session, and a human capture in progress leaves no file you could check first. |

## If the project already has an MCP bridge into the Editor

Some projects arrive with one already installed. The usual one is the AI Assistant package
(`com.unity.ai.assistant`), whose MCP server exposes a run-this-C# tool. Don't install one for this
skill, and don't remove one the integrator uses. If the agent ends up connected to one:

- **Use one route at a time.** The CLI and the bridge can each compile and reload the same Editor. With
  both in play you can't tell which one caused a reload, or which Editor you reached. Default to the
  CLI, and say when you switch.
- **Pin it to this project.** Its relay attaches to the **first** Editor it finds unless its MCP entry
  carries `--project-path <ABS_PROJECT>` (or `UNITY_PROJECT_PATH`). Without that it has run calls in
  another project's Editor.
- **If its tools vanish** mid-session, read `Logs/relay.txt` (last `connection.established` /
  `connection.lost`; the client id carries the Editor's process id; timestamps are UTC) and
  `Library/AI.MCP/connections-v2.asset` (`Status: 4` plus a `ValidationReason` = a refused connection).
  Usually it's the Unity plan's connection cap (3 on one plan). Free a slot; don't restart the Editor.
- **An idle stop isn't a dead bridge.** The relay stops after ~3 minutes idle and reconnects on the next
  call, which it doesn't log. Make one harmless call.
- **Connections need the integrator's approval** under *Project Settings → AI → Unity MCP Server →
  Pending Connections*. After an Editor restart, check that page before concluding the bridge is broken.
- **Every call compiles a C# snippet**, so on a bridge the play-mode rule covers *every* call, reads
  included: no bridge calls at all between play start and play stop.
- **A reported failure may not be one.** The bridge reports a call as failed whenever *anything* logged a
  warning during it, even when the call did its job. Check what the call was meant to write before
  believing it.

## Where this changes the workflow

| Phase | Change |
| --- | --- |
| 1 · Step 0c, 0d | The offer and install above; the agent then checks the baseline compile itself. |
| 1 · Steps 2, 4 | The agent sets up `LudeoSettings` and fires the one-time smoke test itself. |
| 2, 4 | The agent reads scenes and prefabs from the open Editor (no Force Text switch needed), and counts the object types that actually exist. |
| 3 · task 5 | The agent compiles and confirms the capture overlay itself (log line + screenshot). |
| 3 · task 6 → 5, 6 | The agent builds the **test harness** and from then on captures moments and replays Ludeos itself ([`agent-test-harness.md`](agent-test-harness.md)). The integrator turns captured moments into Ludeos, approves plans and signs off once per wave. |
| 7 | Replay every confirmed Ludeo before building. Builds go through the studio's own entry point only, which the agent may call through the CLI (no `unity build`). |
| 8 · Finalize | Ask whether the Pipeline package stays in the game's project. |

## Removing it (phase 8, if the integrator says no)

Remove `com.unity.pipeline` from `Packages/manifest.json` (and let the lock file update), confirm the
project still compiles, and commit that on the integration branch. The CLI and its skill are on the
agent's machine, not in the game, so they stay unless the integrator asks.
