---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: 5
question: "Are you planning to restore a boss phase / stage / form index by calling the game's existing AdvancePhase()-style entry point, on the grounds that a public entry point already exists?"
sanitized: true
---

# The public "advance phase" entry point is the DRAMATIZER, not a state setter — audit all overrides before reusing it

`bosses.md` §4.2 offers a cheap path for restoring a boss's phase/form index: *if a public entry point
exists, reuse it instead of adding a game-code seam.* A phase-2 scoping pass finds
`public virtual void AdvancePhase()` on the boss base class, records "public entry point exists ✅", and
moves on. **Read every override first.** In the observed project all four boss implementations were
disqualified, each for a different reason:

| Implementation | What `AdvancePhase()` actually does |
|---|---|
| base class | sets the field **and** activates a phase-change state controller that fires an animator trigger and holds the FSM until the animation reaches `normalizedTime >= 1` |
| boss A | base's animation **plus** it forces the boss into a specific *attack* state and re-rolls a `Random.Range` spawn timer |
| boss B | calls a full `PlayableDirector` cutscene — and **never touches the phase field at all**; the field is set much later, from the cutscene's completion callback |
| boss C | sets the field and nothing else — silent, but only because it *forgot* to call `base.AdvancePhase()` |

So the one implementation that is safe to reuse is safe **by accident**, via the same
override-doesn't-chain hazard as
[[one-base-class-register-hook-misses-subclasses-that-skip-base-start]]. Boss B is the dangerous one:
calling it during restore launches a cutscene *and* leaves the phase unset, so the bug presents as
"restore hung" rather than "phase wrong."

## Two structural disqualifiers that apply even when the body looks clean

1. **The method usually hard-codes the destination.** `AdvancePhase()` means "go to the next phase", so it
   writes phase 2 literally. A three-value phase enum with only a `PHASE_2` writer cannot express a
   captured phase 3 — and cannot express phase 1 at all, because there is no "go back". Restore needs an
   arbitrary assignment, which an *advance* verb structurally cannot provide.
2. **It is not idempotent.** Re-entering it on a boss already in that phase replays the animation or
   cutscene.

## Ask for `SetPhaseSilent(TPhase)` — and make it non-virtual

A four-line, side-effect-free field write next to the existing getter. **Non-virtual on purpose:** the
entire failure mode above is subclasses overriding the phase entry point with dramatics, so a `virtual`
seam re-opens the same hole for the next boss someone adds.

## The corollary that decides the rest of the rows

A silent setter restores the *field* and none of the phase's **visible consequences** — in the observed
project, arriving in phase 2 also removed a shield mesh, zeroed a dissolve timer, and forced an aggro
animator bool true, all from the cutscene-completion callback. Do not try to replay the transition to get
them. **Capture each consequence as its own resolved attribute** (`ShieldActive` bool, `DissolvePct`
float, the engagement bool) — `06 §4` resolved capture. That is cheaper, order-independent, and it is the
only version that also works for a boss captured *mid*-transition.

## The generalization

This is not really about bosses. Any state whose only public writer is a **verb** (`Advance`, `Trigger`,
`Complete`, `Unlock`, `Activate`, `NextWave`) is a state *transition*, and a transition is a setter plus
side effects plus a destination the caller does not choose. Restore wants the setter half only. When a
scoping pass records "a public entry point exists, no game edit needed", the check is: **does this method
write only the field, for an arbitrary value, idempotently?** Three noes is the normal answer.
