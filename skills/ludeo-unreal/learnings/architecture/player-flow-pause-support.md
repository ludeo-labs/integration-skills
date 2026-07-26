---
category: architecture
tier: universal
sourceGame: Lyra
phase: 2
question: null
sanitized: true
---

Player Flow requires actual game pause support implemented in the LudeoGameStateComponent. The component must implement `SetPaused(true/false)` to freeze the world and stop ticking while restoring state during Player Flow. This is not optional — do not mark Pause/Resume as "N/A" even for multiplayer-style games.
