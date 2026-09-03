---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 3
question: "Does the game's restart path Abort the old run and start the new one in the SAME synchronous call chain — i.e. does the next run's OpenRoom trigger fire before the Abort/CloseRoom callbacks have completed?"
sanitized: true
---

# On restart, the async `Abort` + `CloseRoom` can finish AFTER the new run's `OpenRoom` intent — retry from the teardown callback

The idempotency guard that keeps `OpenRoom` from stacking rooms ("do nothing if a room is already
open") turns into a **silent capture loss** on the restart path, because `End`/`Abort` and `CloseRoom`
are callback-driven while the game's restart is synchronous.

A typical in-place restart runs, in one call stack:

```
Restart()
  └─ [Layer] AbortRun()          → AbortGameplay → (async) → CloseRoom → (async) → room = null
  └─ reset every level element
  └─ InitLevel()                 → [Layer] NotifyLevelStarted() → wants capture
                                     └─ room is STILL non-null here → returns, does nothing
```

The abort callbacks land a few frames later, clear the room — and **nothing ever retries**. The first
run captures, every run after a restart is silently uncaptured. It passes a smoke test completely,
because the smoke test is the first run.

## The fix — retry from the teardown callback

```csharp
m_switch.LudeoGameplay.AbortGameplay(() =>
    m_data.ludeoRoom.CloseRoom(_ => {
        m_data.ludeoRoom = null;
        m_roomOpenInFlight = false;
        ResetBeginGate();
        onDone?.Invoke();
        TryOpenCreatorRoom();   // <-- the new run may already have recorded its intent
    }));
```

`TryOpenCreatorRoom()` is the same guarded, idempotent open used everywhere else, so this is safe in
both interleavings:

- **teardown finishes first** → the retry sees no recorded intent and no-ops; the later
  `NotifyLevelStarted` finds a null room and opens normally;
- **the new run's intent lands first** → `NotifyLevelStarted` bails on the still-open room, and this
  retry picks it up.

Put the retry **after** `onDone`, not before: on the play-flow re-entrancy path `onDone` is what
switches into the play flow, and the creator retry must then see that flag already set so it declines.

## The general rule

This is the same shape as the consent race, one layer down. Any time an **async teardown** and a
**synchronous next-run trigger** share a guard variable, the guard needs a retry on the async side —
recording intent alone is not enough, because the thing that *consumes* the intent already ran.

**Audit prompt:** for every guard of the form "skip if a room/session already exists", ask *what
re-triggers this once the existing one goes away?* If the answer is "the next time the game happens to
fire the start signal", the run in between is lost.

Related: [[hook-the-scene-load-funnel-below-its-already-loading-guard]] — both are cases where the exit
hook's timing, not its presence, is what decides whether the next run records.
