---
category: architecture
tier: universal
sourceGame: ActionGame
phase: 4
question: null
sanitized: true
---

# Don't pause the game while waiting on an async load in Player Flow

## The rule

If Player Flow needs to wait on an async operation that depends on game-thread tick — streamable asset loads, replication of player state, GAS setup, loadout streaming — **do not pause the game during the wait**. `UGameplayStatics::SetGamePaused(true)` stops tick, which stops `FStreamableHandle::Update`, which stops completion dispatch. The delegate you're waiting on never fires. Your safety timeout is what eventually proceeds, and you proceed with the load never having completed.

## Evidence

ActionGame Stage 3 fast-click setup-skip bug:
- Paused variant: `Player Flow: loadout not yet loaded, waiting for OnLoadoutLoadedDelegate...` at T+0.
  `loadout-loaded timeout after 5s; proceeding anyway` at T+5s. Every time.
- Unpaused variant (input disabled instead): delegate fires within ~1 s, no timeout.

## What to do instead

- Keep the game unpaused during the wait so the async pipeline keeps ticking.
- Disable **player input** (`SetIgnoreMoveInput(true)` + `SetIgnoreLookInput(true)` on the local PC) so the user can't see/move the scene during the wait. See `use-ignore-input-during-player-flow-wait.md`.
- After the wait's signal fires, let a few frames pass unpaused so animation/pose can settle (see user feedback from ActionGame: "we may want to unpause for a moment after loadout is done, to allow the game a frame to animate").
- THEN pause + `TryOpenRoom`.

## Exception: FTicker still ticks while paused

`FTicker::GetCoreTicker()` is NOT the same as world timers — it DOES tick while paused (per existing ludeo_gotchas Point 3). So it's fine to use FTicker for delay loops or safety timeouts during paused windows. It's only the asset/replication/GAS pipeline that halts with pause.

## How to apply

Any Player Flow wait in Stage 3 / Stage 5 / Stage 7. Before adding a `SetGamePaused(true)` call around a wait, ask: does the signal I'm waiting for depend on game-thread tick? If yes, don't pause — disable input instead.

## Related

- `use-ignore-input-during-player-flow-wait.md`
- `gate-openroom-on-loadout-ready.md`
- `ludeo_gotchas.md` Point 3 (project memory) — FTicker vs FTimerManager during pause
