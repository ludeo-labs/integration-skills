---
category: common-mistakes
tier: generalizable
sourceGame: TopDownRogueSample
phase: "5,7"
question: "Do your automated capture or replay runs play on whatever save the game loads on this machine (the integrator's own profile), rather than on a fixed profile the harness controls?"
sanitized: true
---

# Harness runs must not depend on the integrator's own save

An automated harness on the integrator's machine plays on whatever profile the game loads there: usually
the integrator's own, long-played save. Two things went wrong because of that on one integration.

1. **The save changed under the jobs.** Capture jobs had been written against a fully progressed
   profile (every upgrade unlocked, the late levels reachable). The integrator reset their save one day,
   and 9 of 45 regression jobs failed with no code change. The same jobs on a fresh profile passed. It
   took a round of investigation to rule out the integration.
2. **The save hid what every viewer sees.** All replays had been tested on that long-played save. On
   the cloud every viewer starts from an empty profile, and the first local test of the cloud build
   showed a first-time tutorial popup over the restored moment. The integrator's save had dismissed it
   long ago, so no earlier run could show it.

## The habit

- **Borrow a fixed profile in memory for harness runs**, and block the game's save for the run. Record
  in the result that the save file is untouched. Then runs mean the same thing every day, and they
  can't damage the integrator's progress.
- **Put the profile assumptions in the job** (which level, which progression, upgrades on or off), so a
  job states what it needs instead of inheriting it.
- **Keep fresh-profile variants of the key replays**, and run them before every cloud upload: move the
  game's save folder aside, run, and restore it in a `finally`. Check the run created no save.
- **When a regression set breaks, re-run the fresh-profile variant before blaming the code.** If it
  passes, the environment changed.
- For timing proofs ("restarted at Begin, finished later"), prefer a low-progression profile: a maxed
  profile makes rates so fast that the proof is lost in noise.

Related: [[a-progression-flag-force-needs-a-record-once-undo-ledger]] (forcing first-time flags for a
replay), [[block-the-games-save-while-a-ludeo-is-replaying]].
