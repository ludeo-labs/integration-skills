# Compile and Fix - Build Loop Until Success

Build the game with SDK integration and fix compilation errors iteratively until both SDK-disabled and SDK-enabled builds succeed.

## 🚦 Fresh Context Check

**This command works best with a clean context.** If this conversation has prior tool calls, game analysis, or CODE_MAP references, ask the user:
> "This conversation has prior context that may interfere. Would you like me to proceed anyway, or would you prefer to run `/clear` first and re-run this command?"

## 📦 Ludeo SDK Location

> **REQUIRED:** This command needs the Ludeo SDK distribution for compilation.
>
> The SDK location should already be configured by `/0-build-game-with-sdk`.
> If build fails with SDK path errors, verify SDK location and update build configuration.

## 📚 Context Files

Clone or reference context from: **https://github.com/EdgeGamingGG/integration-automation/tree/Adam/cursor-commands**

- @ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md - Critical requirements for SDK integration
- @ludeo-integration-docs/03-SDK-FUNDAMENTALS.md - SDK API patterns and signatures
- @ludeo-integration-docs/04-BUILD-INTEGRATION.md - Build system troubleshooting (Section 10.3)

## Prerequisites

- `/0-build-game-with-sdk` completed (build system configured)
- `/4-implement-phase0-plan` completed (Ludeo files created, hooks modified)

## Your Task

### Compile-Fix Loop

```
┌──────────────────────────────────────────────────┐
│ 1. Build LUDEO_SDK_ENABLED=0                     │
│    └─ Fails? → Read logs → Fix errors → Retry    │
│ 2. Build LUDEO_SDK_ENABLED=1                     │
│    └─ Fails? → Read logs → Fix errors → Retry    │
│ 3. Both pass? → SUCCESS ✅                      │
└──────────────────────────────────────────────────┘
```

### Step 1: Build WITHOUT SDK (Baseline)

```bash
# CMake example
cmake --build build -- LUDEO_SDK_ENABLED=0

# Or Makefile
make LUDEO_SDK_ENABLED=0
```

If this fails, the issue is in the Ludeo code structure (not SDK linking). Fix before proceeding.

### Step 2: Build WITH SDK

```bash
# CMake example
cmake --build build -- LUDEO_SDK_ENABLED=1

# Or Makefile
make LUDEO_SDK_ENABLED=1
```

If this fails, the issue is SDK-specific (headers, linking, signatures).

### Common Error Fixes

| Error Type | Likely Cause | Fix |
|------------|--------------|-----|
| `LudeoConfig.h` not found | Include path wrong | Check build system include dirs |
| `LudeoManager` undefined | Header not included | Add `#include "LudeoManager.h"` |
| Missing SDK headers | SDK include path | Verify `LUDEO_SDK_PATH` in build |
| Undefined logging function | Game-specific logger | Replace with actual game function |
| Window handle undefined | Game-specific variable | Find game's window variable |
| Callback signature mismatch | Wrong parameter types | Check SDK docs for exact types |
| Linker errors (undefined symbols) | Library not linked | Verify SDK library in build |
| Linker errors (multiple definitions) | Include guards missing | Add `#pragma once` or guards |

### Debugging Tips

1. **Read the FIRST error** - later errors often cascade from the first
2. **Check line numbers** - error shows exact location
3. **Compare with plan** - did you copy code exactly?
4. **Check `#if` guards** - all Ludeo code must be wrapped
5. **Search SDK headers** - find correct function signatures

### Max Iterations

**Stop after 10 failed attempts.** If still failing:
1. List all remaining errors
2. Identify patterns (same file? same type?)
3. Report to user for manual review

## Success Criteria

- [ ] Compiles with `LUDEO_SDK_ENABLED=0` (baseline works)
- [ ] Compiles with `LUDEO_SDK_ENABLED=1` (SDK integration works)
- [ ] No new warnings introduced
- [ ] Game launches without crashes (both modes)

## Output

Report on completion:
1. Build status (SDK disabled ✅/❌, SDK enabled ✅/❌)
2. Errors fixed (list each with fix applied)
3. Any remaining issues

## If Stuck

If the same error persists after multiple attempts:
1. Share the exact error message
2. Share the relevant code section
3. Ask user for guidance

## Next Steps

After successful build:
1. Run game with `LUDEO_SDK_ENABLED=0` - verify baseline behavior
2. Run game with `LUDEO_SDK_ENABLED=1` - verify SDK loads (check logs)
3. Proceed to tracking/restoration phases (future commands)
