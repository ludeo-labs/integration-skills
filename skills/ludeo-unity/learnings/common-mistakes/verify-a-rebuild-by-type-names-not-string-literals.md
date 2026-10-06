---
category: common-mistakes
tier: universal
sourceGame: SurvivalSample
phase: "1,3,5,6,7"
question: "Are you judging whether your code compiled from a console read, an errorCount, a zero `error CS` grep, or a string literal found in the .dll? None of those settles it. Gate on the assembly's mtime being newer than your edit, then confirm your TYPE names are in it — Unity can re-print the previous compile's messages, a zero error count means nothing until you know a compile ran, and compiled string literals are UTF-16 so a plain grep never finds them."
sanitized: true
---

# Prove a rebuild from the assembly — timestamp first, then type names

Three signals are routinely read as "it compiled", and each one can say so when nothing was built. The
reliable check is always the same two steps: **the assembly's mtime is newer than every source you
edited, and your type names are in it.**

## Trap 1: the console can be the last compile, re-printed

Three new files were added to a project open in the Editor. An agent editor bridge's console read came
back with `errorCount: 0` and the usual 47 pre-existing warnings, timestamped **seconds after** the last
file was saved. That reads as "recompiled, clean". `Library/ScriptAssemblies/` told the truth:

```
<Runtime>.dll          13:22:49      # runtime file (13:21) - really compiled
<Editor>.dll           13:22:48      # editor files (13:23, 13:25) — NEVER compiled
```

Unity had re-printed the 13:22:48 compile's messages when the console refreshed; the warning timestamps
advanced while the assemblies did not move at all. Two of the three files had never been through a
compiler, and one had a hard error waiting in it. It was reported to the integrator as "four of five
files compiled"; they focused the Editor and got four `error CS0234`s from a one-line namespace mistake.

The obvious cross-checks failed too:

- **`.meta` files existed** for the new scripts. Import is not compilation.
- **`Editor.log` had no `error CS` lines** — with two Editors running, the one holding the project was
  not the one writing the log being read. Attribute log lines by the project path they mention.
- **The bridge's error-level filter returned warnings**, and its `errorCount` was `0` while four errors
  sat in the Console. Pull a large unfiltered page and grep the message text yourself.
- **`CompilationPipeline.RequestScriptCompilation()` set `isCompiling = true` and then produced nothing**
  for 12 minutes. Requesting a compile is not getting one — and passing
  `RequestScriptCompilationOptions.CleanBuildCache` rebuilds the *whole project*, a long stall on a
  large project and one you inflict on anyone else sharing the Editor. Do not reach for it.

## Trap 2: a zero error count from a compile that never ran

A `-batchmode` run reported **zero `error CS`** and looked like a clean pass. It had compiled nothing:
it died before compilation on a licensing failure and exited 198. Grepping for `error CS` on a log whose
compile never ran returns 0, indistinguishable from success.

Do not use `Exiting batchmode successfully` as the discriminator either — on one project that line was
observed **missing from runs that succeeded and from runs that failed to compile**, so it separates
nothing. The timestamp and type-name checks below are what discriminate. When a batch run dies early,
read the licensing lines (`No valid Unity Editor license found`, `No ULF license found`,
`Found 0 entitlements`); a license can lapse **between** runs, so yesterday's green headless gate is no
evidence about today's.

## Trap 3: string literals are invisible to a plain grep

[[prove-the-log-came-from-the-build-you-just-made]] suggests searching the built assembly for a literal
you added. **In a managed assembly that search fails for code that is definitely present**, because the
two live in different metadata heaps with different encodings:

| What | Heap | Encoding | `grep -a` finds it? |
|---|---|---|---|
| type / namespace / method / field names | `#Strings` | **UTF-8** | ✅ yes |
| `"string literals"` in code | `#US` (user strings) | **UTF-16** | ❌ no |

Observed: a freshly rebuilt assembly where both new type names were found while two distinctive literals
from the same files were both "missing". The natural reading — "my edit didn't compile" — is exactly
backwards. (If you really need a literal, search for it UTF-16-encoded; type names answer the same
question.)

## The check, in order of strength

1. **Timestamps** — the assembly's mtime must be newer than every source file you edited:
   ```bash
   ls -l --time-style=+%H:%M:%S Library/ScriptAssemblies/<Assembly>.dll
   ```
2. **Type names in the assembly** — cheap, correct, and needs no running Editor:
   ```bash
   grep -qa "MyNewType" Library/ScriptAssemblies/<Assembly>.dll && echo present
   ```
   In an assembly you just watched rebuild, that is compile proof.
3. **The types in a live domain** — reference them from a bridge snippet (it cannot compile unless each
   type landed), or reflect over the loaded assembly and also assert base types
   (`typeof(X).BaseType`), which catches a layer that bound to a game class shadowing a framework name
   ([[layer-namespace-can-silently-inherit-the-games-base-types]]). Some bridges forbid
   `System.Reflection`; plain references still work.

Related: [[a-green-compile-does-not-prove-your-edit-compiled]] is the same family at the source level
(your edit sat in dead code); this one is at the artifact level (your edit was never built, or was built
and you mis-verified it). [[an-mcp-editor-bridge-compiles-every-call-never-during-play-mode]] is the same
bridge misleading you a different way.
