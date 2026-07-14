---
category: engine-quirks
tier: universal
sourceGame: FPSGameStarterKit
phase: 3
question: "Does this BP-only project have CommonUI enabled? If yes, UBT auto-generates .Target.cs and Source/ must NOT be created. If no, Source/ with minimal .Target.cs files IS required for packaging."
sanitized: true
---

# BP-only projects need Source/.Target.cs for packaging (unless CommonUI auto-generates them)

Blueprint-only UE projects have no `Source/` directory. For packaging to include C++ plugin DLLs, UBT needs `.Target.cs` files to know what to compile.

**Two scenarios:**

1. **CommonUI is enabled** (e.g., VoyagerV2) — UBT auto-generates `.Target.cs` in `Intermediate/Source/`. Do NOT create `Source/` manually — it causes CS0101 duplicate class conflicts with the auto-generated files.

2. **CommonUI is NOT enabled** (e.g., FPSGameStarterKit) — No auto-generated targets exist. You MUST create `Source/<GameName>/<GameName>.Target.cs` and `<GameName>Editor.Target.cs` with minimal TargetRules. Without these, `BuildCookRun -build` skips C++ compilation entirely — plugin modules and their RuntimeDependencies (DLLs) are never staged.

**Symptom of missing targets:** Packaged build has no `Binaries/` directory, and you get "Plugin 'X' failed to load because module 'X' could not be found" at runtime.

**Detection:** Check `Intermediate/Source/` for auto-generated `.Target.cs`. If empty, create `Source/` manually.

**The Target.cs files are minimal — no .Build.cs module needed:**
```csharp
// Source/<GameName>/<GameName>.Target.cs
using UnrealBuildTool;
public class <GameName>Target : TargetRules
{
    public <GameName>Target(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
    }
}
```
