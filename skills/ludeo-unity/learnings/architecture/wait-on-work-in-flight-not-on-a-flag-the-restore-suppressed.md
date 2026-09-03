---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Is the restore waiting on a game flag before it applies - a 'still loading' / 'still spawning' signal? Find out what LOWERS that flag. If the only thing that lowers it is the very system the restore suppresses, the wait can only ever end in its timeout."
sanitized: true
---

# Wait on the work actually in flight, not on a flag your own restore stopped anything from lowering

The restore has to let the room finish standing its own enemies up before it applies, or the room's
setup switches off everything the restore just placed. The obvious signal is the game's own
"still spawning enemies" flag, so the restore waits on it with a timeout.

Then measure it. In one integration that wait burned **7.6 of the 10 seconds** between the player
selecting a moment and the moment becoming playable, on every single replay, and ended in a warning
describing a fault that was not there.

The flag was raised by the room transition and lowered in exactly ONE place: the tail of the
per-enemy activation coroutine. The restore arms the recorded wave cursor so the room does not
re-fight waves it had already fought - which means the activation coroutine never runs - which means
nothing ever lowers the flag. **The wait could only end in its own timeout, by construction, on every
moment recorded mid-fight.** Which is most of them.

## The shape of the fix

Do not ask "is the flag down". Ask "is anything actually doing the work". Count the in-flight
activations directly - increment when the work starts, decrement at every exit including the early
ones - and break as soon as the count is zero. Keep honouring the flag when it *does* clear, because
when it clears it is telling the truth.

Two details that are easy to get wrong, both of which cost a round:

- **A latch for "the room's setup has run at least once" is required, not optional.** The restore
  starts waiting BEFORE the room fires its enter signal, so at that instant nothing is in flight yet.
  Break on "count is zero" alone and the restore applies, then the room's setup deactivates every
  enemy it just placed a fraction of a second later. The break condition is *at least one setup pass
  completed AND nothing in flight*.
- **Do not count work that is merely SCHEDULED.** The first version incremented on entry to the
  wave-enable coroutine - including the safecheck branch that schedules a mandatory wave **ten
  seconds** out. A wave that has not begun waiting on anything is not standing enemies up, so the
  counter read 1 for the whole timeout and the stall came straight back with a more honest message.
  Increment after the initial delay elapses, not when the coroutine is queued.

## Why counting beats replicating the trigger conditions

The tempting alternative is to evaluate the game's own trigger predicates - "can any wave still
start?" - and skip the wait when none can. It rots the moment the studio adds a trigger type, and it
has a subtler bug: the "wave has started" flag flips at the START of the activation, while the
enemies are stood up hundreds of milliseconds later, so the predicate goes false while the work is
still in flight and the restore races it. Counting the work has neither problem: the hooks sit on the
coroutines that DO the standing-up, not on the conditions that decide to.

Reset the counters at the start of each restore boot. A coroutine killed mid-flight (a deactivated
manager, a scene unload) never reaches its decrement, and a counter that leaks upward reinstates the
full-timeout stall permanently rather than for one room.
