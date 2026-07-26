---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: 3
question: "Does RunUAT BuildCookRun fail with C# 5 syntax errors? Check if AutomationTool at runtime finds the old .NET 4.0 MSBuild instead of VS's MSBuild."
sanitized: true
---

# UE4 AutomationTool uses different MSBuild at runtime than RunUAT.bat

## The Problem

RunUAT.bat's BuildCookRun fails with C# 5 syntax errors (string interpolation, local functions, getter-only auto-properties) on `.Automation.cs` scripts — even when Visual Studio with a modern C# compiler is installed and compiles the game fine.

## Root Cause

RunUAT.bat and AutomationTool.exe use **two completely different MSBuild resolution paths:**

1. **RunUAT.bat (compile phase):** Uses `GetMSBuildPath.bat` → `vswhere.exe` → finds VS 2017+ MSBuild with modern Roslyn compiler. This works fine.

2. **AutomationTool.exe (runtime script recompile):** Uses `WindowsExports.GetMSBuildToolPath()` → `UEBuildWindows.TryGetMsBuildPath()` which cascades through:
   - VS 2019 SetupConfiguration COM → VS 2017 → MSBuild 14.0 → **Registry 4.0 fallback**
   - If the SetupConfiguration COM interface fails (common on fresh VS installs or VS preview versions), it falls through to `HKLM\SOFTWARE\Microsoft\MSBuild\ToolsVersions\4.0` → `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe` (C# 5 only)

The key file: `Engine/Source/Programs/UnrealBuildTool/Platform/Windows/UEBuildWindows.cs` lines 1596-1649.

## Workaround

Use `UE4Editor-Cmd.exe -run=cook` directly instead of RunUAT BuildCookRun. This bypasses AutomationTool entirely:

```batch
UE4Editor-Cmd.exe Project.uproject -run=cook -TargetPlatform=WindowsNoEditor -Unversioned -iterate
```

## Proper Fix

Fix the `TryGetMsBuildPath()` in `UEBuildWindows.cs` to use vswhere.exe as a fallback (like `GetMSBuildPath.bat` does), or ensure the SetupConfiguration COM interface finds the installed VS.
