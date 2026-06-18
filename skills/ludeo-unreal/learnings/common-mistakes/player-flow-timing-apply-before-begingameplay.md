---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 4
question: null
sanitized: true
---

During Player Flow, apply captured state (teleport, set health, spawn entities) BEFORE calling the SDK's BeginGameplay(). The game should be unpaused during state application so physics and AI can settle on the next frame.

**Order:**
1. ApplyPlayerState() — teleport player, set health/energy/weapon
2. ApplyBotStates() — match/spawn AI enemies, set positions/health
3. BeginGameplay() — SDK call AFTER state is in place

**NOT:**
1. BeginGameplay()
2. ApplyPlayerState()  ← Too late, SDK is already recording from the wrong state

The game's own systems (AI behavior trees, physics, animation) need at least one frame to process the new positions before the SDK starts capturing.
