---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: 4
question: null
sanitized: true
---

# SkipPhase must fire PhaseEndedCallback — not just return

When implementing `SkipPhase` in a game's phase subsystem, the `StartPhase()` skip check must execute `PhaseEndedCallback.ExecuteIfBound(nullptr)` before returning. Simply returning without firing the callback can stall the phase system — downstream systems waiting for the phase to end never get notified.

**Wrong:**
```cpp
if (CDO && SkippedPhaseTags.Contains(CDO->GetGamePhaseTag()))
{
    return; // Phase system stalls — nothing signals phase completion
}
```

**Correct:**
```cpp
if (CDO && SkippedPhaseTags.Contains(CDO->GetGamePhaseTag()))
{
    PhaseEndedCallback.ExecuteIfBound(nullptr); // Signal phase completed
    return;
}
```
