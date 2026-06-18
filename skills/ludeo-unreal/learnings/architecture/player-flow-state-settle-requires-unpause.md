---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# State restoration requires game ticks to propagate — must unpause briefly

## Problem

Applying state via reflection (special mode, weapon equip, GAS health, MatchState) while the game is paused means OnRep callbacks, animation state machines, and GAS attribute processing never run. The player sees an unsettled state for the first few seconds (no special mode, wrong weapon, default stance).

## Correct Sequence

```
1. Pause immediately on action phase start (prevents intro/voiceover)
2. Poll for pawn (FTicker works while paused)
3. Pawn ready → UNPAUSE
4. Apply state (game running — OnReps fire, GAS processes, animations trigger)
5. Poll until state settles (e.g., PlayerState->IsSpecialModeActive() returns expected value)
6. PAUSE again
7. Open Ludeo room (SDK ticks via FTicker while paused)
8. TryBeginGameplay → unpause for real
```

The brief unpause window (steps 3-6) is typically 5-15 frames. The player may see a flash of the settling process, but it's better than starting with wrong state.

## Key Details

- `FTimerManager::SetTimerForNextTick` does NOT work while paused — use `FTicker::GetCoreTicker().AddTicker()`
- `UGameplayStatics::SetGamePaused` stops `UWorld::Tick` but FTicker still runs
- SDK's `ludeo_Tick()` runs via FTicker, so room open/ready callbacks work while paused
