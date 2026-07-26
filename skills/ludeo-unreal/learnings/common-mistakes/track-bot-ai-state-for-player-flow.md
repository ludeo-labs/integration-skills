---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: 4
question: "Does the game have AI-controlled entities? If so, what AI state properties are needed for meaningful behavior restoration (focus target, movement status, perception)?"
sanitized: true
---

# Bot state tracking must include AI behavior properties, not just transform

For games with AI entities, tracking only Position/Rotation/Health produces bots that stand still after Player Flow restoration. The AI controller needs context to resume meaningful behavior.

**Minimum bot AI properties to track:**
- Position + Rotation + ControlRotation (where the bot is and where it's looking)
- Health + MaxHealth (combat state)
- TeamID (friend/foe)
- **FocusTarget** — what actor/pawn the AI is focused on (for aim direction)
- **MoveStatus** — is the bot moving, patrolling, attacking, fleeing?
- **PerceivedEnemies** — which enemies the AI is aware of (affects behavior tree decisions)

**Why it matters:** Without AI state, Player Flow restores bot positions but the AI controller starts fresh — bots may not react to the player, may patrol wrong routes, or may not engage at all. The Ludeo highlight looks broken even though state was technically "restored."

**In Lyra specifically:**
- AI focus target: `AIController->GetFocusActor()`
- Movement status: From behavior tree or AI controller state
- Perceived enemies: From `UAIPerceptionComponent`

The reference integration tracks all of these in `FLudeoBotInitialState` and writes them per-tick.
