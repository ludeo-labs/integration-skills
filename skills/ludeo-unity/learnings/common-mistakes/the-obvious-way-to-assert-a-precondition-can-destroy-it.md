---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: 5
question: "Is your gate asserting a precondition by asking the same game function the feature under test overrides - 'is this hidden?', 'is this unlocked?', 'is this available?'? Read that function's body before using it as a probe. Gates commonly set up an asymmetry and then destroy it with their own first assertion, because the natural probe is a mutator."
sanitized: true
---

# The obvious way to assert a precondition can be the thing that destroys it

A restore gate that proves "the replay answers from the clip, not from the machine" has to build an
asymmetry first: make the machine's own state *disagree* with the clip, then show the game answers the
clip's way. The asymmetry is the whole instrument — without it every assertion passes on the machine's
state and the run proves nothing.

The trap is that **the natural way to check the asymmetry is the same call the feature overrides**, and
in this codebase that call mutates.

## What happened

The gate locks a set of content on the profile, then asserts "these are locked", then applies the
clip's override, then asserts the game now reports them available. The obvious probe for both
assertions is the game's own gate — `IsContentHidden(id)` (names here are illustrative).

But `IsContentHidden` calls `IsContentUnlocked(id, unlockIfEligible: true)`, and that argument makes the
method **unlock content whose requirements pass, as a side effect of being asked**. So the "assert
locked" step would have re-unlocked the very content the previous step had just locked — silently, with
no error — and the run would then have passed for the wrong reason, on a profile that was no longer
locked.

The fix is small once seen: assert the precondition with the **pure read** underneath
(`GetUnlockState`), and keep the mutating gate for the assertion *after* the override is in
place, where the override returns before the side effect ever runs.

## The bonus assertion this hands you

Because the mutating call runs during the second assertion, comparing the profile's size **before and
after that call** is a direct test of the override's most important property: that it returns early and
never lets the write path run. If the count moves, a replay is editing the replayer's account. That is
a stronger and cheaper check than diffing the save file afterwards, and it lives inside the run.

## The habit

Before using a game function as a **probe**, read its body for writes — not for correctness, but
because a probe is supposed to observe. Three specific smells:

1. A boolean getter taking a flag like `unlockIfEligible`, `autoCreate`, `orAdd`, `ensure`.
2. A getter that lazily creates or repairs state (a singleton accessor that instantiates; a cache that
   fills on read). A null check against one of these can never fire.
3. Anything whose name says "is" but whose signature takes a parameter that only makes sense for a
   writer.

And note the shape rather than the specific API: **a gate that sets up a condition and then asks the
system under test to confirm it has, by construction, given the system a chance to undo it first.**
