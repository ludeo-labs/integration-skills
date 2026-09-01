---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: 5
question: "Are you relying on a restored 'already seen / already done' latch to stop a cutscene or one-shot from re-firing — and inside the driver's Update, does the FIRE branch run before the branch that reads the latch?"
sanitized: true
---

# Restoring an "already seen" latch does not suppress what it gates — check which branch runs first

`07 §10.1` says not to blanket-suppress a viewer-facing cutscene: gate it on **state**, restore the latch,
and it fires only if the creator had not already seen it. That is right, and it is usually enough. The
failure is in *verifying* it — specifically, in reading the driver's `Update` as a set of conditions rather
than as an **ordered sequence**.

The shape, reduced:

```csharp
void Update()
{
    if (line.Count == 2 && dialogueEnded && m_cam == null)   // 1. FIRE
    {
        StartCutscene();                                     //    activates a vcam on ANOTHER object
        PlayerControlsOn = false;
    }

    if (Statics.cutsceneAnimEnded)                           // 2. self-deactivate
    {
        PlayerControlsOn = true;
        gameObject.SetActive(false);
    }
}
```

The plan's note read *"restoring `cutsceneAnimEnded = true` self-deactivates the manager"* — and that is
**true**. It is also irrelevant, because branch 1 runs first. A **correct** restore satisfies every one of
its conditions: the reference sweep rebuilt the collection to exactly the triggering count, the latch that
gates it was restored to `true`, and the driver is a fresh scene instance so its cached camera handle is
`null`. So on the first unfrozen frame the cutscene fires, *then* the manager deactivates.

And deactivating the manager does not undo what it just did. `StartCutscene()` activated a camera on a
**different** GameObject; the manager going inactive only guarantees it can never clean up. The animation
plays in full — in the observed case swinging the camera below the terrain and back — and terminates via its
own animation event.

Symptom: **"the Ludeo opens with a cutscene the creator had already seen"**, often described as a camera
glitch rather than a cutscene, because the viewer has no reason to recognise it as one.

## Why the restore is what triggers it

Live play reaches this state gradually: the collection grows to the triggering count *while* the latch is
still `false`, the cutscene fires, and the latch flips at the end. The two are never true simultaneously on
the same frame the driver first sees them. A restore materialises both **at once**, on frame 1, which is a
state ordinary play cannot produce. This is the same family as *"a latch must precede the value its
threshold guards"* — but one level up: here the latch is restored correctly and **still** loses the race,
because the ordering that matters is inside the consumer, not in the apply.

## The fix: reach the driver's own terminal state from the apply

Do not add a suppression flag, and do not edit the driver — often it is not even on the approved edit
surface. Do exactly what its own terminal branch does, one frame earlier, from the restore, where no
`Update` can interleave:

```csharp
if (Statics.cutsceneAnimEnded)          // gate on the RESTORED value, not unconditionally
{
    mgr.PlayerControlsOn = true;
    mgr.gameObject.SetActive(false);    // the same two writes branch 2 would have done
    Statics.animPlaying = false;
}
```

Two properties make this a fix rather than a suppression hack: it is **the game's own terminal state**, so
nothing novel is introduced; and it is **gated on the captured latch**, so a creator who had *not* seen the
cutscene still gets it — which is the whole point of state-gating rather than blanket-suppressing.

## How to check for this class, cheaply

For every one-shot the plan marks *"already state-gated — no code change needed"*, open the driver's
`Update` and answer one question: **does the fire branch appear above the branch that reads the latch?** If
yes, restoring the latch does not suppress the fire, and the row needs an apply-side terminal write. Reading
the plan's summary of the method is not enough — this was recorded in two separate sections as needing no
change, and both were right about the mechanism and wrong about the order.

> **A restored latch only suppresses what it gates if the consumer reads it BEFORE it fires. Plans record
> that the latch self-deactivates the driver; they rarely record that it does so on the line after the one
> that already pulled the trigger.**
