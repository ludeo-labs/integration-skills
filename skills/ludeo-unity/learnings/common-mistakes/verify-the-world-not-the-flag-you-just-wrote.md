---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "5,6"
question: null
sanitized: true
---

# Never verify a restore against a field the restore itself writes

A restore check exists to answer one question: **did the world end up in the recorded state?** It is
worthless the moment it answers a different one — *did we call the thing we meant to call?* Those two
questions look identical in code and produce the same green line in the log, and only one of them can
fail.

The concrete failure: destructible scenery was restored by calling the game's own `Break()` on each
piece the recording showed smashed. The checkpoint that verified it asked `breakable.isBreak`. But
`Break()` sets `isBreak = true` on its **first line** and defers the part that actually removes the
mesh and spawns the debris to a next-frame task. So the restore wrote the flag, and the check read
the flag. It could not fail. Five consecutive replays logged a flawless *"16 of 16 knocked down,
Scenery OK"* at every checkpoint while the integrator watched the wall stand there whole and said *"at
least twice it seems the wall was broken and 3 times not, but I cannot be sure."* His eye was the only
working instrument in the room, and the log had been actively lying for a day.

It also silently invalidated everything built on top of it. Restored enemies were placed *after* the
scenery restore precisely so the world would be the right shape before anything had to stand in it —
and enemies kept falling through the floor. Every investigation of those falls started from "the
scenery restored correctly, so it must be something else." It hadn't, and it wasn't.

## The test for whether a check is real

> **If the restore's own call had done nothing at all, would this check still pass?**

If yes, it is not a check. Delete it or replace it. Apply this to every assertion a restore makes
about itself, at the moment you write it — it takes seconds and it is the only thing standing between
you and a day of green logs.

## Why this is so easy to write

The flag is *the most convenient thing in the room*. It is public, it is named exactly after the
question being asked, it is already in hand because the restore just used it, and reading it needs no
knowledge of how the effect is implemented. Every incentive points at it. Checking the real observable
instead requires knowing what the state change physically does — which object gets deactivated, which
renderer gets disabled, which collider leaves the physics scene — and that is work.

The trap has a shape worth recognising: **setter now, effect later.** It is everywhere.

- a next-frame or async task that performs the visible half (`await Yield(); ApplyIt()`)
- networked/replicated flags that set locally and take effect when the client is told
- dissolve, animation or VFX-driven visuals, where the object is "dead" long before it is gone
- pooled objects, whose flags are reset on acquire rather than on the state change

In all of them the flag is the **order**, and the effect is what collides, renders, and gets seen. A
restore cares only about the second one.

## Check what the player and the physics engine touch

Ask the world the same question the world will ask:

- is the intact object still active in the scene — the thing an overlap or a raycast will still hit?
- is a renderer actually enabled on it, rather than a visibility flag saying it should be?
- is the collider present in the physics scene, rather than a "destroyed" bool being true?

And when the check does fail, report **both** halves — "still standing, and N of them report the flag
TRUE" — because *ordered but not applied* and *never ordered at all* are completely different bugs and
you will otherwise chase the wrong one.

## This was the second time

An earlier bug in the same integration had exactly this shape: a check confirmed restored enemies were
visible by testing the visibility flag *the restore had just written*, and reported dozens of enemies
present above an empty room. That was found, fixed, and written up — as a fact about that one enemy
check. It was never generalised, so the same mistake was made again on a different object family and
cost most of a session.

**A bug that recurs in a new place was never really understood the first time.** When you fix
something, ask what class of thing it is an instance of, and write down the class.
