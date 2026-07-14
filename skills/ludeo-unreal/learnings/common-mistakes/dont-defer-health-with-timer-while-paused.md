---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Never use SetTimerForNextTick while the game is paused — timers don't tick when paused

## Problem

`FTimerManager::SetTimerForNextTick` schedules a callback on the next game tick. But `UGameplayStatics::SetGamePaused(true)` stops `UWorld::Tick`, which means `FTimerManager::Tick` never runs. The timer callback never fires.

The agent used `SetTimerForNextTick` for `DeferredApplyHealth` and `UnpausePlayerFlow`, then paused the game. Neither callback ever fired — health was never applied and the game stayed paused permanently.

## Fix

If the game is paused (or might be paused), do NOT use `SetTimerForNextTick`. Either:
1. Apply synchronously (check current value to avoid GAS ensures)
2. Use `FTicker::GetCoreTicker().AddTicker()` which runs independently of game pause
3. Apply before pausing

## How to Apply

During Player Flow implementation, any deferred work must account for the pause state:
- `FTimerManager` → blocked by pause
- `FTicker` / `FTSTicker` → runs regardless of pause (used by SDK tick)
- Synchronous application → always works, check values before setting
