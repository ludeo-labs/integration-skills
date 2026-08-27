---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Does your restore hold timeScale at 0 across a scene LOAD - a hop-out, a level swap, a menu round-trip? The incoming scene's Awake/Start is entitled to set timeScale, and a re-Hold() will not recover it if your freeze only applies on the transition INTO a hold."
sanitized: true
---

# A scene load stomps your freeze, and re-holding does not recover it

A restore that spans a scene load can come out the other side **running**, with its hold still
formally open. The incoming scene's `Awake` is ordinary game code and is entitled to do this:

```csharp
private void Awake()
{
    Application.runInBackground = true;
    Time.timeScale = 1f;          // perfectly reasonable for a menu; fatal for your hold
}
```

Menu and front-end scenes very often do exactly that, defensively, because they may be entered from
a paused game.

**Why re-holding does not help.** A well-built freeze applies `timeScale = 0` only on the
transition *into* a hold:

```csharp
public static void Hold(HoldReason reason)
{
    bool wasFrozen = EnemiesHeld;
    if (!s_holds.Add(reason)) return;    // already held -> no-op
    if (!wasFrozen) ApplyFreeze(true);   // only on the 0 -> 1 edge
}
```

The hold is still in the set, so `Hold()` returns early and never touches `timeScale`. The world is
running, every invariant the freeze protects is void, and **nothing logs anything.**

## Do this

Expose an explicit re-assert and call it after any scene load the hold spans:

```csharp
public static void Reassert()
{
    if (!EnemiesHeld || s_settling || Time.timeScale == 0f) return;
    Time.timeScale = 0f;
    Trace("freeze re-asserted - a scene load set timeScale back to 1 under an open hold");
}
```

**Log it.** The line is how you learn the stomp is real rather than theoretical — it fired on the
very first cloud run and confirmed the menu's `Awake` was doing it.

Guard against `s_settling`: a deliberate settle window legitimately runs `timeScale = 1` under an
open hold, and a blind re-assert would kill it (see `settle-the-rebuilt-moment-before-the-wait`).

## Where it bites

Anywhere the restore leaves and re-enters a scene: a hop-out through the menu to force a genuine
scene change (`replaying-from-inside-the-same-level-needs-a-hop-out`), a level swap mid-restore, a
return to a hub. Audit the incoming scene's `Awake`/`Start` for `Time.timeScale` writes before
assuming the hold survives — `grep -rn "Time.timeScale" Assets/Scripts` takes seconds and tells you
which scenes are hostile.
