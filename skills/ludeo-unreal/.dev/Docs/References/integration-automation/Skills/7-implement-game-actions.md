# Implement Game Actions - Insert LUDEO_ACTION Calls

Read the action map produced by `/6-map-game-actions` and implement `SendAction` calls at each identified location in the game code.

## Fresh Context Check

**Before proceeding, verify this is a fresh chat:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. Please open a new Agent window (Ctrl+Shift+I / Cmd+Shift+I) and run `/7-implement-game-actions` there for best results."
- If this is a fresh conversation, proceed.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 0 complete — LudeoManager exists and SDK lifecycle works
> 2. `/6-map-game-actions` complete — `ludeo-integration-plan/GAME_ACTIONS_MAP.md` exists
> 3. User has reviewed and approved the action map

## Context Files

**Action Required:** Read the following files. Do not assume they are in context. Search for the `ludeo-integration-docs/` folder within the game's project directory.

- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` Section 6 — Action implementation patterns and `SendAction` method
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — Mandatory rules (macro guards, error handling)

## Your Task

### Step 1: Read the Action Map

Read `ludeo-integration-plan/GAME_ACTIONS_MAP.md`. Extract all actions with their:
- Ludeo action name
- Source function
- File path and line number
- Confidence level

Skip actions marked `low` confidence — flag them for the user to review manually.

### Step 2: Ensure SendAction Exists on LudeoManager

Find the LudeoManager class in the game codebase (check `ludeo-integration-plan/CODE_MAP.json` or search for `LudeoManager`).

**Check if `SendAction` method already exists.** If not, propose adding it:

**Header addition** (in LudeoManager class declaration):
```cpp
#if LUDEO_SDK_ENABLED
    void SendAction(const char* actionName);
#endif
```

**Implementation:**
```cpp
#if LUDEO_SDK_ENABLED
void LudeoManager::SendAction(const char* actionName)
{
    if (!m_gameplay_session_active || m_data_writer == nullptr)
        return;

    ludeo_DataWriter_SetCurrent(m_data_writer);
    ludeo_DataWriter_SendAction(actionName);
}
#endif
```

This is a one-time prerequisite. Propose it first, get user confirmation, then proceed to action insertions.

### Step 3: Insert Action Calls

For each action in the map (high and medium confidence):

1. **Read the source file** at the specified location
2. **Understand the function context** — read the surrounding code to determine the exact insertion point
3. **Propose the change** using this pattern:

```
Action: <ActionName>
File: <file_path>
Function: <function_name>
Insert after line: <line_number>

Code to add:
```

```cpp
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("<ActionName>");
#endif
```

**Insertion rules:**
- Place the action call AFTER the game logic that triggers the event, not before
- If the event has conditional branches (e.g., headshot check inside a kill handler), place the action inside the relevant branch
- Include the necessary `#include` for LudeoManager.h if not already present in the file
- Each action call must be wrapped in `#if LUDEO_SDK_ENABLED`

### Step 4: Handle Edge Cases

**Multiple actions in the same function:**
Insert all relevant actions. Example — a kill handler might need both `Kill` and `Headshot`:

```cpp
void OnEnemyKilled(Entity* killer, Entity* victim, bool headshot)
{
    // ... existing game logic ...

#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("Kill");
    if (headshot) {
        LudeoManager::Get().SendAction("Headshot");
    }
#endif
}
```

**Action inside a switch/case:**
Place the action call inside the relevant case:

```cpp
case ItemType::Coin:
    // ... existing logic ...
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("CollectCoin");
#endif
    break;
```

**File already has `#if LUDEO_SDK_ENABLED` blocks:**
If there's an adjacent block, consider merging rather than adding a separate guard.

### Step 5: Summary

After all actions are inserted, output a summary:

```
## Actions Implementation Summary

**SendAction method:** Added / Already existed
**Actions implemented:** X / Y total
**Actions skipped (low confidence):** Z — manual review needed

### Implemented Actions
| Action | File | Function | Status |
|--------|------|----------|--------|
| Kill | src/combat/Combat.cpp | OnEnemyKilled | Inserted |
| Headshot | src/combat/Combat.cpp | OnEnemyKilled | Inserted |
| ... | ... | ... | ... |

### Skipped (Low Confidence)
| Action | File | Reason |
|--------|------|--------|
| ... | ... | ... |
```

## Important Notes

- Follow the **propose-confirm-execute** cycle — show each change before making it
- Every SDK call must be wrapped in `#if LUDEO_SDK_ENABLED`
- Action calls go AFTER game logic, not before
- Do NOT modify game logic — only add SDK calls
- If a file needs `#include "LudeoManager.h"` (or equivalent), add it inside `#if LUDEO_SDK_ENABLED` guards
- This command uses direct `LudeoManager::Get().SendAction()` calls, not macros. A future phase will replace these with a `LUDEO_ACTION` macro.

## Related Commands

- `/6-map-game-actions` - Creates the action map (run FIRST)
- `/5-compile-and-fix` - Run after implementation to verify compilation

## Next Steps

After running this command:
1. Run `/5-compile-and-fix` to verify the game compiles with SDK enabled
2. Run the game and verify action logs appear during gameplay
3. Review any skipped low-confidence actions manually
