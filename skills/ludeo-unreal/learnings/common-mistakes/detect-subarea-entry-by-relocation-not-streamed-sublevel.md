---
category: common-mistakes
tier: generalizable
sourceGame: StoryPuzzleGame
phase: 5
question: "Are you about to detect an 'entered a sub-area / flashback / memory' action by polling which sublevels are loaded+visible? STOP — do in-place set-pieces/cinematics in the main area ALSO stream sublevels? If so, 'a sublevel appeared' is a false positive. If entering the sub-area teleports the player far away, poll player distance instead."
sanitized: true
---

# Detect sub-area entry by player RELOCATION, not by which sublevels streamed in

## Precondition

You want an action for "the player entered a distinct sub-area" (a flashback/memory scene, a portal
room, a photo/object-triggered space). The game reaches it by **teleporting the player** to a far
anchor and streaming the sub-area's sublevels. The main/host area **also** streams sublevels for
in-place set-pieces or cinematics that are *not* a sub-area entry.

## The trap (what failed)

The first detector polled the set of loaded+visible sub-area sublevels and fired the action on the
empty→non-empty edge. Two false-firing modes appeared:

- **In-place set-pieces fired it.** A story set-piece that streams a sublevel *right where the player
  is standing* (in the main area) tripped the "a sub-area sublevel appeared" edge — the action fired
  when the player had not gone anywhere.
- **First-loaded-and-stays masks later entries.** If one sublevel streams in early and stays loaded,
  the "any sub-area active" set never returns to empty, so subsequent genuine entries never re-cross
  the empty→non-empty edge and never fire.

Streamed-sublevel state answers "is content X loaded," which is **not** the same question as "did the
player relocate into a different space."

## The fix

If entering the sub-area physically relocates the player far from the main area's origin, poll the
**player's distance** and latch on the crossing:

```cpp
// main area sits near the origin; sub-areas are reached via a teleport to a far anchor.
const bool bInSubArea = Player->GetActorLocation().SizeSquared() > FMath::Square(SubAreaDistance);
if (!bBaseline && !bWasInSubAreaCache && bInSubArea)
{
    ReportAction(TEXT("SubAreaEntered"));
}
bWasInSubAreaCache = bInSubArea;
```

Pick the threshold from real captured transforms (main area clustered near origin; sub-areas tens to
hundreds of thousands of units away — a clean separation). Baseline the cache in
`RegisterActionListeners` after any Player-Flow restore so an entry already in progress at frame 1
doesn't fire spuriously, and detect in **both** flows ([[actions-must-fire-in-player-flow-too]],
[[action-polling-separate-from-state-writing]]).

## General rule

Match the **signal to the question.** "Entered a place" is a *player-position/possession* fact, not
a *content-loaded* fact — even though the two correlate most of the time. When a poll source can be
true for a reason other than the thing you mean (here: a set-piece streaming a sublevel without the
player moving), it will eventually fire wrongly. Confirm the actual domain meaning with the
integrator ("what counts as entering it?") rather than inferring it from whatever state is easiest to
poll — the integrator here defined it precisely as "when the player is relocated into it."
