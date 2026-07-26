---
category: architecture
tier: generalizable
sourceGame: Lyra
phase: 5
question: "Does the game have a warmup/countdown phase before gameplay starts? If so, Player Flow must skip it — what phase system does the game use, and can phases be skipped programmatically?"
sanitized: true
---

# Player Flow must skip pre-gameplay phases (warmup, countdown, "waiting for players")

Player Flow restores a mid-game snapshot. Any pre-gameplay phases (warmup, countdowns, "waiting for players" UI) are meaningless and must be skipped. Without this, the player sits through warmup before the restored state is applied.

**The fix requires two parts:**

## Part 1: Add SkipPhase to the game's phase system (core game mod)

Add `SkipPhase(tag)` and `ClearSkippedPhases()` to the phase subsystem. Modify `StartPhase()` to check skipped tags before activating:

```cpp
void StartPhase(TSubclassOf<UPhaseAbility> PhaseAbility, FPhaseDelegate Callback)
{
    const auto* CDO = PhaseAbility.GetDefaultObject();
    if (CDO && SkippedPhaseTags.Contains(CDO->GetGamePhaseTag()))
    {
        Callback.ExecuteIfBound(nullptr); // Important: fire the callback so the phase system advances
        return;
    }
    // ... existing StartPhase code ...
}
```

**Critical detail:** When skipping, call `PhaseEndedCallback.ExecuteIfBound(nullptr)` — not just `return`. Without this, the phase system may stall waiting for the skipped phase to end.

## Part 2: Hook in the integration component

1. In `BeginPlay` (or `OpenRoom`), when Player Flow is detected:
   - Call `PhaseSubsystem->SkipPhase(WarmupTag)` — prevents warmup from activating
   - Register `OnExperienceLoadedForPlayerFlow` callback on the experience manager

2. In `OnExperienceLoadedForPlayerFlow`:
   - Load the Playing phase Blueprint class via `TSoftClassPtr`
   - Call `PhaseSubsystem->StartPhase(PlayingPhaseClass)` — activates Playing directly
   - The existing phase observer fires → `bGamePhaseActive = true` → `TryBeginGameplay` proceeds

3. In `EndGameplay` (teardown):
   - Call `PhaseSubsystem->ClearSkippedPhases()` to restore normal phase behavior

**In Lyra specifically:**
- Warmup tag: `ShooterGame.GamePhase.Warmup`
- Playing phase asset: `/ShooterCore/Experiences/Phases/Phase_Playing.Phase_Playing_C`

**How we could have figured this out without the reference:**
The right question to ask the human during Stage 3 Player Flow implementation is: "Does the curated slice have a warmup/countdown phase before gameplay starts? Should Player Flow skip it?" The answer is always "yes" — this should be a standard part of every Player Flow implementation.
