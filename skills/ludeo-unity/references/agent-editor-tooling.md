# Unity CLI + Pipeline package — the agent's way into a Unity Editor (Unity 6+)

Unity's command-line tool (`unity`) plus one package in the game's project (**Pipeline**,
`com.unity.pipeline`) let the agent drive a Unity Editor from its shell: read scenes, prefabs and
components, run C# inside the Editor, and recompile. **It does not need an Editor window open.** The CLI
can start a headless Editor itself.

In this skill it has one main job, plus extras:

- **Main job: reading a project whose assets aren't saved as text** (case B in
  [`agent-project-reading.md`](agent-project-reading.md)). Projects saved as Force Text are read from
  the files, and projects before Unity 6 use the scene-dump script.
- **Extras:** compiling inside a running headless Editor, and querying the integrator's open Editor.
- **Running the game** stays with the dev-player test harness
  ([`agent-test-harness.md`](agent-test-harness.md)) on every Unity version.

> **Status.** The CLI is in beta and the Pipeline package is experimental. The commands, timings and
> behaviours below were checked on Unity 6000.3.7f1, CLI 1.0.0-beta.5 and `com.unity.pipeline`
> 0.8.0-exp.1, on a project saved as binary. Re-check names with `unity command --project-path …` on
> the version you install, and capture a learning wherever this file turns out wrong. The CLI's own
> reference is Unity's `unity-cli` agent skill and docs.unity.com → Unity CLI.

## When it applies

| Check | How | If not met |
| --- | --- | --- |
| Unity **6000.0 or later** | `ProjectSettings/ProjectVersion.txt` | Skip this file. The package declares `"unity": "6000.0"`. Read the project with the scene-dump script (`agent-project-reading.md` → case C). |
| The integrator **agrees** to the package on the integration branch | the offer below | Skip it and use the scene-dump script instead. Don't ask again unless they bring it up. |
| The project path is **short** (Windows) | project path length + ~150 characters stays under 260 | The package's own files fail to import from a deep path (`DirectoryNotFoundException` under `Library\PackageCache\com.unity.pipeline@…`). Ask about a shorter checkout path, or use the scene-dump script. |

## The offer (phase 1 Step 0c, for case B)

It adds a package to the game's project, so offer it, and install it only on a yes:

> "Your project's scenes and prefabs are saved in Unity's binary format, so I can't read them as files.
> Unity's own command-line tool can read them through a headless copy of the Editor, with nothing open
> on your screen. It needs one Unity package, **Pipeline**, added to the project on the integration
> branch only, and I'll ask at the end whether you want to keep it. I won't change how your project
> saves its files. Shall I add it?"

## Install — each piece, then check it

Run the checks. Don't report a piece as set up because its install command exited cleanly.

1. **The `unity` CLI.** `unity --version`. If it's missing, install it with Unity's installer (current
   commands in the `unity-cli` skill; on Windows:
   `$env:UNITY_CLI_CHANNEL='beta'; irm https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.ps1 | iex`),
   open a new shell, and check `unity --version` again. `unity auth status` must show a signed-in user.
2. **The CLI's agent skill.**
   - Claude Code: `claude plugin marketplace add Unity-Technologies/unity-agent-plugin`, then
     `claude plugin install unity@unity-agent-plugin`. It loads in the next session.
   - Other agents: `unity skill install <client>`.
   - Load the skill before CLI work; it is the reference for the CLI itself.
3. **The Pipeline package.** `unity pipeline install --project-path "<ABS_PROJECT>"`. This only adds the
   package to `Packages/manifest.json`, in about a second, and the next Editor that opens the project
   resolves it. Quote the path.
4. **Commit** `Packages/manifest.json` and `Packages/packages-lock.json` on the integration branch as their
   own commit ("add Pipeline package for agent Editor access"). A package that lived only in one working
   copy vanished on the first revert, along with everything that depended on it.
5. **Check it works:** start a headless Editor (next section), then:
   - `unity command --project-path "<ABS_PROJECT>"` lists the commands (160 on 0.8.0-exp.1, including
     `eval`);
   - `unity command eval --code 'return UnityEngine.Application.dataPath;' --project-path "<ABS_PROJECT>"`
     returns **this** project's path.

## Three ways to reach an Editor

| Way | How | Cost | Use it for |
| --- | --- | --- | --- |
| **A resident headless Editor** (default) | `"<Unity.exe>" -batchmode -nographics -projectPath "<ABS_PROJECT>" -logFile "<ABS_LOG>"`, with **no `-quit`**, started in the background. Then `unity command <name> … --project-path "<ABS_PROJECT>"`. | Start-up once (a few seconds on a warm `Library`), then about 0.2–0.8 s per command. Holds a Unity license seat and the project lock while it runs. | Reading phases (2, 4, every wave's deep scope); compiling while it runs. |
| **One-shot** | `unity run "<ABS_PROJECT>" --command <name> --format ndjson -- <args>` | A fresh batch Editor per call (about 7 s on a small warm project), then it exits. | A single query when nothing else is running. |
| **The integrator's open Editor** | `unity command … --project-path "<ABS_PROJECT>"` against their running Editor | None, but it's their Editor. | Only when they keep the Editor open and agree. Read-only. |

Facts that matter (checked):

- **Wait for the headless Editor with `unity command`, not `unity status`.** A batch-mode Editor is not
  listed by `unity status` (it reports `STATUS_NO_INSTANCES`) but answers `unity command` within seconds.
- **A one-shot reuses a running Editor.** With a resident or open Editor on the project, `unity run
  --command` answers in about 0.2 s and reports `"reusedRunningEditor": true`.
- **One Editor per project.** While any Editor holds the project, a separate `-batchmode` run (a compile,
  the dev-player build) is refused: `It looks like another Unity instance is running with this project
  open`. Stop the resident Editor first, or do the work inside it.
- **One-shot output:** the result is a single JSON line on stdout with `--format ndjson`; the Editor's
  own log goes to stderr. A `Thread was being aborted` error during its shutdown is noise.
- **Stop a resident Editor with `eval`.** The `quit` command fails in the Editor (it is meant for players):
  `unity command eval --code 'UnityEditor.EditorApplication.delayCall += () => UnityEditor.EditorApplication.Exit(0); return "exiting";' --project-path "<ABS_PROJECT>"`.
  It's gone in about a second and the lock is released. Never kill an Editor you didn't start.

## Reading commands (read-only)

| Need | Command |
| --- | --- |
| Scenes in the build, build target | `get_build_settings`; `list_build_profiles` (Unity 6 Build Profiles) |
| Open a scene to read it (headless Editor only) | `open_scene --path Assets/…/X.unity` |
| A scene's GameObject tree with component names | `get_scene_hierarchy` (optionally `--path`) |
| Objects by name, tag, component type or path | `find_gameobjects` |
| One component's serialized values (custom fields included) | `get_component_properties --target <name or hierarchy path> --type <ComponentType>`; `get_serialized_fields` |
| Assets by type or name | `find_assets --type GameObject` for prefabs (`Prefab` is not a type), `--type <ScriptableObject class>`, `--name …`; `search` (Unity Search) |
| Anything else, read-only | `eval --code '<C# returning a value>'` (Roslyn, no recompile, no domain reload; about 0.8 s) |

**Never call a mutating command while reading:** anything named `save_*`, `set_*`, `create_*`,
`delete_*`, `add_*`, `remove_*`, `apply_*`, `revert_*`, `move_*`, `rename_*`, `unpack_*`,
`instantiate_*`, `switch_build_target`, and no `eval` that changes assets or calls `AssetDatabase.Refresh`.
In the integrator's own Editor, don't `open_scene` either: it changes their open scene.

## Compiling inside a resident Editor

The headless Editor doesn't notice file edits on its own. After editing `.cs` files:

1. `unity command recompile --project-path …`, then poll `unity command recompile_status` until
   `completed` (about 3 s on a small project) or `up_to_date`.
2. Check errors with `unity command console_status` (error counts and the compile-failure flag) and read
   them with `unity command console`.
3. Judge it as any compile: your new types or fields are visible (for example through
   `get_component_properties`), not only "no errors".

Or stop the resident Editor and use the usual headless compile (`3e-compile-and-fix.md`). **Builds** of the
dev player and the cloud player go through the studio's own pipeline as usual, so stop the resident Editor
before them. A build started from inside the resident Editor is untested here.

## Rules

| When… | Do this | Why |
| --- | --- | --- |
| **Play mode is running** in an Editor you drive | Trigger no compile and no asset refresh until play stops. | A domain reload mid-play wipes every static while `isPlaying` stays true, so every value read afterwards is meaningless; on one integration it crashed the Editor. The CLI docs say `command` and `eval` themselves don't recompile. |
| **Judging a compile** | Order the timestamps (edit, then `.dll` in `Library/ScriptAssemblies/`, then the log) and look for your type names. | A failed compile leaves the previous `.dll` in place. |
| **No Editor answers** | Check `unity pipeline list --project-path …` (is the package resolved?) and the Editor log for compile errors. | Compile errors put the Editor in **Safe Mode**, which loads no packages, so the CLI can't connect exactly when you need it to fix them (`unity-cli` → *Recovering from Safe Mode*). |
| **A new `.cs` file** would fix the current compile errors | Prefer fixing inside existing files. | Unity defers importing new scripts while the project has compile errors. |
| **Several agent sessions or Editors on one machine** | Pass `--project-path` on every command; before any compile or reload in a shared Editor, ask the other session and wait for an answer. | Without it the CLI targets the Editor whose project contains the current directory. A compile in a shared Editor kills the others' play sessions. |

## Optional: the Pipeline inside the dev player (untested here)

Per Unity's docs (Pipeline manual → *Runtime setup*), a **Development** standalone build that contains a
`RuntimePipelineManager` with `enableInBuilds = true` serves the CLI too:
`unity command --runtime "<Game>.exe" <command>`. It offers `eval` against live game state, `console`,
`set_timescale`, `quit`, and `simulate_key` / `simulate_pointer` (Input System only). The code is compiled
out of non-development builds. It could make debugging a restore faster. It does **not** replace the
harness's Win32 key send for the capture hotkey: the Ludeo overlay reads the keyboard itself, and
`simulate_key` goes through Unity's Input System. No Ludeo integration has tried it; capture a learning if
you do.

## If the project already has an MCP bridge into the Editor

Some projects arrive with one installed, usually the AI Assistant package (`com.unity.ai.assistant`),
whose MCP server exposes a run-this-C# tool. Unity now marks that server deprecated in favour of the CLI.
Don't install one for this skill, and don't remove one the integrator uses. If the agent ends up
connected to one:

- **Use one route at a time.** The CLI and the bridge can each compile and reload the same Editor.
  Default to the CLI, and say when you switch.
- **Pin it to this project.** Its relay attaches to the **first** Editor it finds unless its MCP entry
  carries `--project-path <ABS_PROJECT>` (or `UNITY_PROJECT_PATH`). Without that it has run calls in
  another project's Editor.
- **If its tools vanish** mid-session, read `Logs/relay.txt` (last `connection.established` /
  `connection.lost`; timestamps are UTC) and `Library/AI.MCP/connections-v2.asset` (`Status: 4` plus a
  `ValidationReason` = a refused connection). Usually it's the Unity plan's connection cap. Free a slot;
  don't restart the Editor.
- **An idle stop isn't a dead bridge.** The relay stops after ~3 minutes idle and reconnects on the next
  call. Make one harmless call.
- **Connections need the integrator's approval** under *Project Settings → AI → Unity MCP Server →
  Pending Connections*.
- **Every call compiles a C# snippet**, so on a bridge make no calls at all between play start and stop.
- **A reported failure may not be one.** The bridge reports failure whenever anything logged a warning
  during the call. Check what the call was meant to write before believing it.

## Removing it (phase 8, if the integrator says no)

Remove `com.unity.pipeline` from `Packages/manifest.json` (and let the lock file update), confirm the
project still compiles, and commit that on the integration branch. The CLI and its skill are on the
agent's machine, not in the game, so they stay.
