---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 5
question: "Is your restore calling a game API that returns void and reads as a plain command - Spawn, Place, Give, Drop? Open it before you treat the next line as 'it has happened'. If anywhere in its body it resolves an asset by name or address, it is asynchronous, and the restore will report itself finished before the thing exists."
sanitized: true
---

# A void-returning game call can still be asynchronous, and the restore will lie about being finished

The async calls a restore has to wait for are usually obvious: they return a handle, take a callback, or
are named `...Async`. Those get waited on. The ones that slip through look like commands:

```csharp
spawner.SpawnPickup(pickupType, position);   // returns void  (synthetic illustration)
```

Nothing at the call site suggests waiting. But inside, it resolves the prefab by name through the same
asynchronous loader everything else uses, then spawns from the callback. The call returns immediately and
the thing it names appears some frames later.

## What it looks like when it bites

The restore's own gate caught this, and the timestamps are the whole story:

```
- restore-with-the-real-apply   ok      at 33.1036s
- verify-it-came-back           FAILED  at 33.1056s
    floor holds 1 item(s); slot 0 = (empty) at (0.00, 0.00, 0.00)
```

Two milliseconds apart. The apply had a perfectly good wait loop — for the *other* spawn path, the one
with a callback to decrement a counter. The void-returning path incremented nothing, so the loop had
nothing to wait for and fell straight through. The restore reported success while the floor was empty.

In a replay this is worse than a plain bug: the restore unfreezes the world and hands over to the player
on the belief that it is done, so the missing things pop into existence during play, or never, depending
on timing. It is also the kind of fault that passes on a fast machine and fails on a slow one.

## The check

**Before treating any game call in a restore as synchronous, read its body for an asset resolve** — a
load-by-name, a load-by-address, an addressables handle, a pooled `Get` that may have to instantiate.
Note that one level of indirection is enough to hide it: the overload you call may be a thin wrapper
around another one, and the load is in the inner one.

## Waiting on something that reports nothing

A path with no callback gives you nothing to count, so **watch the world instead of the call**:

```csharp
int floorBefore = Registry.Count;
int requested   = 0;
// ... issue the void-returning spawns, counting `requested` ...

while (waited < deadline)
{
    bool outstanding = pending > 0                                  // the path that does report
                    || (requested > 0 && Registry.Count < floorBefore + requested);  // the one that does not
    if (!outstanding) { break; }
    waited += Time.unscaledDeltaTime;
    yield return null;
}

int arrived = Mathf.Clamp(Registry.Count - floorBefore, 0, requested);
```

Two details worth keeping:
- **Reconcile the counters against what actually arrived**, rather than assuming every request became a
  thing. `arrived` is the truth; `requested - arrived` is the failure count, and it should be reported.
- **Keep the deadline**, and warn when it expires rather than hanging. A restore that waits forever for
  an asset that will never load is a worse outcome than one that says what is missing.

## Why the gate found it and review would not have

The call reads as synchronous, the wait loop existed and looked right, and the counter it waited on was
genuinely correct for the path it covered. Nothing about the code looks wrong. What exposed it was a test
that **removed the thing, ran the real restore, and then checked the world** — and reported the timestamps
of both steps, which made a two-millisecond gap impossible to misread.
