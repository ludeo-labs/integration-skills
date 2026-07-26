---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 6
question: null
sanitized: true
---

Actions (Kill, Death, WeaponFired, etc.) must fire in BOTH Creator Flow AND Player Flow. Do NOT guard RegisterActionListeners() with `if (bIsPlayerFlow) return`.

During Player Flow, the SDK uses actions to evaluate the Ludeo's scoring rules (goals and constraints). For example, a Ludeo with goal "Kill 10 enemies" needs Kill actions to fire during replay so the SDK can determine if the player won or lost.

**Wrong:**
```cpp
void RegisterActionListeners()
{
    if (bIsPlayerFlow) return; // ← WRONG: skips action tracking during replay
    ...
}
```

**Correct:**
```cpp
void RegisterActionListeners()
{
    // Register in BOTH flows — Player Flow needs actions for scoring
    ...
}
```

Note: State WRITING (CreateWritableObjects, UpdateWritableObjects) is still Creator Flow only. But action SENDING works in both flows.
