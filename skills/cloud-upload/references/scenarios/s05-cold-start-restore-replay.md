---
id: s05-cold-start-restore-replay
name: Restore works from a cold start and stays playable
suite: ludeo-verification
applies-to: [new]
build-target: Shipping (packaged build, not the editor)
---

# s05 — Restore works from a cold start and stays playable

Verifies restore works with **no warm session state** (the real Player-flow path: a new player opens a
Ludeo on a fresh process) and that the game is fully interactive afterward, not just visually correct.

## Game-specific adaptation
- How would a brand-new player open this Ludeo from cold (launch arg, deep link, menu after fresh
  install)? Use that exact path, not an in-session shortcut.
- What proves "fully interactive" for this game (movement, an attack, opening a menu, scoring)?

## Preconditions / setup
- s03 passed.
- Fully quit the game so the process ends (no in-memory session, no prior save).

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | From the fully-quit state, open the s02 Ludeo via the cold-start path | The build launches and begins restore; no error |
| 2 | Wait for restore to complete | Lands directly in the captured moment (as in s03) |
| 3 | Provide input and play forward ~10s | Game responds immediately; no freeze, no desync, no drift from expected state |
| 4 | Watch the log through launch → restore → play | No fatal error or unhandled exception |

## Pass criteria
- PASS only if the Ludeo restores from a cold process **and** the game is interactive and stable for
  the play-forward window. A failure to launch/restore from cold, a freeze, a desync, or a crash is a FAIL.

## Evidence to capture
- Screen recording (or before/after screenshots) of cold launch → restored moment → playing forward.
- The full log for the cold-start run.

## Notes
- Restoring from inside an already-running session can hide initialization-order bugs that only appear
  on a cold start — which is how real players will open the Ludeo.
