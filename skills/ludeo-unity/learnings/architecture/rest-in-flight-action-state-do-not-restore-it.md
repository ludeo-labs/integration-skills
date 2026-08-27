---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Does the character controller gate input or attacks on a state field that is cleared only at the END of a move, dodge, stun or knockback - a coroutine or frame-driven sequence the restore does not run? Restore that field faithfully and the character is frozen for the whole moment."
sanitized: true
---

# Rest the in-flight action state; restoring it faithfully freezes the character

A moment is recorded mid-swing. The capture writes the controller's action state honestly -
`charMoveState = Executing`, a combo frame part-way through its total, a dodge flag, a stun flag,
a knockback flag - and the restore writes every one of them back. The replay boots, the world
looks perfect, every read-back check passes, and the player cannot move or attack at all.

In one integration the decisive line was a single statement:

    canRequestMoves = (charMoveState == CharacterMoveState.None);

`charMoveState` was returned to `None` in exactly ONE place in the codebase: the tail of the move
manager's execution path. That path runs only while a move is genuinely in flight. Nothing on the
replay side was running it, so `canRequestMoves` went false on the first frame and never came back.
Movement was the same shape one layer over: the controller's stun check and knockback check each
`return` out of the *entire* input pass, and both flags are cleared only by systems that were not
running - the knockback's clearer measured elapsed time against a duration field that the capture
never recorded at all, because it is written only when a knockback STARTS.

**This is the same family as an enemy's "AI armed" latch, and it bites harder**: a still enemy is a
visible bug, a frozen player is an unplayable moment.

## The rule

A recorded moment resumes mid-**fight**, not mid-**swing**. The swing that was in flight when the
clip was cut has no driver on the other side of the restore, so the faithful value is the wrong one.
Rest the action state to what the character would hold a frame later - able to act - and leave the
descriptive state (health, resources, cooldown *values*, modifiers, facing, status effects) restored
normally.

Concretely, rest rather than restore: the move-state enum, dash/dodge state, mid-move frame
counters and their totals, stun flags and stun timers, knockback flags and their elapsed time, parry
freeze, block-input flags, and any "stunned by X" latch whose only clearer is a VFX coroutine.

**Then stop capturing them.** A value the restore is guaranteed to discard is not state - keeping it
in the capture is the mirror image of capturing something and never writing it back, and it costs
per-tick bandwidth to record a number that can never be honoured.

## The second half: the readiness check must read the controller's gates

The same integration already had a Begin-time check that named every reason the player might be
unable to act. It logged **"the player can act - every input gate is clear"** on the run where the
player was frozen, because it only ever read the global "input blocked" flag and the screen-state
flags around it. The controller's own gates - mid-move, stunned, knocked back, mid-dodge, mid-dash -
were invisible to it.

A check that cannot see the thing that broke is worse than no check, because it is read as proof.
When you add a can-the-player-act assert, enumerate the conditions the **controller** returns on, not
the ones the global game-state singleton exposes; and have the forced-recovery path rest that state
rather than returning early when the global flag happens to be clear.

## How to find these before a play test

Grep for the assignment that RESETS each candidate field, not the one that sets it. One writer, and
that writer sitting at the end of a coroutine or a frame sequence, is the tell - the same test that
identifies an enemy's arming latch. If the only clearer is unreachable without the system the restore
suppresses, the field must be rested.
