---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: "1,3,5,6"
question: "Are you establishing a compile baseline (or checking whether a change added warnings) by deleting Library/ScriptAssemblies and re-running -batchmode? Unity's Bee build cache can restore the assemblies without re-running the compiler, so no warnings are re-emitted and you record a false zero."
sanitized: true
---

# A recompile you forced can still be a cache restore — a zero-warning baseline is usually a lie

Phase 1 asks for the **baseline `warning CS` count**, because without it "did my change add
warnings?" is unanswerable on a large codebase. The obvious way to force a real compile is to
delete the built assemblies and re-run:

```
rm -rf Library/ScriptAssemblies
Unity.exe -batchmode -quit -projectPath <proj> -logFile <log>
```

This **appears** to work. The run takes longer than a no-op, `Library/ScriptAssemblies/*.dll`
comes back with fresh timestamps, and the log shows two `Begin MonoManager ReloadAssembly`
blocks — every signal you would look for. Observed result on a ~1000-file project:

```
error CS: 0
warning CS: 0
```

Both numbers were wrong to trust. The very next run — which installed a package and therefore
genuinely invalidated the cache — reported **114 warnings, 88 of them from game code that had
not changed at all**.

## Why

Unity 6 compiles through **Bee**, which keeps its own build artifact cache under `Library/`
separate from `Library/ScriptAssemblies`. Deleting the output DLLs does not invalidate Bee's
cache: it simply **restores** them from cached artifacts without invoking the C# compiler.
No compiler invocation means no diagnostics, so warnings that genuinely exist in the source
are never re-emitted into the log.

The failure is silent and it is *directional* — it always under-reports. A baseline of 0
makes every future compile look like a regression, or (worse) makes a real regression
invisible because you assume the tool is noisy.

## How to get a number you can actually use

**Do not measure the baseline from a run you believe you forced. Measure it from a run that
was genuinely invalidated.** Practical options, cheapest first:

- **Take the baseline from the first run that changes the compilation inputs anyway** — e.g.
  the run right after installing the SDK package. That run definitely re-compiles. Attribute
  its warnings by path: the ones under `Assets/` are the game's pre-existing baseline, the ones
  under `Packages/<sdk>/` belong to the package. Both numbers are worth recording separately.
- **Confirm the compiler actually ran** before believing any count. Grep the log for real
  compilation activity rather than for assembly *reloads* — a reload happens either way.
- **Sanity-check against zero.** A codebase of any size with exactly 0 warnings is far more
  likely to be a cache restore than a pristine project. Treat 0 as a claim to verify, not a
  result to record.

## Watch the path separator when you attribute the warnings

On Windows the log writes `Assets\Scripts\...`, not `Assets/Scripts/...`. A grep for
`Assets/` returns almost nothing and reads as "no game-code warnings", which is the same
wrong conclusion by a different route. Use `grep -F 'Assets\'` (and mind that a trailing
backslash inside quotes is itself a shell error).

## Related

- [[agent-can-run-unity-compile-gates-headlessly]] — establishes that the agent should run these
  gates itself and capture the baseline warning count. This learning is the trap inside that
  instruction.
- [[a-green-compile-does-not-prove-your-edit-compiled]] — same family: a clean-looking compile
  result that never actually exercised the thing you care about.
