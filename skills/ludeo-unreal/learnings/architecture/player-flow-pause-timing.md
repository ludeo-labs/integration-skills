---
category: architecture
tier: universal
sourceGame: Lyra
phase: 3
question: null
sanitized: true
---

# Player Flow pause timing: pause BEFORE room open, unpause BEFORE state apply

The correct Player Flow pause sequence is:

1. Phase starts (`OnGamePhaseStarted`) → 0.5s delay (let loading screen dismiss) → `PauseAndOpenPlayerFlowRoom()`
2. `PauseAndOpenPlayerFlowRoom()`: `SetGamePaused(true)` THEN open room with LudeoID
3. Room opens → player added → room ready → N-way gate → `TryBeginGameplay()`
4. `TryBeginGameplay()`: `SetGamePaused(false)` BEFORE `ApplyPlayerState()` — movement component needs the game running to handle teleport

**Critical mistakes to avoid:**
- Do NOT pause in `BeginPlay` — this blocks experience loading and creates a deadlock
- Do NOT pause AFTER state restoration — game stays permanently paused with no unpause trigger
- Do NOT open the Player Flow room from `TryOpenRoom` in `BeginPlay` — defer to `PauseAndOpenPlayerFlowRoom` after the phase starts

The 0.5s delay between phase start and pause is important: it lets the loading screen fully dismiss before freezing the game.
