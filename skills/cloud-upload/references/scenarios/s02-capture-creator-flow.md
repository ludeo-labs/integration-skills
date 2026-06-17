---
id: s02-capture-creator-flow
name: Capturing a moment produces a valid Ludeo (Creator flow)
suite: ludeo-verification
applies-to: [new]
build-target: Shipping (packaged build, not the editor)
---

# s02 — Capturing a moment produces a valid Ludeo (Creator flow)

Verifies the **Creator flow**: the game records gameplay state into a Ludeo.

## Game-specific adaptation
- How is a capture triggered in this game (automatic on an event, a UI action, an API call)? Find the
  call into the SDK that starts/commits a capture.
- What in-game moment is worth capturing for this game (a kill, a checkpoint, a lap, a score event)?

## Preconditions / setup
- s01 passed.
- Test account signed in (dedicated test account, never real credentials); network available.

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | Play to a capture-worthy moment for this game | The game reaches the moment with non-trivial state |
| 2 | Trigger a Ludeo capture | Capture starts without error; the SDK reports success |
| 3 | Let the capture commit / finalize | A Ludeo id (or link/handle) is produced |
| 4 | Inspect the log during capture | No SDK warning/error; no dropped-data message |

## Pass criteria
- PASS only if a valid Ludeo id/handle is produced and the log is clean. No Ludeo produced, or any SDK
  capture error, is a FAIL.

## Evidence to capture
- The produced Ludeo id/link.
- Screenshot of the captured moment and the SDK log for the capture.

## Notes
- This scenario only produces the Ludeo; restoring it is `s03`. Carry the Ludeo id forward to s03–s05.
