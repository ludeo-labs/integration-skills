---
category: common-mistakes
tier: generalizable
sourceGame: TopDownRogueSample
phase: "3,5"
question: "Does your layer re-try starting the play flow from more than one place (the Activate callback, a consent update, a readiness gate resolving, as well as the LudeoSelected handler)? Then every one of those paths must refuse to start until THIS selection's GetLudeo callback has delivered its reader."
sanitized: true
---

# A re-drive can start the replay before GetLudeo has delivered the reader

On a preselected launch (`Activate` with `isLudeoSelected == true`, then a `LudeoSelected` a moment
later), a layer usually has several "try to start the play flow now" call sites, because it waits on
several things: activation, consent and readiness. Each queues a re-drive that checks one flag, such as
"is a selection pending?". The `LudeoSelected` handler meanwhile defers `GetLudeo` by a frame, since it
must not call into the SDK from inside an SDK dispatch.

That leaves an ordering hole. Observed timeline:

```
Activate: Success isLudeoSelected=True
LudeoSelected: <ludeoId>
restored data: no data reader
replay failed: restore data unreadable or empty   -> handed back
GetLudeo issued (<ludeoId>)                       <- only now
GetLudeo: Success                                 <- a few hundred ms later, too late
```

The Activate and consent re-drives had been queued before the handler's deferred `GetLudeo`. On the
next frame they ran first, saw a selection pending, and started the restore against no data. On a
mid-app selection the same hole is quieter and worse: the re-drive finds the **previous** Ludeo's cached
reader and replays the wrong clip.

## SDK facts that shape the fix (observed on plugin 4.3.x; re-check on the installed version)

- `isLudeoSelected = true` only promises that a `LudeoSelected` notification will follow. `GetLudeo`
  needs the id that notification carries, so it can only be issued after it.
- A forced (auto-start) launch delivered `LudeoSelected` from inside another SDK dispatch, so `GetLudeo`
  had to be deferred a frame. That deferral is exactly what opens the hole.
- `GetLudeo` had a **single static callback slot**. A second call while one is in flight overwrote the
  first call's delegate, so the first result landed on the wrong handler. Serialize the calls.

## The fix shape

- Give every selection a generation number, and remember which generation the current reader belongs to.
- The play-flow start refuses, and logs a positive "waiting for GetLudeo's reader" line, until
  `readerGen == selectionGen`. Every re-drive goes through that same check.
- Allow only one `GetLudeo` in flight. A newer selection waits and is issued when the current one lands;
  a result for an older selection is discarded and its reader disposed off the dispatch.
- Put a named deadline on `GetLudeo`, and hand back on timeout or failure.

## Related

- [[never-call-into-the-sdk-from-inside-an-sdk-callback]]: the deferral that creates the window.
- [[a-guard-that-cannot-fire-is-not-evidence]]: "a selection is pending" was a guard that was true for
  the wrong reason.
