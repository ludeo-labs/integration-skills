---
id: s03-restore-player-flow
name: Restoring a Ludeo snapshot-restores into the captured moment (Player flow)
suite: ludeo-verification
applies-to: [new]
build-target: Shipping (packaged build, not the editor)
---

# s03 — Restoring a Ludeo snapshot-restores into the captured moment (Player flow)

Verifies the **Player flow**, which is **snapshot-restore, not frame-by-frame replay**: opening a
Ludeo drops the player directly into the captured state, and that state matches what was captured.

## Game-specific adaptation
- How does this game enter the Player flow (deep link, "Play Ludeo" menu, launch arg)? Find the SDK
  restore entry point.
- Which state fields define the captured moment for this game (position, health, score, inventory,
  level/scene, timers)? List them — these are what step 4 compares.

## Preconditions / setup
- s02 passed and produced a Ludeo id.
- The state captured in s02 step 1 is recorded (the fields listed above) for comparison.

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | From a running build, open/restore the Ludeo from s02 | Restore starts; no SDK error |
| 2 | Wait for the restore to complete | The game loads **directly into the captured moment**, not the menu or a checkpoint |
| 3 | Observe the scene/level | It is the same scene/level as when captured |
| 4 | Compare each adapted state field to the captured values | Every listed field matches the captured value |

## Pass criteria
- PASS only if the restore lands in the captured moment **and every listed state field matches**. A
  mismatch, a landing on the menu/checkpoint, or an SDK restore error is a FAIL.

## Evidence to capture
- Side-by-side screenshots: captured moment (s02) vs restored state.
- A table of captured-vs-restored values for the adapted state fields.

## Notes
- It must be snapshot-restore: the player is *in* the moment, not watching a replay of how it was reached.
