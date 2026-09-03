---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 7
question: "Are you using `dotnet build` on Unity's generated csproj as your compile check — and has this project ever actually produced a player build?"
sanitized: true
---

# `dotnet build` on Unity's generated csproj defines `UNITY_EDITOR`, so it cannot catch player-build-only breaks

Compile-checking with `dotnet build <Game>.csproj` is a big speed win over Editor round-trips and this skill
leans on it. But Unity generates that csproj for the **Editor**, and its `<DefineConstants>` includes
`UNITY_EDITOR;UNITY_EDITOR_64;UNITY_EDITOR_WIN` (plus `DEBUG`, `ENABLE_PROFILER`, `UNITY_ASSERTIONS`).

So a green `dotnet build` says *"this compiles in the Editor"* — **not** *"this will build a player."*
Anything declared inside `#if UNITY_EDITOR` but referenced from unguarded runtime code compiles fine for
you and fails the moment the user hits Build.

In the observed project the release build died at phase 7 with four errors, all one root cause: two
**real gameplay accessors** had been swept into a trailing `#if UNITY_EDITOR` block full of genuine debug
helpers (`HitDebug`, `KillDebug`, `LogAttacks`, …), while being called from three runtime sites. The tell
was that their backing **field** was declared *outside* the block. Every prior `dotnet build` in the
session had reported 0 errors.

**It had been broken for a long time and nobody knew**, because the project's player-build leg had been
deferred since phase 1 — the team only ever ran in the Editor. Expect this on any integration where phase 1
records the player-build smoke test as deferred: **phase 7 is the first time the player configuration is
ever compiled**, so budget for pre-existing breakage that is not yours.

## Simulate the player compile instead of guessing

Strip the editor defines and rebuild the same file set. One command, seconds, and it is ground truth:

```bash
# 1. pull DefineConstants out of the generated csproj, drop every UNITY_EDITOR* entry
python -c "import re; s=open('<Game>.csproj',encoding='utf8').read(); \
d=re.search(r'<DefineConstants>(.*?)</DefineConstants>',s,re.S).group(1).split(';'); \
open('defs.txt','w').write(';'.join(x for x in d if x and not x.startswith('UNITY_EDITOR')))"
```
```powershell
# 2. rebuild with those defines. Semicolons MUST be escaped as %3B or MSBuild reads them as
#    property separators and dies with "MSB1006: Property is not valid".
$defs = (Get-Content defs.txt -Raw).Trim() -replace ';','%3B'
dotnet build <Game>.csproj -p:DefineConstants=$defs `
  -p:BaseIntermediateOutputPath="$scratch\obj\" -p:OutputPath="$scratch\bin\"
```

Notes that cost time to work out:

- **Redirect `OutputPath`/`BaseIntermediateOutputPath` to scratch** so the simulation never touches the
  real `obj/`, `bin/`, or `Library/ScriptAssemblies` — you do not want to hand Unity a half-built assembly.
- **Do NOT add `-p:BuildProjectReferences=false`** to isolate the assembly. Referenced DLLs then never get
  built into the redirected output and you drown in `CS0006: Metadata file … could not be found`.
- **Editor-only referenced assemblies will fail, and that is expected.** Filter to the runtime assembly's
  own errors (`Where-Object { $_ -match "<Game>\.csproj" -and $_ -match ": error" }`). A third-party
  *Editor* project failing without `UNITY_EDITOR` is the simulation working, not a defect.
- The same blindness applies in reverse for **new editor scripts**: Unity's csproj does not list a
  just-created file, so `dotnet build` compiles nothing and reports 0 errors — a false green. Add the
  `<Compile Include>` entry before trusting it. See
  [[ludeosettings-namespace-is-ludeosdk-unityscripts-not-ludeosdk]], which was found exactly that way.

## Do this at the START of phase 7, not after the build fails

Run the simulated player compile *before* asking the user to build. A failed Editor build costs them a
round trip and produces no artifact, and the log has to be dug out of `Editor.log` to find out why. Two
minutes of simulation replaces that loop — and it cleanly separates "pre-existing project breakage" from
"something the integration did", which is the first question anyone asks.
