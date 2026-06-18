# Map Game Actions - Find Ludeo Action Points

Analyze the game codebase to identify where Ludeo actions (`LUDEO_ACTION()`) should be placed, based on the game's genre and gameplay event patterns.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh chat:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. Please open a new Agent window (Ctrl+Shift+I / Cmd+Shift+I) and run `/6-map-game-actions` there for best results."
- If this is a fresh conversation, proceed.

## Prerequisites

> ⚠️ **REQUIRED:** Run `/1-map-game-code` first.
> This command reads `ludeo-integration-plan/CODE_MAP.json` for the game name and codebase structure.

## 📚 Context Files

**Action Required:** You must read the following files. Do not assume they are in context. Search for the `ludeo-integration-docs/` folder within the game's project directory.

- `ludeo-integration-docs/research-context/02C-RESEARCH-ACTIONS.md` - Actions research template (output format)
- `ludeo-integration-docs/game-patterns/INDEX.md` - Genre pattern index

**Genre pattern files** are loaded dynamically in Step 2 below.

## Your Task

### Step 1: Read CODE_MAP and Extract Game Name

Read `ludeo-integration-plan/CODE_MAP.json`. Extract:
- `game_name` from `codebase_summary`
- `core_classes` (useful for understanding code structure)
- Source file directories (where to search)

### Step 2: Determine Genre

**Primary method — web search:**
Search the web for `"<game_name>" game genre` (e.g., `"Red Eclipse" game genre`). Use the result to identify one or more genres.

**Fallback — if web search fails** (unreleased game, internal project, no results):
Ask the user: "I couldn't determine the genre for `<game_name>`. What genre is this game? (e.g., shooter, rts, platformer, racing)"

**Once genre is known:**
1. Read `ludeo-integration-docs/game-patterns/INDEX.md`
2. Load the matching genre pattern file(s) from `ludeo-integration-docs/game-patterns/`
3. For hybrid games, load multiple pattern files and merge their action catalogs and search keywords

If no genre pattern file exists for this game's genre, inform the user:
> "No genre pattern file exists for `<genre>`. I'll use a general search strategy. Consider creating `ludeo-integration-docs/game-patterns/<genre>.md` for future integrations."

Then proceed with a broad search using common gameplay keywords: kill, death, damage, score, pickup, collect, objective, complete, win, lose.

### Step 3: Search Codebase for Action Patterns

Using the **search keywords** from the genre pattern file(s), grep the game's source directories.

**Search strategy:**
1. For each keyword group in the genre file (e.g., "Combat / Damage / Kill"), grep for the listed keywords in function names and method names
2. Focus on:
   - Function definitions (not just references)
   - Event handlers (`On*`, `Handle*`, callbacks)
   - Functions that clearly represent a gameplay moment
3. Filter out:
   - Engine/framework internals
   - UI/rendering code
   - Utility/helper functions
   - Getters/setters for continuous state (these are tracking, not actions)

**Key distinction:** You're looking for **discrete events** (something happened), not **state changes** (something is now X). A `OnPlayerKilled()` is an action. A `SetHealth(50)` is tracking. When in doubt, keep it — the mapping step will filter.

### Step 4: Map Findings to Ludeo Actions

For each found gameplay event function:
1. Match it against the genre's **action catalog**
2. Assign a Ludeo action name (PascalCase, following naming conventions in 02C)
3. Assess objective and scoring potential
4. If an event doesn't match any cataloged action but looks gameplay-relevant, add it as a game-specific action

Also check for **gaps**: review the genre action catalog for expected actions that were NOT found in the code. Flag these as:
> "Expected `<ActionName>` for this genre but no matching code found. This may be named differently or handled in a non-obvious way. Manual review recommended."

### Step 5: Produce Output

Write `ludeo-integration-plan/GAME_ACTIONS_MAP.md`:

```markdown
# Game Actions Map — <GameName>

**Genre:** <genre(s)>
**Genre patterns used:** <pattern file(s)>
**Total actions found:** X
**Total gaps:** Y

## Actions by Category

### Combat

| Action Name | Description | Source Function | File:Line | Confidence | Objective Potential | Scoring Potential |
|-------------|-------------|----------------|-----------|------------|---------------------|-------------------|
| Kill | Player kills an enemy | CombatManager::OnEnemyKilled | src/combat/CombatManager.cpp:245 | high | Kill 10 enemies | 100 pts |
| Headshot | Kill via headshot | CombatManager::OnEnemyKilled (headshot branch) | src/combat/CombatManager.cpp:252 | high | Get 5 headshots | +50 bonus |

### [Other Categories...]

## Gaps

| Expected Action | Reason |
|-----------------|--------|
| MultiKill | No multi-kill detection found in code. Manual review recommended. |
```

**Confidence levels:**
- `high` — clear match between code and genre action (e.g., `OnPlayerKilled` → `Kill`)
- `medium` — likely match but naming is indirect (e.g., `ProcessHit` with death check → `Kill`)
- `low` — possible match, needs manual review (e.g., generic event that might be an action)

## Output

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/GAME_ACTIONS_MAP.md` | Action map for user review and implementation commands |

## Important Notes

- **Actions are discrete events**, not continuous state. `OnKill` = action. `SetHealth` = tracking (not this command's scope).
- **PascalCase naming** for all Ludeo action names (e.g., `Kill`, `CollectCoin`, `ObjectiveComplete`)
- **Multiple genre files** can be loaded for hybrid games — merge and deduplicate
- **Game-specific actions** are expected — not everything will match the genre catalog
- **Gaps are valuable** — they tell the user what's missing, not that something is wrong
- The output of this command feeds into future implementation commands

## Related Commands

- `/1-map-game-code` - Creates CODE_MAP (run FIRST)
- `/2-find-sdk-integration-points` - Lifecycle integration points (phase 0)

## Next Steps

After running this command:
1. Review `GAME_ACTIONS_MAP.md` with the user
2. Confirm/adjust action names and priorities
3. Run `/7-implement-game-actions` to implement `LUDEO_ACTION()` calls at each identified location
