---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Are you adding a per-class register hook to a Start()/Awake() to reach an entity the base hook and the backstop sweep both miss — and does your registry DISCARD register notifications that arrive before the room is open?"
sanitized: true
---

# A per-class register hook added in `Start()` fires before capture goes live — and a registry that drops early notifications makes it a silent no-op

[[one-base-class-register-hook-misses-subclasses-that-skip-base-start]] sorts the subclasses that skip
`base.Start()` into two failure classes, and prescribes the fix for class 2 (skips the base hook **and**
never joins the game's own live list): a one-line per-class hook in that class's own `Start()`, because
no layer-side sweep can reach it. That prescription is correct and incomplete. Adding the line is not
enough, and the way it fails is invisible.

## The ordering nobody writes down

Capture registration has two phases, and almost every integration ends up with both:

1. a **batch pass** at gameplay-begin that registers everything already alive, and
2. a **per-object hook** for things that appear *during* the run.

The hook is therefore written to no-op before the batch pass, with reasoning that reads as obviously
correct:

```csharp
public void NotifyEntitySpawned(Entity E)
{
    if (!m_CaptureLive || IsInLudeoFlow) return;   // before Begin: the batch pass will pick it up
    Track(E);
}
```

"The batch pass will pick it up" is true **only for entities the batch pass can see** — and the batch
pass enumerates the game's own live list. That is the exact list a class-2 skipper never joins. So for
the one family the new hook exists to rescue:

- its `Start()` runs at **scene load**, long before the room is open, so `m_CaptureLive` is `false`;
- the notification is discarded;
- the batch pass runs later and cannot see it either;
- the backstop sweep re-syncs against the same list and cannot see it either.

The entity is untracked for the whole run, exactly as before the fix. Nothing errors. The register-count
log line is unchanged, because it counts what was registered, not what was offered. Code review passes —
the one-line hook is visibly present in the game file, and the registry's early-return is visibly
correct in isolation. The two are only wrong **together**, and they live in different files.

## The fix: remember, don't discard

Make the pre-live branch record rather than drop, and drain the record at the end of the batch pass:

```csharp
if (!m_CaptureLive)
{
    if (E != null && m_Pending.Count < CAP && !m_Pending.Contains(E)) m_Pending.Add(E);
    return;
}
```

For every family that also joins the live list this is redundant with the batch pass — harmless, because
`Track()` is idempotent on identity. For the family the hook exists for, the discarded notification *was*
the only signal it will ever produce.

Bound the list. A scene load announces every entity in it before the room opens, and if no run is ever
begun there is no End/Abort to clear it.

## Why this generalizes past the one class

The pattern is: **a "cheap" fallback justifies discarding a signal, and the fallback's blind spot is
precisely the case the signal was added for.** Whenever you write an early-return whose comment is "the
other path will catch this", check that the other path can see *this specific* object — not that it can
see objects in general. Here the two paths look independent and are actually the same enumerator.

## Test for it at the gate, not by reading

The runtime check is a per-family count in the batch-pass log, not a total. A total of "Enemies=23" is
consistent with the rescued family being present or absent. Log the classification counts (bosses,
minions, the specific rescued family) so the gate can distinguish them, and log any **accepted** gap
unconditionally by name — an absence that is only recorded in a plan document is an absence that gets
rediscovered at a restore gate.
