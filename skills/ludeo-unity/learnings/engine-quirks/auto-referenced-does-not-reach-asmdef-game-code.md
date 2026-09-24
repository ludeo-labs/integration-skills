---
category: engine-quirks
tier: generalizable
sourceGame: SurvivalSample
phase: 1
question: "Does the game keep its own code in assembly definitions (.asmdef) rather than in Unity's predefined Assembly-CSharp? If so, the Ludeo package being 'auto-referenced' will NOT make the SDK visible to game code — every consuming .asmdef needs LudeoSDK added to its references list explicitly."
sanitized: true
---

# "Auto-referenced" does not mean "reachable from your game code"

Phase 1 states the package is auto-referenced, so `using LudeoSDK;` "must compile in a project
script with **no** asmdef reference and **no** scripting define". Both SDK asmdefs do ship with
`"autoReferenced": true`, so the claim looks self-evidently true.

It is true only for Unity's **predefined** assemblies (`Assembly-CSharp`,
`Assembly-CSharp-Editor`). `autoReferenced` means *"the predefined assemblies reference me
automatically"*. An assembly with its own `.asmdef` references **exactly** what its `references`
array lists, and nothing else. Auto-referencing does not reach into it.

Any large or long-lived project keeps its gameplay code in asmdefs. So on a real codebase the
phase-1 statement is usually **false**, and the failure looks like a packaging problem:

```
Assets/Scripts/<Layer>/<Probe>.cs(15,11): error CS0246:
  The type or namespace name 'LudeoSDK' could not be found
  (are you missing a using directive or an assembly reference?)
```

— even though the package resolved, `Library/ScriptAssemblies/LudeoSDK.dll` was built, and the
`LudeoSDK` assembly was loaded in the domain with all its types present. Everything about the
install was fine; only the reference edge was missing.

## The fix — two mechanical additions

Add the SDK to the `references` array of every assembly that consumes it. Runtime assembly:

```json
{ "name": "Game.Core",   "references": [ "LudeoSDK", ... ] }
```

Editor assembly (needs both — `LudeoSDKUnityEditor` is where the project-setup helpers live):

```json
{ "name": "Game.Editor", "references": [ "LudeoSDK", "LudeoSDKUnityEditor", ... ] }
```

These are the smallest possible game-file edits — one array entry each — and they are *required*
for correctness, not a nicety. Do not try to avoid them by moving Ludeo code out into
`Assembly-CSharp`: the layer has to call into gameplay types that live in those asmdefs anyway.

## Check before you claim the criterion is met

The phase-1 gate "SDK references resolve" is only meaningfully proved from an assembly the
**game's own code** lives in. Two weaker proofs will mislead you:

| Weak proof | Why it does not settle it |
|---|---|
| `Library/ScriptAssemblies/LudeoSDK.dll` exists | proves the *package* compiled, not that anything can reach it |
| reflecting over `AppDomain` and finding the `LudeoSDK` assembly + types | proves it is loaded; reference edges are a *compile-time* fact, invisible here |

So: put a throwaway `using LudeoSDK;` file **inside the game's runtime asmdef folder**, compile,
and read the errors. That is the only check that answers the question.

Also worth knowing while diagnosing this: an agent/MCP editor bridge that compiles a snippet per
call has its own fixed reference set and typically **cannot** see a newly installed package either —
so a `CS0246` from the bridge is not evidence about your project at all.
