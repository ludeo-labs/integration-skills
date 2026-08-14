---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "1,3,5,6"
question: "Is a matching Unity Editor installed on this machine, with shell access, and the project NOT currently open in the Editor (no Temp/UnityLockfile)? (Applies to EVERY compile gate, not just phase 1.)"
sanitized: true
---

# "The agent can't see the Console" does two different jobs — only one of them is valid

The phrase appears seven times across this skill, and it means two incompatible things:

| Usage | Where it reads like | Verdict |
|---|---|---|
| *"…can't see the Console, **so read the log**"* | the build/compile-and-fix guidance | **Correct.** The GUI is missing; the output is not. |
| *"…ends in a human gate (the agent can't see the Console…)"* | SKILL.md's orchestrated-phase description, the actions orchestrator's "unavoidable human touch-point" | **Wrong.** It converts a missing GUI into a missing capability, and hands away work the agent can do. |

**The defect is the shared phrase, not seven separate errors.** Read it as "no interactive
GUI" every time, and the first usage stays right while the second collapses.

`Debug.Log`/`LogWarning`/`LogError` — **including during play mode** — land in Unity's editor
log, which is the same stream the Console window renders. Verified directly: a `Debug.Log`
from an `-executeMethod` run was read straight out of the log file.

## Split the gate three ways, not two

| Half | Who | How |
|---|---|---|
| **Compile** (`error CS`, asset import, `-executeMethod` results) | agent | `-batchmode -quit` + grep the log |
| **Does it run without throwing** | agent | `-runTests` (see below), or `Debug.Log` breadcrumbs read back |
| **Does it look/feel right** | human | judgement on a live game; not automatable |

```
Unity.exe -batchmode -quit -projectPath <ABS_PROJECT> -logFile <ABS_LOG>
Unity.exe -batchmode -quit -projectPath <ABS_PROJECT> -executeMethod <Ns>.<Class>.<Method> -logFile <ABS_LOG>
```

Grep for `error CS`, `threw exception`, `UnityException`, `Exiting batchmode successfully`.

## ⚠️ Exit code 0 is NOT a pass signal

Observed: a run whose `-executeMethod` threw `UnityException` mid-way **still exited 0** and
still printed "Exiting batchmode successfully". Never conclude success from the exit code.

## Preconditions

- Matching Editor version installed (read `ProjectSettings/ProjectVersion.txt`).
- **Project not open** — a running Editor or a `Temp/UnityLockfile` makes batchmode fail.
- Warm `Library/` keeps runs to minutes.
- Capture the **baseline `warning CS` count** on the pre-install compile. Large codebases
  carry thousands; without that number "did my change add warnings?" is unanswerable.

## Play mode headlessly — and the trap in doing it

```
Unity.exe -runTests -batchmode -projectPath <ABS_PROJECT> \
  -testPlatform PlayMode -testResults <ABS>\results.xml -logFile <ABS_LOG>
```

`-testPlatform PlayMode` runs tests **in the Editor**; **any `BuildTarget` value instead runs
them on a built player**; omitting it defaults to EditMode.

> **⚠️ A PlayMode lifecycle harness collides with phase 1 Step 4.** That step forbids
> auto-firing `LudeoManager.Initialize()` in the Editor: it brings up the native/overlay
> layer, the Editor does **not** tear it down on stop, and it can leave the OS cursor hooked
> across the whole Editor. A test that drives
> `OpenRoom → AddPlayer → RoomReady → BeginGameplay → EndGameplay` on every agent invocation
> is exactly that — an auto-firing Editor init, on a loop.
>
> **Therefore: run a lifecycle harness on a `BuildTarget` platform (built player), not
> `PlayMode`.** The player process exits per run and cannot poison the Editor. Rigorous
> `End`/`Abort` on every exit path (CR-007) makes the Editor variant *survivable*, not safe —
> do not rely on it. This makes the lifecycle harness the **highest-risk** automation item,
> not the first one to build.

## Sequence the tooling by risk, not by analogy with the Unreal skill

The Unreal skill ships a Blueprint inspector and a Kismet dump commandlet because Blueprints
are **opaque binary assets that cannot be grepped**. That rationale does **not** transfer:
MonoBehaviours are C# text, and grep reads them fine. "Unreal has N tools, Unity has none"
overstates the gap and aims the work at the wrong target.

Unity's real opacity is narrower and genuinely there: **serialized Inspector values live in
scene/prefab YAML behind GUID references, not in code.** Which prefab a spawner points at,
what a manager's tunables are actually set to — invisible to grep, and exactly what the
object census needs. Worse where prefabs are placed at runtime through an asset-reference
system, which adds another indirection.

Build order, safest-first:

1. **Scene/prefab inspector** (editor script → JSON): resolves GUID references to asset
   paths and dumps serialized field values. No SDK init, no CR-007 exposure, and it replaces
   grep exactly where grep cannot reach.
2. **Player-build lifecycle harness** — after the first player build exists anyway.
3. **Editor PlayMode tests** — only for logic that never touches SDK init.

## Screenshots are possible but not a one-liner

`ScreenCapture.CaptureScreenshot` requires the `com.unity.modules.screencapture` module and
writes **at end of frame, asynchronously** — so it is fiddly under `-batchmode`, and useless
under `-nographics` where nothing renders. Budget real work for it; do not promise
"screenshot-on-restore" as a quick win.

## Genuinely out of reach

- Aesthetic judgement — does the restored moment feel like the captured one.
- Live overlay / real platform-auth interaction.
- Anything deferred to `EditorApplication.delayCall` under `-quit` —
  see [[headless-editor-setup-needs-executemethod]].
