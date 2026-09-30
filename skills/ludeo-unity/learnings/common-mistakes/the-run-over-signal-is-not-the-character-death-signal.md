---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 3,5
question: "Is your keep-the-capture hook a character/player DEATH event? Find the game's single run-finalisation funnel (the one all endings pass through, usually with a reason enum) — if one exists, a WON run emits no death, and your capture is discarded silently."
sanitized: true
---

# The run-over signal is not the character-death signal

A capture has to be told "this run ended, keep it" — otherwise the exit path's backstop discards it.
The obvious hook is the player-death event, and in a game where you mostly die it appears to work.

It is the wrong hook whenever the game ends runs through a **single finalisation funnel**. The one this
came from had a method taking a reason enum with five values — victory, death, objective-failure,
abandon, and an abandon-on-disconnect variant — and it emitted **one parameterless "run finished"
signal** for all five. The integration hooked only the character-death event as its keep path.

The consequence is asymmetric and quiet:

- Player **dies** → death event fires → capture kept. Looks correct.
- Player **wins** → nothing dies → keep path never runs → the exit's scene-change backstop **discards
  the capture.**

So the failure only appears on the *good* runs, which are the ones worth clipping — and it appears after
the player has spent the whole run. Here it cost a 13-minute winning run.

## Why it is hard to catch by reading

The only log line was the discard itself, and its wording was reassuring:

```
gameplay aborted - the captured run was discarded (Success)
```

The `(Success)` is the **result code of the discard call**, not a verdict on the run. Nothing reports
"your keep hook never fired", because from the layer's point of view nothing went wrong — a code path
simply wasn't reached. Grep the run's log for the SDK's *end* call and its *abort* call and check
**which one** appears; presence of a clean shutdown is not evidence the run was kept.

The integration's own comment asserted that "a completed map is handled by the death/completion path,
which keeps it." There was no completion path. **A comment claiming a hook exists is not a hook** —
verify against the subscription list, which is the reason the reference architecture keeps all game-event
subscriptions in one method.

## What to do

1. **Find the funnel, not the event.** Search for the run-end/analytics finaliser the game calls when a
   run concludes — typically one method with a reason enum, with all endings routed through it. Hook
   *that*. Enumerate its call sites and confirm every ending reaches it.
2. **Keep the death hook as a secondary path.** Harmless, and it fires slightly earlier for the common
   case. Do not make it the only one — in local co-op, one character can die *without* the run ending,
   so death is both too narrow (misses victory) and too broad (fires mid-run).
3. **Latch the "kept" state, then teach the backstops to respect it.** After the run is kept, the game
   still changes scene to its result screen and then to the menu, and both hit the mid-run "player walked
   out" discard path. A single `bool` set on keep, checked by the scene-change and `sceneUnloaded`
   backstops, is enough.
4. **The latch is also a race guard, not just tidiness.** Submitting is a network round-trip, and the
   room and player handles stay non-null until its callback lands. A discard arriving in that window
   calls abort on a session that has already ended — tearing down the submit in flight. Reset the latch
   when the next capture opens, so it guards the current run rather than the previous one.

## The generalizable shape

> The event that means **"this character stopped living"** and the event that means **"this run is over"**
> are different events, and the game has both. Integrations reach for the first because it is easy to
> find; capture correctness depends on the second.

Ask it as a coverage question rather than a naming one: **enumerate every way a run can end** — won,
lost, objective failed, abandoned mid-run, disconnected — and confirm each one reaches the keep path.
Any ending that does not is a capture silently thrown away.
