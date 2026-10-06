---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "4,5"
question: "Does any capture writer read a game getter that returns a DEFAULT when the thing it describes doesn't exist (target == null ? Vector3.zero : target.position; list?.Count ?? 0; a null-coalesced 'current X')? Then the capture can record the fallback as real state, and a restore verify that reads the same getter back will report a match."
sanitized: true
---

# A getter's fallback value captures, restores and verifies as if it were real state

Synthetic example: a capture writer records `TargetPosition => target != null ? target.position :
Vector3.zero`. On a capture where there is no target, the Ludeo stores `(0,0,0)`, the restore "applies"
it (the setter silently returns without a target), and the verify reads the same getter, gets `(0,0,0)`
and reports **matched**. Every check is green on a value that never described the game. (A black
screenshot at Begin seemed to confirm a wrong camera; it was actually the unfreeze frame, an unrelated
cause.)

## Why the verify couldn't catch it

A verify that compares "what I wrote" with "what the getter reads now" is only as honest as the getter.
When both sides go through the same fallback, the comparison is a tautology: it proves the fallback is
stable, not that the state was restored.

## The check

1. For every capture writer, open the getter it reads and look for a **fallback branch**: a
   null-coalesce, a `? default :`, an early `return 0`. If one exists, capture the **validity** too:
   skip the attribute, or write a `has…` flag, when the fallback is taken. A small read-only accessor on
   the game type (`HasTarget => target != null`) is cheaper than guessing from the value.
2. Make the verify treat "precondition absent" as **not checkable**, not as a match.
3. For Ludeos already captured with the fallback baked in, have the restore recognise the exact fallback
   value and treat it as absent. Log it so it's visible.
4. Keep a real image check at the restore gate, taken a few seconds **after** unfreeze; a frame grabbed
   on the unfreeze tick can be black for unrelated reasons (ready cover, first render).

Related: [[verify-the-world-not-the-flag-you-just-wrote]], [[ask-what-your-check-cannot-see]].
