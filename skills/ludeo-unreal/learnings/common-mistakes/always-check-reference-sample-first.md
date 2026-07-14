---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 3
question: "Is there a reference sample available at the Ludeo repo (e.g., ludeosdk-lyra-sample)?"
sanitized: true
---

# Always check the reference sample before implementing non-gameplay handling

The Ludeo Lyra reference sample at `ludeosdk-lyra-sample` contains a production-quality implementation of all Stage 5 features (pause/resume, NoneLudeable, Player Flow pause timing, menu overlay detection). Always read the reference BEFORE implementing — it prevents multiple iterations of broken approaches.

Key patterns only visible in the reference (not obvious from the skill docs):
- Menu overlay detection via `UPrimaryGameLayout`/`UI.Layer.Menu` to CAUSE the pause (not just detect it)
- Player Flow pause timing: pause after phase starts (with 0.5s delay), not in BeginPlay
- `SetGamePaused` not `PC->SetPause` for SDK callbacks
- StopNoneLudeable sent before EndGameplay when paused
