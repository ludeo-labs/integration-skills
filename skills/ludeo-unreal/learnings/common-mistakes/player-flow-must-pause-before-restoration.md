---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: 4
question: null
sanitized: true
---

# Player Flow MUST pause the game before state restoration

## The Mistake

During FTPS_Online Player Flow, the game was not paused during state restoration. Bots spawned, AI started flying, the movement system overwrote restored positions on the next tick, and the player could take damage during restoration. The Phase 3 reference (§5.4) explicitly says:

> "IMPORTANT: Pause the game before opening the Player Flow room. During state restoration, the player character exists in the world and can take damage from AI or environmental hazards."

The agent read this, implemented Creator Flow, then implemented Player Flow without the pause because it was focused on getting bots to spawn at all.

## Why it matters

Without pausing:
1. AI movement overwrites restored positions immediately (bots fly away from captured positions)
2. The player can take damage during restoration (health gets decremented before it's restored)
3. The game's timer/round system continues counting during restoration
4. Spawned bots start their AI behavior before all bots are spawned and positioned

## The fix

```cpp
// In ApplyPlayerFlowState, BEFORE applying any state:
UGameplayStatics::SetGamePaused(GetWorld(), true);

// Apply all state (player + bots)...

// After all state is applied and BeginGameplay is called:
UGameplayStatics::SetGamePaused(GetWorld(), false);
```

Or use the game's own pause mechanism if `SetGamePaused` doesn't freeze AI/physics.

## Prevention

The Phase 3 reference lists this in Section 5.4. The agent should implement it at the same time as ApplyPlayerFlowState, not defer it. Pausing is structural to restoration correctness, not an optional polish step.
