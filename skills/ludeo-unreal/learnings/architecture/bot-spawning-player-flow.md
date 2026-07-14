---
category: architecture
tier: generalizable
sourceGame: ActionRoguelike
phase: 2
question: "Does this game have dynamically spawned bots with unstable identity? If so, the Ludeo component should spawn bots directly during Player Flow rather than relying on the game's native spawner."
sanitized: true
---

When bot identities are not stable across sessions (dynamically spawned, random placement), the Ludeo component should spawn bots directly during Player Flow from tracked state data. The game's native spawner (e.g., timer-based, credit-based) should be disabled during Player Flow.

This gives the component full control over bot identity, position, health, and timing during reconstruction. Letting the native spawner run and then overriding state is fragile and harder to sync.
