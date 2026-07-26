---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# DOREPLIFETIME Scan — Don't Cherry-Pick Properties

## The Problem

The agent cherry-picks "obvious" properties (Transform, Health, Armor) from entity exploration instead of systematically scanning ALL replicated properties. Non-obvious properties like `bIsSpecialModeActive` (a mode switch) are replicated for a reason — they fundamentally change gameplay — but get missed because they don't look important at a glance.

## What Should Happen

For each tracked entity class:
1. Grep `GetLifetimeReplicatedProps` in the class .cpp
2. Extract ALL `DOREPLIFETIME` / `DOREPLIFETIME_CONDITION` entries
3. Present the FULL list to the human and let them trim

The scan is the discovery mechanism. The agent should NOT pre-filter the list based on what looks "relevant."

## Why It Happens

The agent has a bias toward recognizable properties (Health = obviously important, bIsSpecialModeActive = what's that?). It treats the replication scan as a heuristic rather than a systematic discovery step.

## Example

ActionGame's `APlayerStateBase` replicates `bIsSpecialModeActive`. This isn't cosmetic — toggling the special mode transitions the game between its two major gameplay phases. Missing it means Player Flow can't restore the game's fundamental state.
