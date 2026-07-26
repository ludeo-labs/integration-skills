---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 3
question: null
sanitized: true
---
# Don't send SDK actions from SDK callbacks — detect game state changes instead

## What happened
The agent put `SendPauseAction()` (which calls `RoomWriter.SendAction("PauseLudeo")`) inside `OnPauseGameRequested` — the SDK's own callback asking the game to pause. This creates a circular dependency: the SDK asks the game to pause, the game tells the SDK it paused. The SDK already knows it requested a pause.

## The correct pattern
SDK callbacks (`OnPauseGameRequested`, `OnResumeGameRequested`) should ONLY affect game-side behavior (call `SetGamePaused`). The SDK actions (`PauseLudeo`/`ResumeLudeo`, `StartNoneLudeable`/`StopNoneLudeable`) should be sent when the **game's actual pause state changes**, detected by polling `GetWorld()->IsPaused()` in `TickComponent` with `bTickEvenWhenPaused = true`.

This decouples the two concerns:
- **SDK → Game:** "please pause" → game pauses
- **Game → SDK:** game detects it's paused (from any source — SDK request, ESC menu, etc.) → sends action

This also handles pauses triggered by the game itself (pause menu, focus loss) — those also need SDK actions but don't go through SDK callbacks.

## Phase 5 reference
Section 5.2: "Poll `GetWorld()->IsPaused()` in `TickComponent` with `bTickEvenWhenPaused = true`. Branch on Creator vs Player Flow for the correct action names."

Section 8.7: "During Player Flow, responding to SDK pause/resume callbacks (freezing the game) is necessary but not sufficient. You must ALSO send `PauseLudeo`/`ResumeLudeo` actions via `SendAction`. The callbacks handle game-side behavior; the actions handle SDK-side segment marking. Both are required."
