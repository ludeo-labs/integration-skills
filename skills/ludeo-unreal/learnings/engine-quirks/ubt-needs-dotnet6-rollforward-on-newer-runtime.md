---
category: engine-quirks
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 3
question: "Does the compile machine have the .NET 6 runtime installed? UE 4.27/5.0-5.3's bundled UnrealBuildTool.exe targets Microsoft.NETCore.App 6.0; on a box that only has newer runtimes (8/9/10) it exits immediately with 'You must install or update .NET ... version 6.0.0' and NOTHING compiles."
sanitized: true
---

# UE's bundled UBT.exe needs .NET 6 — set DOTNET_ROLL_FORWARD=Major on machines with only newer runtimes

## Precondition

You invoke `UnrealBuildTool.exe` directly (the fast compile-fix path from
`how-to-compile-ue-from-cli.md`, Option 1) on an engine in the UE 4.27 – 5.3 range, whose UBT
was built against `Microsoft.NETCore.App` **6.0**. The machine has a newer .NET (8/9/10) but
**not** the 6.0 runtime.

## The trap

UBT.exe refuses to launch:

```
You must install or update .NET to run this application.
Framework: 'Microsoft.NETCore.App', version '6.0.0' (x64)
The following frameworks were found:
  8.0.x ...  9.0.x ...  10.0.x ...
```

Insidious detail: if you wrap the invocation in a pipe (`... | tee log | tail`), the **pipeline**
exits 0 even though UBT never ran — so a naive exit-code check reports "build succeeded" when zero
files compiled. Always confirm the build log shows actual `[N/M] Compile` lines, not just an exit
code (and grep the log for `install or update .NET`).

## The fix

Tell the .NET host to roll a 6.0-targeted app forward onto the newest installed major runtime:

```bash
DOTNET_ROLL_FORWARD=Major "<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe" \
  <Target> Win64 Development -Project="<abs>.uproject" -WaitMutex -FromMsBuild
```

`DOTNET_ROLL_FORWARD=Major` (vs the default `Minor`) is what allows 6.0 → 8/9/10. With it the
build runs normally and UE's C++ compiles fine — this is purely a UBT (C#) host-runtime gate, not a
game-code issue.

## Alternatives (if roll-forward misbehaves)

- Install the .NET 6.0 **Desktop Runtime** (x64) so no roll-forward is needed.
- Use `Engine/Build/BatchFiles/Build.bat` — but it calls the same UBT.exe, so it hits the same gate
  unless the env var is set.

## Cross-reference

- `engine-quirks/how-to-compile-ue-from-cli.md` — the base CLI compile recipe this augments.
