---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 2
question: "Does the game need to be packaged (not just editor-playable)? If yes, does it have a Source/ directory and a non-Editor .Target.cs? If no to either, plan for a minimal game module or a target-generating plugin (e.g., CommonUI) BEFORE implementation, not after packaging fails."
sanitized: true
---

# Stage 2 Completion Requires Packaging Smoke Test, Not Just Editor Compile

## The Mistake

Marking Stage 2 "completed" after UBT editor compile succeeds. Editor builds silently miss failure modes that only surface during `BuildCookRun`:

- BP-only projects with no `Source/` directory have no game target — editor runs fine, packaging fails with `missing target <GameName>`.
- Module dependency gaps that editor DLLs tolerate fail at static link during the packaging build path.
- Plugin-side compile errors triggered by different preprocessor defines in non-editor configs.

In FPSGameStarterKit, the agent compiled cleanly via UBT, marked Stage 2 complete, then packaging failed later because the project had no `Source/` directory. The failure was silent in editor builds and only surfaced when the human ran `BuildAndPackage.bat`.

## Correct Behavior

Phase 2 Section 7.9 now requires a **two-tier smoke test** before Stage 2 can be marked complete:

**Tier 1 — Fast Build Gate (ALWAYS REQUIRED, ~5–10 min):**
```
RunUAT BuildCookRun -project=... -platform=Win64 -clientconfig=Development \
    -build -SkipCook -SkipStage -target=<GameTargetName>
```
Catches module-not-found, missing target, BP-only Source/ absence, .Build.cs gaps. No cook, no stage, no package — cheap.

**Tier 2 — Full Package + Boot (conditional):**
Only required when `integration.json → packagingTarget == "cloud-build"`. Recommended when `packagingTarget == "packaged"`. Skipped when `editor-only`.

The execution owner (agent vs human) is stored in `integration.json → preferences.smokeTestExecution` with a timestamp. Ask once, remember, re-ask after 7 days or on structural changes.

## Prevention

- Stage 0 asks about `packagingTarget` upfront so BP-only projects can plan the module/plugin strategy before implementation.
- Phase 2 pre-flight checks for `Source/` existence and a non-Editor `.Target.cs` before writing any code.
- Phase 2 Section 7.8 compile-fix loop now cross-references Section 7.9: *"Editor compile success ≠ game-target build success."*
