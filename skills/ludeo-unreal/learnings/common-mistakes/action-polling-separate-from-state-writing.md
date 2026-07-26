---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: 6
question: null
sanitized: true
---

DetectPollBasedActions() must NOT be called from inside UpdateWritableObjects(). UpdateWritableObjects has a `if (bIsPlayerFlow) return;` guard that blocks state writing during Player Flow — but action polling needs to run in BOTH flows.

**Wrong:**
```cpp
void UpdateWritableObjects()
{
    if (bIsPlayerFlow) return;  // ← Blocks everything including action polling
    // ... write state ...
    DetectPollBasedActions();    // ← Never runs in Player Flow
}
```

**Correct:**
```cpp
void TickComponent(float DeltaTime, ...)
{
    if (TimeSinceLastWrite >= WriteInterval)
    {
        if (!bIsPlayerFlow)
            UpdateWritableObjects();  // Creator Flow only: write state
        
        DetectPollBasedActions();     // BOTH flows: action detection
    }
}
```

**General principle:** Separate action detection from state writing in the tick loop. State writing is Creator-only. Action detection runs always.
