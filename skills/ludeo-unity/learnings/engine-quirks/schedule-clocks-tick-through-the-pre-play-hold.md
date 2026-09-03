---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Do wave/encounter schedulers run on a clock your pre-play hold does not freeze? Compare the scheduler's elapsed at Begin against the restored value - drift there silently trims the spawn schedule's tail."
sanitized: true
---

# Schedule clocks tick through the pre-play hold - re-assert them at Begin

A restored encounter's wave timer was written correctly during the restore, but the wave
scheduler ticked on a clock the pre-play hold did not freeze. By the time the player
pressed Play, the timer sat ~4 seconds past the recorded value - every run, logged by the
integration's own clock check and left unfixed for a day because nothing seemed to break.

What it actually broke: the wave's spawn DELIVERY is a schedule, and starting ~4s deep
trims the tail - in the recording the final spawn batch was exactly the handful of
enemies replays kept coming up short. The shortfall varied run to run (0/1/3/4) because
it races the player's kill pace against the remaining delivery window, which made it look
random. And nothing errors: live games never promise a spawn count, so no system audits
one - a replayed moment is the first scoreboard the game has ever had, and counts that
were always approximate silently become contract.

**Fix pattern:** keep the recorded scheduler values (wave index, elapsed, next-wave
target, finished flag, state) that the restore already applied, and write them AGAIN in
the begin-gameplay callback - the instant play truly starts. This is the same re-assert
family as re-writing restored enemy health after the client-side init stomps it: any
value a live system keeps mutating between restore and Begin needs a second write at
Begin, not a better first write.

Diagnosis shortcut: if replays run short with no spawn-failure logs and no pending
retries, the enemies were never REQUESTED - look at the scheduler's clock before
suspecting placement.
