---
category: architecture
tier: universal
sourceGame: Lyra
phase: 5
question: null
sanitized: true
---

# Player Flow: apply state while running, THEN pause before opening room

During Player Flow, the game must be RUNNING (not paused) when restored state is applied. Systems like GAS (deferred health/ability init), physics (velocity application), and spawn callbacks need the game ticking to process state correctly. If you pause first, these systems freeze and state doesn't settle.

**Correct sequence:**

```
Map loads → Component BeginPlay
  → Detect Player Flow (PendingLudeoID not empty)
  → Game is RUNNING (do NOT pause yet)
  → Apply restored state (position, health, weapons, bots)
  → Wait a frame if needed (let GAS init, physics settle, spawns complete)
  → PAUSE the game
  → Open Room with LudeoID
  → AddPlayer
  → Wait for RoomReady (N-way gate)
  → BeginGameplay
  → RESUME the game
```

**Why this order matters:**
- GAS: `SetNumericAttributeBase()` or gameplay effects need the ability system ticking to apply. Paused game = frozen ability system = health never set.
- Physics: velocity restoration requires at least one physics tick to take effect.
- Spawning: bot spawn callbacks (`OnPawnInitialized`, etc.) fire during the next tick after `SpawnActor`. Paused game = callbacks never fire = bots never fully initialize.
- OnRep: In standalone/listen-server, `OnRep_*` functions only fire when the engine processes replication, which requires ticking.

**The pause protects the window between "state is settled" and "BeginGameplay fires."** During this window, the room is being opened and configured. Without the pause, AI could attack the player or timers could start before the room is ready.
