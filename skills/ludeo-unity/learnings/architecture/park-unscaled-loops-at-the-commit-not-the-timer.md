---
category: architecture
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5"
question: "Does the game run production or economy loops on unscaled time (Time.unscaledTime, WaitForSecondsRealtime), and does your restore need them stopped during the frozen pre-play window, under a pause span, or under a hand-back dim?"
sanitized: true
---

# Park unscaled-time loops at the commit, not at the timer

A loop that waits on `Time.unscaledTime` ignores `Time.timeScale = 0`, so it keeps running through the
restore freeze, through a pause span, and under a hand-back. Freezing time does not hold it.

## The habit

Add one guard per loop that waits, once per iteration, on a layer-owned hold, and put it **just before
the loop commits its result** (the item is produced, the payment is applied), not at the start of the
timer.

Parking at the commit means a timer that was already running simply overruns: nothing completes while
held, and no timer state has to be captured or restored. When the hold releases, the loop commits and
carries on.

## How to apply

- **Derive the hold live** from the conditions that justify it (restore frozen, a pause span open in
  the Player flow, a hand-back in progress) rather than from a flag someone must remember to clear. A
  derived hold cannot outlast its cause.
- Leave the Creator flow alone unless you have a reason: it is the real game.
- **Prove it with work in flight.** Seed the loops with items before the hold and count commits
  during it. On an idle world "nothing committed" passes trivially
  ([[a-degenerate-subject-makes-a-passing-restore-test-prove-nothing]]). A commit while the hold is on
  is a leak.

Related: [[a-hand-back-is-a-hold-not-a-one-shot]],
[[when-menus-pause-the-ludeo-defer-the-actions-raised-under-them]].
