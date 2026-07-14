---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 5
question: null
sanitized: true
---

# Player Flow: game gameplay FIRST, then restore state, then Ludeo room — never the reverse

## Problem

The agent repeatedly got the Player Flow sequence wrong despite the Phase 3 reference and `pause-before-player-flow-room.md` learning explicitly documenting the correct order. The agent's mistakes:

1. **First attempt:** Applied state in `BeginPlay` → opened room → tried to unpause via timer (deadlock — paused game doesn't tick timers)
2. **Second attempt:** Applied state in `BeginPlay` next tick before game's spawn logic → game's `RestartPlayerAtPlayerStart` overwrote positions → "restored to beginning of the mission"
3. **Third attempt (wrong):** Proposed moving `ReadAndApplyState` to `TryBeginGameplay` — but that's AFTER the Ludeo room is open and BeginGameplay SDK is called, which means the state isn't ready when SDK starts gameplay

## Correct Sequence (MANDATORY)

```
1. Game boots into the match normally (state machine → gameplay phase)
2. OnGameplayPhaseStarted fires → game gameplay is FULLY RUNNING
   - Player pawn is spawned and at PlayerStart
   - AI crew is spawned
   - All game systems are initialized
3. ReadAndApplyState() — overwrite positions, health, cosmetic state, vehicles, spawn transient entities
4. SetGamePaused(true) — freeze everything to protect the restoration window
5. TryOpenRoom() — open Ludeo room with LudeoID
6. AddPlayer → wait for RoomReady callback (FTicker still runs while paused)
7. TryBeginGameplay gates pass → SDK BeginGameplay → unpause
8. Game plays with restored state
```

## Why This Order

- **Game first (steps 1-2):** The game's spawn logic MUST complete before we overwrite positions. If we apply state too early, `SpawnDefaultPawnFor → RestartPlayerAtPlayerStart` resets the player to the default spawn.
- **State before room (steps 3-4):** SDK `BeginGameplay` means "the game is ready to play." State MUST be fully restored before that call.
- **Pause between state and room (step 4):** Protects the window between "state applied" and "SDK BeginGameplay." Without pause, AI attacks the player during the SDK handshake.
- **Unpause after BeginGameplay (step 7):** Game resumes with everything in place.

## Red Flags

If the agent proposes any of these, STOP:
- Opening the Ludeo room in `BeginPlay` (too early — game hasn't spawned entities yet)
- Applying state via `SetTimerForNextTick` while game is paused (timer won't fire)
- Applying state AFTER `BeginGameplay` SDK call (SDK expects state to already be ready)
- Applying state in `BeginPlay` before the action phase starts (game's spawn logic will overwrite)

## How to Apply

In every integration's Player Flow component:
1. Wire `OnGameplayPhaseStarted` (or equivalent "gameplay ready" delegate)
2. In that handler, if `bIsPlayerFlow`: run restore → pause → open room
3. In `TryBeginGameplay`: if `bIsPlayerFlow`: unpause
