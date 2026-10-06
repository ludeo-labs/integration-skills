---
category: architecture
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your restore plan put the run clock / elapsed time LAST because something would overwrite it? Then check what READS the clock at write time. Anything the apply derives from it - entity level, difficulty scaling, spawn budgets - is computed against zero, and the restore silently rebuilds a mid-run moment out of start-of-run parts."
sanitized: true
---

# "Restore the clock last" collides with everything derived from the clock

Two rules that are each individually right, and contradict each other:

- **Write the clock last**, because the level-entry trigger zeroes it and a player buff mutates its
  multiplier, so an early write gets overwritten.
- **Write entity health after levelling**, because maximum health is derived from level and never
  stored, so the capture records health as a *percentage* and the restore has to multiply it back up.

The collision is that levelling reads the clock. The level formula was
`FloorToInt(elapsedTime / interval)` against a difficulty curve — so with the clock still at zero,
every one of several hundred restored enemies came back as a level-1 creature in a run eleven minutes
deep. Their health percentage was *correct*; the number it was a percentage of was the start-of-run
maximum. The visible symptom is not a wrong health bar, it is enemies dying to one hit.

Nothing in the plan caught this, because each rule was written in its own entity section and the
dependency runs between them.

## The fix, and why it is safe

Pre-load the clock before the pass that derives from it, and still write the full clock bucket last:

```
baseline resets
clock PRE-LOAD          (elapsed time only)
fight/wave cursors
entities                (levelling reads the pre-loaded clock; health follows)
references
player
clock cursors
clock                   (in full, including the multiplier)
```

The early write is safe for a reason worth stating rather than assuming: **the apply is one
synchronous block inside the freeze**, so no frame runs between the two writes and nothing can
observe the intermediate state. The thing that would have overwritten it — the level-entry trigger —
is suppressed for replays anyway.

## The half-state this creates, and the guard it needs

The pre-load does introduce one genuinely destructive half-state: a mid-run clock sitting above
*unrestored* wave cursors makes the fight update loop walk the whole elapsed fight in a single frame
and then fire the last wave's completion event, which ends the run about a second in. That is only
reachable if the apply throws part-way through.

So wrap the apply and put the clock back on failure:

```csharp
try { ApplyInOrder(ctx); }
catch (Exception e)
{
    Debug.LogException(e);
    game.ElapsedTime = 0f;   // a visibly fresh run beats a run that ends a second after it starts
}
```

A visibly wrong replay is a bug report. A replay that plays for one second and then shows a
run-failed screen is a bug report *and* a wrong diagnosis, because it looks like the ending logic.

## Generalize the check, not the fix

The specific pairing here was clock → level → maximum health. The shape is: **the restore writes a
value that another restore write reads at the moment it is written.** Before committing an apply
order, walk every "deferred until after X" note in the plan and ask what X's own inputs are. Ordering
constraints written per entity do not compose on their own — see
[[write-restored-state-to-whoever-owns-it]] for the same lesson about ownership rather than order.
