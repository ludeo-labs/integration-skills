---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "What happens when the player replays a clip recorded in the level they are CURRENTLY standing in? If the game's scene-change path early-returns when the target scene is already active (most do), the replay boot silently does nothing — test replay-again before calling the flow done."
sanitized: true
---

# Replay-again from inside the same level: the scene won't reload in place — hop out first

The replay flow worked; then the player finished the moment and clicked play again from the
summary screen. The second boot targeted the level scene the player was already standing in — and
the game's scene-change helper early-returns when the requested scene is already active. No load,
no error, no log: the flow simply stalled ("clicking play again breaks the game").

This is not an exotic path. The summary screen offers replay; replaying the clip you just played
is the single most likely second interaction of the whole feature.

The fix that matches the flow's own architecture: when the boot's ready-check sees the target
scene already active, **leave for the hub/lobby first** via the game's own back-to-hub transition
(the ESC-menu / run-end path — battle-tested, resets what the game wants reset), then let the
normal ready→enter sequence run again. The wait stage simply doesn't advance during the hop —
the transition makes the ready-check false until the hub is up, and the next pass enters the
level fresh with the recorded seeds re-applied.

Do NOT try to force an in-place reload of the active scene — the early-return exists because the
game's transition machinery (player carry-over, network scene messages, loading screen) assumes a
scene CHANGE; reloading in place walks around all of it and lands in untested territory.

Also make sure a second selection tears the in-flight attempt down completely before the new boot
starts (the re-entrant teardown the restore docs already require) — the hop-out then composes with
it: teardown → boot → sees same-scene → hub → level.
