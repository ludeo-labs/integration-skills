# Classify Save System (Unity) — Group + Per-Entity Matrix

Classify the game's save/load system into one of three groups and record a per-entity restoration
approach (**reconciliation** vs **manual**). Phases 4–5 (object tracking/restoration) consume these
artifacts.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls or CODE_MAP references in this conversation, **STOP** and ask the user
  to start a fresh session and continue with phase 3f there.
- If fresh, proceed.

> **This is the Unity guide** (the C++ skill defers Unity here). Everything below is Unity/C#.

## 📚 Context Files

Read first (relative to this workflow file):
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the **named typed attribute** model (`SetAttribute`/
  `TryGetAttribute`), which is *why* an opaque blob save can't be reused as reconciliation.

## Prerequisites

> **REQUIRED:** `phase 2` → `CODE_MAP.json` (`object_model`, `core_classes`). This phase **creates**
> the `save_system` block from scratch (phase 2 no longer pre-classifies it) — the per-entity matrix
> is built from `object_model`. Recommended: `phase 3` and `phase 3b` done. If `TDD_<GameName>.md`
> exists, its reconstruction section is provisional until this classification — reconcile conflicts here.

## Why this matters

Restoration reconstructs each object by reading **named, typed attributes** (`TryGetAttribute("hp",
out int)`). A save system is only *reusable* for restoration if it already serializes entity state to
**named fields** that map onto those attributes. **A great save system that writes an opaque/packed
binary blob (e.g. `BinaryFormatter`, a custom byte buffer, a replay/rewind buffer) is NOT reusable as
reconciliation** — that entity must be tracked **manually** with explicit `SetAttribute` calls.
Misclassifying wastes the entire restoration effort downstream.

## Your Task

### Step 1: Detect the save mechanism (Unity greps)
Run and capture matches + counts:
- `Grep("PlayerPrefs\\.")` — key/value prefs (often settings/highscores, sometimes progress).
- `Grep("JsonUtility|JsonConvert|\\[Serializable\\]|\\[SerializeField\\]")` — JSON / named-field serialization.
- `Grep("ScriptableObject")` — data assets (config; sometimes runtime state).
- `Grep("BinaryFormatter|BinaryWriter|MemoryStream|byte\\[\\]")` — binary/opaque serialization.
- `Grep("Save|Load|Serialize|Deserialize|Checkpoint|Persist")` (exclude tests) — save entry points.
- `Grep("Addressables|AssetBundle")` — content loading (not state, but relevant to reconstruction).

### Step 2: Questionnaire (answer with file:line evidence; mark unknowns `?`)
- Does the game persist **gameplay** state (entity positions/HP/inventory), or only settings/scores?
- Is saved state written as **named fields** (JSON / `[SerializeField]` / keyed prefs) or as an
  **opaque blob** (binary/packed)?
- Is it a **full** snapshot, **checkpoint/partial**, or **none**?
- Where are the save/load entry points, and what entity types do they cover?

### Step 3: Assign the group
- **Group 1 — full gameplay-state save:** persists most runtime entity state.
- **Group 2 — checkpoint/partial:** saves some progress (level, score, unlocks) but not full live state.
- **Group 3 — no gameplay-state save:** only settings/highscores, or nothing.

### Step 4: Per-entity reconciliation-vs-manual matrix
For each entity type in `CODE_MAP.object_model`, decide:
- **reconciliation** — the existing save serializes this entity to **named, typed fields** that map
  cleanly onto Ludeo attributes; restoration can reuse that mapping.
- **manual** — no usable save, or the save is opaque/packed/binary → restoration uses explicit
  `SetAttribute`/`TryGetAttribute` per field.

> ⚠️ **Do not default Group-1 games to reconciliation.** Group is about *coverage*; reconciliation is
> about *format*. A Group-1 game that saves via `BinaryFormatter` is still **manual** per entity.

### Step 5: Halt for human review
Summarize group + rationale + the per-entity matrix and ask the user to confirm before downstream
phases consume it.

## Output

| File | Purpose |
| --- | --- |
| `ludeo-integration-plan/GAME_ANALYSIS_SAVE_SYSTEM.md` | Narrative classification + per-entity matrix |
| `ludeo-integration-plan/CODE_MAP.json → save_system` | Structured block consumed by phases 4/5 |

Add the `save_system` block to `CODE_MAP.json`:
```json
"save_system": {
  "mechanism": "PlayerPrefs | JsonUtility | Json.NET | ScriptableObject | BinaryFormatter | custom | none",
  "format": "named-fields | opaque-blob | mixed | none",
  "group": 1,
  "save_entry_points": [{ "file": "...", "class_method": "...", "line": "..." }],
  "per_entity": [
    { "entity": "PlayerTank", "approach": "manual", "reason": "no save of live HP/position" },
    { "entity": "Inventory", "approach": "reconciliation", "reason": "JsonUtility named fields map to attributes" }
  ]
}
```

## Important Notes

- **Classification is a prerequisite, not a formality** — a Group-3 game mistaken for Group-1 wastes
  the restoration phase.
- **A strong save ≠ reconciliation** — check the *format* (named vs opaque).
- **Per-entity overrides are normal** — a Group-1 game can still be manual for specific entities.
- **Named fields in nested structs ≠ free reconciliation.** A typed serializer (`JsonUtility`,
  Newtonsoft/Json.NET, Odin, FullSerializer) that emits per-entity structs (`PlayerData`,
  `EnemyData`) has named fields *inside* each struct — but a `LudeoStateObject`'s attribute namespace
  is **flat per object** (`SetAttribute("hp", …)`). Reconciliation still means enumerating each
  struct's fields into individual `SetAttribute`/`TryGetAttribute` calls. The work is mechanical, but
  the approach is still **manual** per property. Don't conflate "named fields exist" with
  "reconciliation works out of the box" — the schema *shape* matters, not just whether values are named.
- **Transition / streaming caches are not save backbones.** Open-world Unity games often have an
  interior↔exterior cache, a streaming cell/chunk cache, or an Addressables/scene-streaming hand-off
  named `CacheScene` / `Persist*` / similar. These hold **partial deltas** — only what's needed to
  round-trip across a transition, not the full live world. They are **not** the canonical save;
  reusing one as the Ludeo backbone silently drops everything outside the cached delta (other cells,
  distant AI, quest world-state). Find the **real** save path (the one behind the menu's Save/Load),
  not the transition cache. (For these games, also see `ludeo-integration-docs/game-patterns/open-world.md`.)

## Related / Next

- `phase 2` (FIRST), `phase 3`, `phase 3b`.
- `phase 4` consumes `save_system.group` + the matrix; `phase 5 · task 1` uses per-entity to choose
  reconciliation vs manual wiring.
- **Next:** `phase 3` (plan lifecycle) — classification waits until phase 4 needs it.
