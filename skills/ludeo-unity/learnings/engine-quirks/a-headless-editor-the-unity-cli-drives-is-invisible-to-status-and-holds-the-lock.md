---
category: engine-quirks
tier: generalizable
sourceGame: TopDownRogueSample
phase: "1,2,4,5"
question: "Are you reading or compiling the project through the Unity CLI and the Pipeline package with a headless Editor (no Editor window open)?"
sanitized: true
---

# A headless Editor the Unity CLI drives is invisible to `unity status` and holds the project lock

The Unity CLI doesn't need an Editor window. Started with `-batchmode` and **no `-quit`**, an Editor
stays resident and answers `unity command` in 0.2–0.8 s. That makes it the fastest way to read a project
saved as binary. Checked on Unity 6000.3.7f1, CLI 1.0.0-beta.5 and `com.unity.pipeline` 0.8.0-exp.1;
re-check on the versions you install. Six things behave differently from what you'd assume:

| You'd assume | What happens | Do this |
| --- | --- | --- |
| `unity status` shows the Editor you started | It reports `STATUS_NO_INSTANCES`. Batch-mode Editors aren't listed. | Probe with `unity command --project-path "<ABS_PROJECT>"`: it lists the commands once the Editor is up (about 2 s on a warm project). |
| The headless Editor and a headless build can run together | A second batch run on the project fails: `It looks like another Unity instance is running with this project open`. | Stop the resident Editor before the dev-player or cloud build, or a separate compile. |
| The `quit` command stops it | `quit` fails in the Editor (it is for players). | `unity command eval --code 'UnityEditor.EditorApplication.delayCall += () => UnityEditor.EditorApplication.Exit(0); return "exiting";' --project-path "<ABS_PROJECT>"`. It's gone in about a second and the lock is free. |
| It picks up your `.cs` edits | A headless Editor doesn't refresh on its own. | `unity command recompile`, poll `recompile_status` until `completed`, check `console_status`. |
| `find_assets --type Prefab` lists prefabs | "Could not resolve type 'Prefab'". | `--type GameObject`. |
| The package installs anywhere | From a deep Windows path, its own DLLs fail to import (`DirectoryNotFoundException` under `Library\PackageCache\com.unity.pipeline@…`): a 278-character path, over the 260 limit. | Keep the project path short; if it can't move, read the project with the scene-dump script instead. |

Also useful: with a resident Editor up, a one-shot `unity run --command …` reuses it (about 0.2 s,
`"reusedRunningEditor": true`) instead of starting a second one, and a resident Editor holds a Unity
license seat until it exits.

Related: `references/agent-editor-tooling.md` (the full procedure),
[[parallel-agent-sessions-share-one-editor]].
