---
id: s01-build-launch-smoke
name: Packaged build launches and reaches a playable state
suite: ludeo-verification
applies-to: [new, sdkFree]
build-target: Shipping (packaged build, not the editor)
---

# s01 — Packaged build launches and reaches a playable state

Smoke gate for the suite. If the build doesn't run, nothing else can be tested.

## Game-specific adaptation
- What is the build's entry point / first interactive screen (main menu, splash, direct-to-game)?
- What is the earliest in-game state that counts as "playable" for this game?

## Preconditions / setup
- Fresh install of the packaged build; no prior save data.
- Run from inside the build folder (working directory = build root).

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | Launch the executable | Process starts; no missing-DLL / missing-asset dialog |
| 2 | Wait for the first interactive screen | It loads within a reasonable time (e.g. ≤ 15s); no error popup |
| 3 | Reach the first playable in-game state | Player can move / interact; HUD renders |
| 4 | Watch the log during steps 1–3 | No fatal error or unhandled-exception entries |

## Pass criteria
- PASS only if the build reaches a playable state with no crash, no missing-file dialog, and no fatal
  log error. Any crash or hard error is a FAIL.

## Evidence to capture
- Screenshot of the first playable state.
- The build's log file for the launch.

## Notes
- This is the only suite scenario that applies to `sdkFree` builds.
