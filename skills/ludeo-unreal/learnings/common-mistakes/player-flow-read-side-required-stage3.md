---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 4
question: null
sanitized: true
---

# Player Flow read side is REQUIRED in Stage 3 — do not stub it

The Phase 03 reference file explicitly states Player Flow restoration is **required**: "Implement state tracking (write side) AND Player Flow restoration (read side)." Section 5.4 is titled "Player Flow Restoration (Read Side — REQUIRED)."

Despite this, the AI may rationalize stubbing the read side with "requires more SDK API investigation" or "will implement later." This leaves Stage 3 incomplete — the skill's goal of a "working end-to-end integration" is not met without both read and write sides.

**The read side mirrors the write side exactly:**
1. `OnGetLudeo` callback → `FLudeo::GetLudeoByLudeoHandle()` → `GetLudeoObjectInformationCollection()`
2. For each `FLudeoReadableObject`: `EnterObject()` → `ReadData("Position", pos)` (same attribute names as WriteData) → `LeaveObject()`
3. Store in `PendingPlayerState` / `PendingBotStates` → `ReleaseLudeo()` → `ServerTravel`
4. Component checks `PendingLudeoID` in `TryBeginGameplay` → calls `ApplyPlayerState()` + `ApplyBotStates()`

**How to apply:** When implementing Stage 3, complete both write AND read sides before marking the stage done. If the AI produces stubs for ApplyPlayerState/ApplyBotStates, flag this as incomplete.
