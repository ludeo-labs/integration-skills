---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: 3
question: "Does the toolkit's GameState Blueprint carry a phase/turn-state enum variable (e.g. TurnState) that the toolkit sets at battle start AND at battle end? If yes, that single variable is both the N-way gate's game-phase condition and the room-close signal — poll it via reflection, resolve UserDefinedEnum values by AUTHORED name at runtime, and make zero BP edits."
sanitized: true
---

# A toolkit GameState phase enum can be the whole lifecycle signal — via reflection, zero BP edits

## Precondition

The game's battle layer is a Blueprint toolkit whose GameState BP carries a phase enum
variable (here: `TurnState : ETurnState {Setup, TurnBased, GameOver, Other}`), and the BP graph
report confirms the toolkit sets it at battle activation AND on every battle-end path
(victory, defeat, surrender all funnel through a `SetTurnState`-style call).

## Why this beats delegates/BP edits for Stage 2

- **One variable covers both lifecycle edges**: gate `BeginGameplay` on the "battle active"
  value; trigger the teardown chain (`EndGameplay → RemovePlayer → CloseRoom`) on the
  "game over" value. All end paths that go through the same setter are covered for free.
- **Reflection-only**: `GetClass()->FindPropertyByName(TEXT("TurnState"))` from the component's
  owner (the GameState the component is attached to). No toolkit BP edits to merge-conflict,
  no game C++ edits.
- A 10Hz poll from the component tick is plenty for turn-based pacing and costs nothing.

## Implementation notes that matter

1. **BP byte enums are `FByteProperty` with `->Enum` set**; strongly-typed enums are
   `FEnumProperty`. Handle both casts.
2. **UserDefinedEnum entries are `NewEnumeratorN` internally.** The values you see in the editor
   ("TurnBased", "GameOver") are authored display names. Resolve at runtime with
   `Enum->GetAuthoredNameStringByValue(Value)` (fallback `GetDisplayNameTextByValue`), and
   compare by NAME, never by raw byte value — UserDefinedEnum byte values are non-contiguous
   (e.g. 0/5/7/9) and reorder when the asset is edited.
3. Find the variable and its setter callers via the BP inspector: `inspect` (variables + types)
   plus `graph` (who calls `SetTurnState`) — the combination proves the enum is set on all the
   paths you care about before you commit to it.
4. Latch the game-over handling (one-shot bool) — debrief screens may keep the state at the
   terminal value for many ticks.
