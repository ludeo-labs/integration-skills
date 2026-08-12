---
category: architecture
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

Player Flow requires actual game pause support implemented in the LudeoGameStateComponent. The component must implement `SetPaused(true/false)` to freeze the world and stop ticking while restoring state during Player Flow. This is not optional — do not mark Pause/Resume as "N/A" even for multiplayer-style games.

Two separate things depend on that primitive, and neither substitutes for the other (phase 03 §5.9.1): the SDK's `OnPauseGameRequested` **request** calls it to freeze under the overlay, and **every** pause — that one included — must also emit the `PauseLudeo`/`ResumeLudeo` **trigger**, or the Ludeo objective timer keeps counting down while the game sits frozen. See [[report-every-pause-detect-state-not-per-callback]].
