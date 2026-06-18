---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: 1
question: null
sanitized: true
---

# Ludeo Room ≠ Playable Highlight

## The Mistake

Confusing room lifecycle with highlight lifecycle. Proposing "one life = one room" or "one match = one room" by treating each highlight as requiring its own room open/close cycle.

## Correct Mental Model

- **Room** = a long-running recording session that stays open for the duration of gameplay (e.g., entire map session from load to exit)
- **Highlights** = captured moments extracted from the data WITHIN an open room
- You do NOT close a room to produce a highlight — highlights are generated from the room's recorded data while it is open
- Room open/close corresponds to the gameplay SESSION (map load → map exit), not to individual highlights

## Root Cause

The Phase 1 reference describes `sessionUnit` as "What constitutes one playable unit (the thing a Ludeo room wraps)" with examples like "match, level, wave, mission, round." The word "unit" and the small-scope examples suggest the room should wrap the smallest discrete gameplay chunk. But rooms are containers that record continuously — highlights are extracted from within.

## Prevention

When determining room boundaries, ask: "When does the player START recording gameplay?" and "When does the player STOP recording?" — this is the room lifecycle. Don't ask "What is one highlight?" — that's a different question entirely. A room typically stays open for an entire map session.

## Second surface of the same mistake: verification checklists (recurred 2026-06-10, TacticsGame)

The misconception also leaks into **runtime-testing instructions**: the agent told the
human to "play through to battle end so the room closes cleanly" as part of the
capture step — implying highlight creation depends on room close. The human corrected:
**the room does NOT need to close for a Ludeo highlight to be created.** Capture works
at any moment while the room is open; that is the entire point of the room model.

When writing Stage 3+ verification checklists, keep the two test items separate:
1. "Capture a highlight mid-battle" — no preconditions beyond an open room with
   gameplay begun.
2. "Play to battle end" — a SEPARATE test that exercises the natural room-close path
   (game-over signal → teardown chain). It validates lifecycle, not capture.

Never word (2) as a prerequisite of (1).
