---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: 5
question: null
sanitized: true
---

# Do not create writable objects during Player Flow

Player Flow (playback/restore) should only READ state, never WRITE. `CreateWritableObjects()` must be guarded with `if (!bIsPlayerFlow)` in `TryBeginGameplay()`.

**Wrong pattern (ActionRoguelike bug):**
```cpp
void TryBeginGameplay()
{
    // ...
    CreateWritableObjects(); // Called unconditionally — writes during Player Flow!
    Player->BeginGameplay(BeginParams);
}
```

**Correct pattern (Lyra reference):**
```cpp
void TryBeginGameplay()
{
    // ...
    if (!bIsPlayerFlow)
    {
        CreateWritableObjects(); // Only during Creator Flow
    }
    Player->BeginGameplay(BeginParams);
}
```

**How to apply:** During Stage 3 implementation, always guard `CreateWritableObjects()` and action listener registration behind `!bIsPlayerFlow`. The Lyra reference makes this distinction explicit.
