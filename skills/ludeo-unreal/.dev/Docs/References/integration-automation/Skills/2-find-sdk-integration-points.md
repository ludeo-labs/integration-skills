# Find SDK Integration Points

Read an existing CODE_MAP and identify specific locations for Ludeo SDK lifecycle integration.

## 🚦 Fresh Context Check

**This command works best with a clean context.** If this conversation has prior tool calls, game analysis, or CODE_MAP references, ask the user:
> "This conversation has prior context that may interfere. Would you like me to proceed anyway, or would you prefer to run `/clear` first and re-run this command?"

## 📚 Context Files

Clone or reference context from: **https://github.com/EdgeGamingGG/integration-automation/tree/Adam/cursor-commands**
Or look for SDK integration context locally.

Read these files for SDK lifecycle details:
- ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md - Critical rules (threading, callbacks, tick requirements)
- ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md - SDK lifecycle phases, callback flow, timing

## Prerequisites

Run `/1-map-game-code` first to generate `ludeo-integration-plan/CODE_MAP.json`.

## Your Task

1. **Read context files first:**
   - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`
   - `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md`

2. **Read the CODE_MAP file** from `ludeo-integration-plan/CODE_MAP.json`

3. **Analyze the CODE_MAP** - Use the `lifecycle_hooks` section

4. **Map each game hook to Ludeo SDK functions** - Output integration points

## SDK Functions to Map

For each SDK function, find the best location from the CODE_MAP:

| SDK Function | When to Call | Look for in CODE_MAP |
|--------------|--------------|----------------------|
| `ludeo_Initialize()` | Game startup, early | `lifecycle_hooks.initialization` - earliest point |
| `ludeo_Session_Create()` | After Initialize | Same location as Initialize |
| `ludeo_Session_Activate()` | After window/GL ready | `lifecycle_hooks.initialization` - after graphics init |
| `ludeo_Session_Tick()` | Every frame | `lifecycle_hooks.main_loop` |
| `ludeo_Session_OpenRoom()` | Level/match loading starts (ALL paths) | `lifecycle_hooks.session_start` |
| `ludeo_GameplaySession_End()` | Gameplay ends (ALL exit paths) | `lifecycle_hooks.session_end` - may need multiple locations |
| `ludeo_Session_Release()` | Game shutdown | `lifecycle_hooks.shutdown` |
| `ludeo_Shutdown()` | Game exit | `lifecycle_hooks.shutdown` - last point |

## Output Format

Output `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` with this structure:

```json
{
  "game_name": "<from CODE_MAP>",
  "code_map_source": "ludeo-integration-plan/CODE_MAP.json",
  "threading_model": "<from CODE_MAP>",
  "integration_points": [
    {
      "sdk_function": "<function name>",
      "file": "<file path from CODE_MAP>",
      "function": "<function name from CODE_MAP>",
      "line": "<line number from CODE_MAP>",
      "context": "<brief description of when/why>",
      "timing": "<Once at startup | Every frame | Each level start | etc>",
      "thread": "main"
    }
  ],
  "callback_handlers": {
    "note": "These are SDK callbacks, NOT game integration points",
    "OnRoomOpenedCallback": "Calls ludeo_Room_AddPlayer()",
    "OnPlayerAddedCallback": "Tracks player added state",
    "OnRoomReadyCallback": "Calls ludeo_GameplaySession_Begin() when ready"
  },
  "warnings": ["<any threading or timing concerns>"]
}
```

**Required integration points:** Initialize, Session_Create, Session_Activate, Session_Tick, Session_OpenRoom, GameplaySession_End (ALL exit paths), Session_Release, Shutdown.

## Process

1. Read `ludeo-integration-plan/CODE_MAP.json`
2. For each SDK function, select the best location from `lifecycle_hooks`
3. Verify threading requirements (all calls must be main thread)
4. Output `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`

## Important Notes

- Do NOT analyze the game codebase directly - use only the CODE_MAP
- Do NOT suggest code implementations - only locations
- `ludeo_GameplaySession_End()` often needs MULTIPLE locations (win, lose, quit, disconnect)
- All SDK calls must be on main thread
- If CODE_MAP is missing required sections, report what's missing
