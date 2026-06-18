---
category: engine-quirks
tier: universal
sourceGame: FPSGameStarterKit
phase: 2
question: "Does this BP-only project have a Source/ directory? If no AND packaging is needed, you MUST create a minimal Source/ with Target.cs + Build.cs + primary game module. Do NOT rely on UBT auto-generating targets — that only happens when certain plugins (like CommonUI) are enabled."
sanitized: true
---

# BP-only projects need a minimal Source/ module to package with C++ plugins

## The Problem

A Blueprint-only UE project with C++ plugins (like LudeoUESDK) **will not package correctly** unless there is a minimal game module with `IMPLEMENT_PRIMARY_GAME_MODULE`. Without it:

1. `BuildCookRun -build` silently skips game-target compilation (no error, just no artifacts)
2. Plugin DLLs only get built for the Editor target, not the Game target
3. The packaged `.exe` loads at runtime and fails with: `Plugin 'LudeoUESDK' failed to load because module 'LudeoUESDK' could not be found`
4. If you add Target.cs files alone, linking the monolithic game exe fails with unresolved externals: `GInternalProjectName`, `GForeignEngineDir`, `GIsGameAgnosticExe`, `FMemory_Malloc`, `FMemory_Realloc`, `FMemory_Free`, `GNameBlocksDebug`, `GObjectArrayForDebugVisualizers`, `GDebuggingState` — all defined by `IMPLEMENT_PRIMARY_GAME_MODULE`.

## Relationship to `bp-only-project-ubt-auto-targets.md`

The other learning says "Do NOT create Source/ for Blueprint-only projects." That is **only true when UBT auto-generates Target.cs files** — which happens when certain plugins (e.g., CommonUI) trigger the "treated as code-based project" flow.

**Decision matrix:**

| Project state | Action |
|---------------|--------|
| BP-only + CommonUI (or similar auto-trigger plugin) | Do NOT create Source/ — UBT auto-generates targets |
| BP-only + C++ plugins but no auto-trigger | **MUST create minimal Source/ with primary game module** |
| Has existing C++ modules | Use existing target files |

**How to tell which case you're in:** Check `Intermediate/Source/` after a clean build. If auto-generated `.Target.cs` files appear there, you're in the auto-generate case. If not, you need manual Source/.

## The Fix

Create this minimal structure:

```
Source/
  <GameName>/
    <GameName>.Target.cs
    <GameName>Editor.Target.cs
    <GameName>.Build.cs
    <GameName>.cpp
    <GameName>.h
```

**`<GameName>.Target.cs`:**
```csharp
using UnrealBuildTool;
using System.Collections.Generic;

public class <GameName>Target : TargetRules
{
    public <GameName>Target(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("<GameName>");
    }
}
```

**`<GameName>Editor.Target.cs`:** Same pattern, `Type = TargetType.Editor`.

**`<GameName>.Build.cs`:**
```csharp
using UnrealBuildTool;

public class <GameName> : ModuleRules
{
    public <GameName>(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core", "CoreUObject", "Engine", "InputCore",
        });
    }
}
```

**`<GameName>.cpp`:**
```cpp
#include "<GameName>.h"
#include "Modules/ModuleManager.h"

IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, <GameName>, "<GameName>");
```

**`<GameName>.h`:**
```cpp
#pragma once
#include "CoreMinimal.h"
```

**Also update `.uproject`** — add the module so the editor knows about it:
```json
{
    "FileVersion": 3,
    "EngineAssociation": "5.7",
    "Modules": [
        {
            "Name": "<GameName>",
            "Type": "Runtime",
            "LoadingPhase": "Default"
        }
    ],
    "Plugins": [ ... ]
}
```

## Why `IMPLEMENT_PRIMARY_GAME_MODULE` Is Required

The macro defines critical globals used by the monolithic game exe: `GInternalProjectName`, `GForeignEngineDir`, `GIsGameAgnosticExe`, and the `FMemory_*` allocator functions (`PER_MODULE_BOILERPLATE`). Without a primary game module, the monolithic linker can't resolve these symbols. Editor targets work without it because `UnrealEditor.exe` is a pre-built engine executable that provides them — but the game target builds a project-specific exe that must provide them itself.
