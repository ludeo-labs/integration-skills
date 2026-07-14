---
category: engine-quirks
tier: universal
sourceGame: ActionRoguelike
phase: 3
question: null
sanitized: true
---

# How to compile UE projects from CLI

## Option 1: UnrealBuildTool (fastest for compile-fix loop)

```bash
"<UE_ROOT>/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe" <TargetName> Win64 Development -Project="<absolute-path-to>.uproject" -WaitMutex -FromMsBuild
```

### Finding UE_ROOT

1. Read `.uproject` -> `EngineAssociation` (e.g., "5.7")
2. Check launcher data: `C:/ProgramData/Epic/UnrealEngineLauncher/LauncherInstalled.dat`
3. Find the entry with matching version -> `InstallLocation` is UE_ROOT

### Finding TargetName

Look for `Source/<GameName>.Target.cs` -- the filename prefix is the target name.

### Tips

- Use `run_in_background: true` since builds take 10-120 seconds
- Pipe output through `| tail -40` to see errors without flooding
- Use `grep "error C"` for compiler errors, `grep "error LNK"` for linker errors
- UBT uses adaptive builds via `git status` -- modified files are excluded from unity and compiled individually
