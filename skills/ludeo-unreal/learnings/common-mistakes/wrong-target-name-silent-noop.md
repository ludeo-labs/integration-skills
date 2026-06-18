---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 2
question: null
sanitized: true
---

# Wrong -target name in BuildAndPackage.bat silently no-ops the build step

## The Mistake

When copying `BuildAndPackage.bat` from a prior integration (e.g., Lyra or VoyagerV2) to a new project, forgetting to update `-target=<OldGameName>` causes the `-build` step of `BuildCookRun` to silently skip compilation. Cook and stage still run, producing a "successful" package that lacks all plugin DLLs.

## Symptom Chain

1. `BuildAndPackage.bat` runs and reports SUCCESS
2. `PackagedBuild/Windows/FPS_Game.exe` exists and looks normal
3. Running the exe fails with: `Plugin 'LudeoUESDK' failed to load because module 'LudeoUESDK' could not be found`
4. Checking `Plugins/<PluginName>/Intermediate/Build/Win64/x64/` shows only an `UnrealEditor/` subdirectory — no game target build artifacts

## Root Cause

RunUAT's `-build` step requires a valid target name. When passed a non-existent target (e.g., `-target=LyraGame` in a project that has no such target), it does not fail loudly — it simply produces no build output. The subsequent cook/stage/package steps proceed with whatever binaries happen to exist on disk.

## Prevention

1. **Always update `-target=` when copying BuildAndPackage.bat to a new project.** The target name must match the project's game module name.
2. **Verify the target was actually built** by checking `Plugins/<PluginName>/Intermediate/Build/Win64/x64/` for a game-target subdirectory (e.g., `FPS_Game/Development/`), not just `UnrealEditor/`.
3. **Grep the build log for the target name** — a successful build should show `Building <TargetName>...` near the start of the cook phase.

## Related Issue

For BP-only projects, even a correct `-target=<GameName>` flag will fail unless a minimal `Source/<GameName>/` module exists with `IMPLEMENT_PRIMARY_GAME_MODULE`. See `engine-quirks/bp-only-packaging-needs-source-module.md`.
