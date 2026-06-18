---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: 2
question: "Are you tempted to delay `Player->BeginGameplay()` until after some post-room-ready cleanup completes? Don't — call it as soon as your N-way gate (Room Ready + Player Added + Game Phase) latches. Cleanup runs after."
sanitized: true
---

# Don't defer `Player->BeginGameplay()` past the SDK's expected window

## The temptation

Your N-way gate (Room Ready + Player Added + Game Phase Active) just latched. You'd like the world to be in its FINAL settled state before telling the SDK "gameplay started," so you wrap the SDK call inside a 3s post-unpause cleanup ticker:

```cpp
// WRONG — Player->BeginGameplay() never reliably fires
StartPostUnpauseSweep([this]
{
    SweepStrayLevelBPSpawns();
    DialogManager->ResumeAfterLudeoBoot();

    // SDK signal LAST — world is in final settled state now.
    if (PlayerHandle.IsSet())
    {
        const FLudeoPlayer* P = FLudeoPlayer::GetPlayerByPlayerHandle(PlayerHandle.GetValue());
        P->BeginGameplay(BeginParams);
    }
});
```

This looks reasonable — the SDK only sees "gameplay started" once your sweep is done.

## What actually happens

In a fresh-load Player Flow run on ActionGame (Round-11 attempt), the deferred SDK call **silently never fires**. Symptoms:

- Game IS playable post-restore: pawn correct, weapons equipped, AI present, `SendAction(PlayerShot/Kill/Headshot)` returns OK.
- But the Ludeo "never really does anything" end-to-end — no highlight finalization, no goal evaluation, no progression in whatever the SDK's gameplay phase drives.
- Searching the log for `ludeo_Player_BeginGameplay` returns ZERO matches.
- Your sweep completion log also doesn't appear, so the FTicker handler silently dropped (component re-create, weak-ptr invalidation, whatever — doesn't matter, the point is it's fragile).

The exact failure mode of the ticker isn't the takeaway. The takeaway is: the SDK has an expected window for the BeginGameplay signal, and putting it behind a post-unpause cleanup phase is risky enough that you should just not.

## The rule

**Call `Player->BeginGameplay()` as the immediate response to your N-way gate latching.** Anything you want to do after — sweeping stray actors, resuming muted audio, post-restore housekeeping — runs AFTER the SDK signal, ideally on its own FTicker that doesn't gate the SDK.

Correct ordering for an N-way gate `TryBeginGameplay()`:

```cpp
void TryBeginGameplay()
{
    if (!AllGatesLatched()) return;
    bGameplayStarted = true;

    if (!bIsPlayerFlow) CreateWritableObjects(); // Creator only

    // SDK signal IMMEDIATE — the gate latch is already "world is ready"
    Player->BeginGameplay(BeginParams);

    RegisterActionListeners();
    SetComponentTickEnabled(true);

    if (bIsPlayerFlow)
    {
        SetPaused(false);
        EnableInput();
        StartPostUnpauseSweepTicker(); // runs in parallel; does NOT call SDK
    }
}
```

The post-unpause sweep / dialog-resume / late-spawn cleanup runs concurrent with gameplay — it's an internal housekeeping detail, not an SDK-visible state.

## Why deferring breaks things

A few overlapping reasons:

1. **The SDK has internal state machines that progress on `BeginGameplay`.** Highlight tracking, goal/constraint evaluation, room-state transitions — they can all be gated on the BeginGameplay signal arriving promptly. If you delay, those state machines hang (no error — just no progress) even while actions get queued.
2. **Ticker-deferred SDK calls are fragile.** Component lifetime in UE is not guaranteed across in-place reset / level transitions / GC sweeps. If the ticker's `WeakObjectPtr` invalidates between firing and the lambda body running, the SDK call is silently dropped. Compare to an immediate call where the component IS the caller — the ownership is trivial.
3. **The "world isn't settled yet" worry is usually wrong.** If your N-way gate already includes "Game Phase Active" + "Player Added" + "Room Ready", the world IS settled enough for the SDK. Late-arriving level-BP spawns are a problem your sweep solves AFTER, not BEFORE.

## How to detect this in a log

Two log lines should appear back-to-back at the moment the gate latches:

- `=== BeginGameplay — all gate conditions met (PlayerFlow=N) ===` (your gate log)
- `[Ludeo] Core: ... ludeo_Player_BeginGameplay(0x...) ...` (SDK Verbose log)

If your gate log fires but the SDK log does NOT, look at how you're calling `Player->BeginGameplay()`. If it's behind a ticker / timer / async callback, move it to fire immediately on gate latch.

## Cross-reference

- `action-listeners-must-register-in-player-flow.md` — same area: actions need to flow in Player Flow too.
- `actions-must-fire-in-player-flow-too.md` — Player Flow needs actions for goal evaluation.
- `check-sdk-logs-not-just-game-logs.md` — verify the SDK actually got the signal, don't just assume from your own log.
