# Implement Phase 0 Plan - Create Files and Modify Hooks

Execute the Phase 0 implementation plan: create all Ludeo files and modify game hook points. Does NOT compile - that's `/5-compile-and-fix`.

## 🚦 Fresh Context Check

**This command works best with a clean context.** If this conversation has prior tool calls, game analysis, or CODE_MAP references, ask the user:
> "This conversation has prior context that may interfere. Would you like me to proceed anyway, or would you prefer to run `/clear` first and re-run this command?"

## 📚 Context Files

Clone or reference context from: **https://github.com/EdgeGamingGG/integration-automation/tree/Adam/cursor-commands**

- @ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md - Critical rules (async callbacks, tick)
- @ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md - SDK lifecycle and callback flow

## Prerequisites

- `/0-build-game-with-sdk` completed (build system configured)
- `/3-implement-sdk-lifecycle` completed (plan exists at `ludeo-integration-plan/PHASE0_PLAN_<GameName>.md`)

## Your Task

### 1. Load Implementation Plan

Find `ludeo-integration-plan/PHASE0_PLAN_<GameName>.md` and extract:
- New files to create (paths + full content)
- Existing files to modify (locations + code snippets)
- Implementation order

If not found, check game root for `PHASE0_PLAN*.md` or ask user.

### 1.5 Gather API Key

**Before creating files, prompt the user:**

> "What Ludeo API key should I configure?
> _(If you don't have one yet, I'll use `YOUR_API_KEY_HERE` as a placeholder.)_"

- If provided: Store value to inject into or `LudeoConfig.h`
- If skipped: Use `"YOUR_API_KEY_HERE"` and add `// TODO: Replace with actual API key` comment

The API key will be used in `ActivateSession()`:
```cpp
params.apiKey = "provided-key-here";
```

### 2. Create New Files (in order from plan)

**Backup any existing files first!**

> **Note:** `LudeoConfig.h` may already exist as a stub from `/0-build-game-with-sdk`.
> **Overwrite it** with the full version from the plan.

| File | Purpose |
|------|---------|
| `LudeoConfig.h` | **OVERWRITE** stub with full version - conditional compilation, fallback types, logging macros |
| `LudeoManager.h` | Singleton class declaration, lifecycle methods, callback handlers |
| `LudeoManager.cpp` | Full implementation: singleton, Initialize, ActivateSession, Tick, Shutdown, OpenRoom, EndGameplaySession, all callbacks |

Use the paths specified in the plan (typically `src/core/ludeo/` or similar). Copy code **exactly** from plan.

### 3. Modify Existing Files (from plan)

**Create `.bak` backups before modifying!**

Follow the plan's hook points. Example modifications (actual files vary by game):

| Hook Type | Example Location | Ludeo Call |
|-----------|------------------|------------|
| Init | Game startup | `LudeoManager::Get().Initialize()` |
| Tick | Main loop | `LudeoManager::Get().Tick()` |
| Session start | Level load | `LudeoManager::Get().OpenRoom(levelId)` |
| Session end | Level end/disconnect | `LudeoManager::Get().EndGameplaySession(isAbort)` |
| Shutdown | Game exit | `LudeoManager::Get().Shutdown()` |

**CRITICAL:** Wrap ALL Ludeo code in `#if LUDEO_SDK_ENABLED ... #endif`

### 4. Verification (Pre-Compile)

- [ ] `LudeoConfig.h` stub overwritten with full version
- [ ] `LudeoManager.h` and `LudeoManager.cpp` created
- [ ] All hook points modified per plan
- [ ] All modifications have `#if LUDEO_SDK_ENABLED` guards
- [ ] `.bak` backups exist for all modified files

## Output

Report on completion:
1. List of files created (with paths)
2. List of files modified (with backup paths)
3. Ready for `/5-compile-and-fix`

## Rollback (if needed)

```bash
# Restore backups
mv file.bak file

# Remove new ludeo directory (path from plan)
rm -rf src/core/ludeo/   # or wherever the plan specified
```

## Next Step

Run `/5-compile-and-fix` to build and fix any compilation errors.
