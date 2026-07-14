---
category: common-mistakes
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 6
question: "Does the puzzle/objective you want a 'Solved' action for have NO bSolved flag, and is its own interaction-state enum ambiguous (it cycles on every interaction, and cancel/escape resets it the same way a solve does)? If so, attribute the solve to the thing it UNLOCKS downstream, not to the puzzle's own state."
sanitized: true
---

# Derive a "solved" action from the puzzle's downstream OUTCOME, not its own ambiguous state

## Precondition

You need a per-puzzle / per-objective "solved" action (poll-based, no new game events —
[[action-polling-separate-from-state-writing]]). The puzzle class has **no `bSolved` boolean**, and
its own interaction-state field is **ambiguous**: a shared interaction-state enum that cycles on
every interaction, gets reset by cancel/escape, or is reused across unrelated states. Polling that
field directly produces noisy / wrong attribution.

## The trap

The tempting signal is the puzzle's own `InteractType` / `State` enum — it's right there on the
actor. But a shared interaction enum is set on **focus, cancel, escape, and solve alike**, so a
`X→Default` transition does not uniquely mean "solved." Attributing a `Solved` action to it
mis-fires on every disengage.

## The fix — poll the downstream effect the solve causes

Each puzzle *unlocks* or *changes* something concrete when solved. Detect the solve from **that
outcome's** transition, which is unambiguous:

```cpp
// keypad solved  <- the door it controls goes Locked -> Unlocked
if (PrevDoorLocked && !DoorLockedNow) { ReportAction(TEXT("KeypadSolved")); ReportAction(TEXT("PuzzleSolved")); }

// combination lock solved  <- the container it controls goes locked -> unlocked
// printer/printout puzzle  <- the printed-page mesh collision goes off -> on (read via reflection)
// arrangement puzzle       <- current order == winning order (read WinningOrder via reflection, never hardcode)
```

Each specific solve also emits a broad `PuzzleSolved` on an independent axis
([[additive-action-emission-for-composable-goals]]). Read any private member backing the outcome via
reflection rather than editing the puzzle classes — keeps it a zero-game-edit, poll-only detector.
Baseline every outcome cache in `RegisterActionListeners` **after** Player-Flow restore so an
already-solved puzzle restored at frame 1 doesn't fire a spurious solve, and detect in both flows
([[actions-must-fire-in-player-flow-too]]).

## When the shared interaction enum IS usable (and the caveat)

For families of sub-area mini-games with no individual downstream object, a shared base-class
interaction-state `→Default` transition *can* serve as a universal solve signal without per-class
wiring — but only if you can rule out cancel/escape producing the same transition (verify the
cancel/`UnInteract` path), and you must scope it (only while that sub-area is loaded) and baseline
on first-seen so streamed-in actors don't fire on appearance. Prefer the **downstream-outcome**
signal whenever a concrete unlocked object exists — it is unambiguous; the enum transition is a
fallback, not the default.

## General rule

Attribute an objective action on the axis where the meaning is **unique**. The puzzle's own input
state is shared across many situations; the state it *causes* (a door opens, a container unlocks, a
page prints) happens **only** on success. Poll the effect, not the cause.
