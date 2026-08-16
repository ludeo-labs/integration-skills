---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
---

# Write restored state to whoever owns it, not to the field you can reach

The single most repeated failure of a wave-1 restore is not writing the wrong value. It is writing
the right value to the wrong place: to a field that some live system re-derives, re-copies or
re-assigns a moment later. The write succeeds, the log is silent, and the state is gone by the time
anyone looks.

It happened three times in one wave, each in a different subsystem, each looking like a different
bug:

| What was written | Who actually owned it | How it came back wrong |
|---|---|---|
| The player's position | The engine's spawn handshake, which fires ~1s after the level activates | Player teleported to the level entrance a second after the restore placed them |
| An entity's visibility | The arrival/spawn sequence, which reveals the entity only at its final step | Entities present and correctly placed, and invisible |
| An entity's "is dying" flag | The behaviour tree, which copies its own shared variable onto the entity when its initialize branch runs | Flag flipped back moments after the restore set it |

Three subsystems, one shape. **The restore does not own the world; it is a guest in it.**

## The habit to build

For every value you restore, ask **who writes this between now and the first frame the player
controls?** There are only three answers, and each has a different action:

1. **Nobody** — write the field. Most values are here.
2. **A system that re-derives it from something else** — do not write it, and do not check it. It
   will be recomputed from state the restore has already reproduced (an aggro target derived from
   line of sight is recomputed from positions). Writing is harmless but pointless; *checking* it
   produces false alarms that bury the real findings.
3. **A system that owns it and will overwrite you** — write to the owner. Set the behaviour tree's
   variable rather than the entity's field. Complete the arrival sequence rather than setting the
   visible flag. Let the engine's spawn handshake run and place the entity *after* it, rather than
   suppressing it.

Case 3 is the one that costs days, because the naive fix — suppress the system that is overwriting
you — usually breaks something worse. Suppressing the spawn handshake in this integration produced
a half-spawned player with no camera orientation: a black screen and thousands of zero-vector
rotation warnings. The system was doing more than the one thing it appeared to be doing.

## How to find them without a run each time

Read the write path of the field you are about to set, and grep for every other assignment to it.
Three of these were found that way in minutes once the habit existed; each had cost a build-and-run
cycle before it. A field with several writers is a field with an owner, and the owner is rarely you.

## Why order matters more than it looks

The corollary is that restore ordering is not arbitrary. Anything owned by a system that runs on
spawn or level-entry must be written **after** that system has finished, not before — which is why
the restore waits for the engine's own readiness handshake instead of racing it, and why placement
is applied last. See [[boot-the-replay-through-the-games-own-entry-flow]] and
[[restored-entities-must-arrive-already-arrived]]; the verification that catches all of these when
they regress is [[make-the-restore-verify-every-value-it-writes]].
