---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5"
question: "Is the capture segment opened from a per-frame game tick (rather than a one-shot event)? If so, does anything stop the very next tick from reopening it after a deliberate close?"
sanitized: true
---

# A per-frame "open the segment" call will undo your close on the next frame

Opening the capture room from a per-frame tick is attractive, and the reasoning sounds solid:

> Opening is idempotent, so a per-frame call is free — and a run whose consent arrived a frame
> late still gets captured.

Both halves are true. The conclusion is still wrong, because **close is not idempotent against a
tick that is still running.** The hook site — a level/dungeon controller's `Update` — keeps
ticking for a while *after* the player leaves, including across the transition back to the menu.

Observed sequence, straight from the log:

```
Opening a capture room ... → Room ready → Gameplay begun          ← correct
Closing the capture room (discard)   ← player headed back to the lobby
Opening a capture room ...           ← reopened ~1 frame later
Closing the capture room (discard)   ← closed again by the same exit
Opening a capture room ...           ← and a third time
Room reported ready
<lobby scene loads>
Gameplay begun                       ← now capturing the MENU
```

Two harms: rooms are opened and abandoned on the backend, and — much worse — the integration
begins capturing non-gameplay, which is exactly what session bracketing exists to prevent.

## The fix: identity, not a boolean

A `bool segmentOpen` cannot tell "this run is finished" from "nothing is open yet". Give the tick
a **run identity** and refuse to reopen one already closed:

```csharp
// game side, one line, unchanged otherwise
LudeoHooks.SegmentTick(GetInstanceID());   // unique per level-scene load

// layer side
if (m_finishedRunKey == runKey) return;    // already closed this run - do not reopen
...
m_currentRunKey = runKey;

// and on close
m_finishedRunKey = m_currentRunKey;
```

The late-consent self-heal survives: the consent handler retries with the same
`m_currentRunKey`, and that key is not the finished one.

Pick a key that is genuinely unique per gameplay segment. A scene-instance id works because the
controller is recreated per level load. A level *name* or index does not — replaying the same
level twice must be two different runs.

## How to spot it before a human does

Grep your own run log for an `Opening` that follows a `Closing` with no gameplay in between, and
compare against the scene trail:

```
grep -E "Opening a capture room|Closing the capture room|Loaded scene" player.log
```

The tell is a close-then-open pair inside the same level, or — the loud one — a "gameplay begun"
that lands *after* the menu scene loads. **A compile gate cannot catch any of this**; it only
shows up in a real run, which is why the run gate is not optional.

Related: [[ending-a-recording-is-async-do-not-shut-down-on-the-next-line]] — the other lifecycle
bug from the same engagement that only the log revealed.
