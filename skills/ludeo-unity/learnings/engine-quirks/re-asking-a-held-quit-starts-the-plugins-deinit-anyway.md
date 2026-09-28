---
category: engine-quirks
tier: generalizable
sourceGame: RoomActionSample
phase: "3"
question: "Does the integration hold the quit (its Application.wantsToQuit handler returns false) while the run's End goes out, and call Application.Quit again on a timer?"
sanitized: true
---

# Re-asking a held quit starts the plugin's DeInit even while your handler says no

To keep a finished run, the integration holds the quit in its own `wantsToQuit` handler until `EndGameplay`
completes, and hides the window meanwhile. Because nobody can click Exit on a hidden window again, a timer called
`Application.Quit()` every 3 s so the plugin's second pass would happen (see
`hiding-the-window-during-a-held-quit-needs-run-in-background`).

Unity runs **every** `wantsToQuit` handler on each `Application.Quit()`, and the plugin's own handler starts its
DeInit on every call, whatever the other handlers return. So when the player quit right after the results screen,
while the End was still going out, the 3 s re-ask shut the SDK down first. The End's callback then arrived at a
disposed player and threw a `NullReferenceException` inside the SDK (`HandleEndGameplay`) during shutdown. A quit
after the End had finished never showed it.

## Fix

Re-ask only once your hold is released (your handler would return true): skip the timer's `Application.Quit()`
while the hold is active, keep the hard give-up timeout. Test by quitting within a second of leaving the results
screen and grep the log for exceptions logged by the SDK during shutdown.
