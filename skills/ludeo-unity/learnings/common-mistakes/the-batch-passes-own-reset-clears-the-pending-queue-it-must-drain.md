---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Did you implement the 'remember, don't discard' pending queue for pre-live spawn notifications — and does your batch pass call a Reset()/Clear() on its own registry before it drains that queue?"
sanitized: true
---

# The batch pass's own `Reset()` clears the pending queue it exists to drain — the discard comes back, in a second file

[[the-per-class-register-hook-fires-before-capture-goes-live]] prescribes the fix for a register hook
that fires at scene load, before the room is open: **remember, don't discard.** The pre-live branch
records the object instead of dropping it, and the batch pass drains the record at the end.

Implement that and you will almost certainly write this next, because a capture registry needs to be
re-entrant across runs (a restart, a second replay, an Editor re-play):

```csharp
public static void RegisterAll(Controller c)
{
    if (c.IsInLudeoFlow) return;
    if (m_live) return;

    Reset();                 // <-- clears counters, the tracked-key set … AND m_pending
    m_live = true;

    RegisterFromSweep(c);
    DrainPending(c);         // <-- drains a list that is now empty, every time
}
```

`Reset()` is correct in isolation: a new run must not inherit the previous run's counters, tracked-key
set or handler bookkeeping. `DrainPending()` is correct in isolation. **Together they restore the exact
bug the pending queue was added to prevent**, and every symptom is identical to the original: the entity
is untracked for the whole run, nothing errors, and the register-count log line is unchanged because it
counts what was registered, not what was offered.

## Why it survives review

This is the same two-files-each-correct shape as the parent learning, one level up. The reviewer checks
that the hook records rather than discards (it does), and that the batch pass drains (it does). Nobody
diffs *what `Reset()` touches* against *what `DrainPending()` reads*, because `Reset()` reads as generic
hygiene rather than as a participant in the registration protocol.

It is also invisible to the obvious test. If you exercise it by calling `NotifyObjectSpawned` **after**
capture goes live, the notification takes the live branch, never touches `m_pending`, and registers fine.
The queue is only load-bearing on the pre-live path — the one that runs before you can attach a debugger
to a room that does not exist yet.

## The fix: split the two resets by lifetime, not by convenience

The pending queue has a **different lifetime** from every other field in the registry. Counters and the
tracked-key set are per-**run** state. The queue is per-**scene-load** state, and its whole point is to
survive from scene load into the batch pass — i.e. across the very boundary `Reset()` marks.

```csharp
private static void ResetCounters()          // per RUN — called at the top of the batch pass
{ /* counters, tracked-key set, caches … and NOT m_pending */ }

public static void Reset()                   // per RUN TEARDOWN — called on End/Abort
{ ResetCounters(); m_pending.Clear(); }       // <-- the only place the queue is cleared
```

Clearing the queue **only** at teardown also keeps the parent learning's bound honest: the reason to
bound the list is "a scene load announces everything before the room opens, and if no run is ever begun
there is no End/Abort to clear it." A cap plus a teardown clear covers both; a clear at the *start* of
the batch pass covers neither, it just hides the queue.

## The generalization

> **When you add a buffer that deliberately spans a lifecycle boundary, audit every existing
> `Reset`/`Clear`/`Init` that straddles that same boundary — the buffer's whole value is that it is not
> per-phase state, and it will have been swept into a per-phase reset by default.**

Same shape anywhere a "carry this across the gap" collection meets a tidy-up routine: queued analytics
events cleared by a session reset, deferred audio cues cleared by a scene-change handler, a pending-input
buffer cleared by the state-machine's `Enter()`. Ask of each reset: *is this clearing per-phase state, or
is it clearing the one thing whose job is to outlive the phase?*
