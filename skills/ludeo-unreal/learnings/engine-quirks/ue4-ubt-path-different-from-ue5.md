---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: 2
question: "Is this a UE4 source build, UE4 launcher install, or UE5? On UE4 source builds, UnrealBuildTool.exe lives at Engine/Binaries/DotNET/UnrealBuildTool.exe (no subdirectory) — different from UE5's Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe."
sanitized: true
---

# UE4 UBT path differs from UE5 — skill's how-to-compile assumes UE5

## The mistake

The skill's `learnings/engine-quirks/how-to-compile-ue-from-cli.md` shows the UE5 layout:

```
<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe
```

ActionGame is a UE4 source build. The correct path is:

```
<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool.exe   (no UnrealBuildTool/ subdir)
```

Calling the UE5 path on a UE4 build silently fails with bash `No such file or directory`. **If you pipe through `tee`, the failure is hidden** — `tee` succeeds (it captures the bash error message into the log) and the parent process sees `exit 0`. A subsequent `grep "error"` in the log finds nothing because UBT never ran. Lost ~5 min on ActionGame to this on 2026-04-29.

## How to detect which layout

```bash
ls "<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool.exe"   # UE4 if exists
ls "<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe"   # UE5 if exists
```

Check before issuing the build command on a project you haven't touched recently.

## The right way to invoke (UE4 source build)

```bash
"<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool.exe" \
    <TargetName> Win64 Development \
    -Project="<absolute-path-to>.uproject" \
    -WaitMutex -FromMsBuild \
    > "<log_path>" 2>&1
```

**Don't pipe through `tee`** — redirect stdout+stderr with `> log 2>&1`. If UBT fails to launch, the bash error lands in the log immediately and you can grep for it.

For UE4 launcher installs (vs. source builds), look for `UE_ROOT` in the launcher's `LauncherInstalled.dat` — same as UE5 in that respect.

## How to apply

When kicking off the first build on a UE-based project this session:
1. Read `.uproject` `EngineAssociation` field.
2. If association is a path (e.g., `"{...UUID...}"` for source builds) check the source's `Engine/Binaries/DotNET/` for `UnrealBuildTool.exe` directly first, then `UnrealBuildTool/UnrealBuildTool.exe`.
3. If association is a version string (`"5.7"`), look up the install location in `LauncherInstalled.dat` and use the UE5 layout.
4. Don't pipe through `tee`; redirect stderr alongside stdout to the same log so launch failures don't get hidden.
