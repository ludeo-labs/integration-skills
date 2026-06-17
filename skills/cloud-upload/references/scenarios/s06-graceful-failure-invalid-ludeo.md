---
id: s06-graceful-failure-invalid-ludeo
name: An invalid or expired Ludeo fails cleanly without crashing
suite: ludeo-verification
applies-to: [new]
build-target: Shipping (packaged build, not the editor)
---

# s06 — An invalid or expired Ludeo fails cleanly without crashing

Negative path. A real player will eventually open a Ludeo that is unknown, expired, or corrupt. The
build must reject it gracefully — surface an error and stay usable — not crash or hang.

## Game-specific adaptation
- How does this game surface a failed restore to the player (error screen, toast, fall back to menu)?
  Find the SDK restore error/callback handling in the integration.
- What is a safe usable state to fall back to (main menu, a normal new game)?

## Preconditions / setup
- s03 passed (the happy-path restore works, so a failure here is about error handling, not a broken path).

## Steps
| # | Action | Expected result |
| - | ------ | --------------- |
| 1 | Attempt to restore an **invalid** Ludeo id (malformed / does not exist) | The SDK returns an error; no crash |
| 2 | Observe the game's response | A clear error is surfaced and the game returns to a usable state |
| 3 | Attempt to restore an **expired/revoked** Ludeo (if obtainable) | Same graceful handling as step 2 |
| 4 | After the failure, start a normal game | The build works normally — the failed restore left no bad state |
| 5 | Watch the log | The error is logged; there is no unhandled exception |

## Pass criteria
- PASS only if every invalid restore is rejected gracefully (error surfaced, game returns to a usable
  state, no crash/hang) and normal play works afterward. A crash, hang, silent black screen, or
  corrupted subsequent session is a FAIL.

## Evidence to capture
- Screenshot of the error state and of normal play resuming afterward.
- The log entry for the rejected restore.

## Notes
- If your platform can't easily produce an expired/revoked Ludeo, cover at least the malformed and
  non-existent cases and note that expiry was not exercised.
