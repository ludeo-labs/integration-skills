---
category: architecture
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5"
question: "After a hand-back (the Ludeo ended, the game stays up under a dim), can any game code path re-enable input or advance simulation on its own - hub or menu panels that turn the input listener back on, loops that run on unscaled time?"
sanitized: true
---

# A hand-back is a hold, not a one-shot

Disabling input once at the hand-back is not enough in a game with a hub or a menu layer that stays
alive. Game code re-enables the input listener by itself: closing a panel, a fade finishing, a popup
dismissing. Each of those writes "enabled = true" after the layer's single disable, and the viewer is
back in control of a game that is supposed to be parked under the dim.

## The habit

- **Re-assert the hold every frame** for the whole hand-back, not once at its start. A per-frame
  re-assert cannot be undone by a game write that lands later in the same session.
- **Hold every player-controlled component**, not just the one the Ludeo's moment used. A hub or a
  second play mode often has its own movement and input components that the main mode never touches.
  See [[normalize-the-whole-agency-suppressing-flag-family-not-just-the-input-one]] for finding the
  full set of flags that grant agency.
- **Check the simulation as well as the input.** `Time.timeScale = 0` does not stop loops that run on
  unscaled time, so a hand-back that only freezes time can leave an economy loop producing under the
  dim.

## How to apply

List every writer of the input-enable flags (grep the assignments, not the declarations) and confirm
each one is either unreachable during the hand-back or overwritten by your per-frame hold. For the
unscaled loops, hold them where they commit, as in
[[park-unscaled-loops-at-the-commit-not-the-timer]].
