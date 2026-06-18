# Map Game Code - Codebase Structure Analysis

Analyze the game codebase and build a comprehensive structural map for SDK integration planning.

## 🚦 Fresh Context Check

**This command works best with a clean context.** If this conversation has prior tool calls, game analysis, or CODE_MAP references, ask the user:
> "This conversation has prior context that may interfere. Would you like me to proceed anyway, or would you prefer to run `/clear` first and re-run this command?"

## 📚 Context Files

Clone or reference context from: **https://github.com/EdgeGamingGG/integration-automation/tree/Adam/cursor-commands**

- @ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md - SDK constraints (threading, tick requirements) that inform what patterns to find
- @ludeo-integration-docs/02-RESEARCH-TEMPLATE.md - Research guidance and what to document
- @ludeo-integration-docs/research-context/02A-RESEARCH-ARCHITECTURE.md - Architecture patterns to find

These files help identify the specific lifecycle patterns needed for SDK integration.

## Your Task

Build a **structural map** of the game codebase for SDK integration planning.

**What to find:**
1. Entry points (main functions)
2. Core engine/game classes
3. Lifecycle hook points (initialization, main loop, session start/end, shutdown)
4. Threading model
5. Build system and dependencies

Follow the research guidance in `02-RESEARCH-TEMPLATE.md` and `02A-RESEARCH-ARCHITECTURE.md` for detailed instructions on what to document.

## Output

1. **Create folder:** `ludeo-integration-plan/` in the game's root directory
2. **Save:** `ludeo-integration-plan/CODE_MAP.json` containing:
   - `codebase_summary` - Language, engine, key directories
   - `entry_points` - Main functions with file, line, and call chain
   - `core_classes` - Key classes with files, methods, inheritance
   - `lifecycle_hooks` - Integration points for initialization, main_loop, session_start, session_end, shutdown
   - `threading` - Threading model and thread safety notes
   - `build_system` - Build files and dependencies

**Include file paths, function names, and line numbers for all findings.**

## Next Step

After creating `ludeo-integration-plan/CODE_MAP.json`, run `/2-find-sdk-integration-points` to map the structure to Ludeo SDK functions.
