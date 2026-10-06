---
category: common-mistakes
tier: generalizable
sourceGame: IdleSample
phase: "4,5"
question: "Does your restore write captured state into persistent services BEFORE the gameplay scene loads (the way the game's own Continue path does)? Then check what the scene's initializer runs on EVERY load - run-start grants, starter currency, unlock-on-start, camera/intro locks - because those land on top of your restored values."
sanitized: true
---

# A per-load "run start" initializer re-grants on top of the restore

State lived in DI singletons that outlive scenes. The game's own Continue path loads the save into those
services and *then* loads the gameplay scene, so the plan copied that shape: apply the captured values
before the load, and let the scene build its views from the populated services.

The gameplay scene's initializer, though, called a **run-start initializer on every load**. It exists to
apply permanent upgrades at the start of a new run (starting currency, starting unlocks), and it does
not check whether it has already run for this state. Loading the scene over restored services granted
the starting currency **again**: the replay opened with more than the creator had, and nothing errored.
A scripted intro on the same load also rewrote a camera-lock flag the capture had recorded.

The game gets away with it because Continue re-grants on every load too, so no player ever sees a
before/after comparison; a Ludeo replay does get compared.

## The check

1. Before trusting a pre-load apply, read the gameplay scene's initializer top to bottom and list every
   call that **writes** to a service you restore. "InitializeNewRun", "ApplyStartingBonuses",
   "GrantStarter…", intro/tutorial sequencers and camera setup are the usual suspects.
2. For each, decide: re-apply your captured value **after** the scene has settled (a second pass), or
   suppress the grant during a replay. A second pass needs no game edit and also covers writes you
   didn't find. If you suppress, check the suppressed path does not still run part of its work
   ([[a-suppressed-trigger-may-still-run-and-re-driving-it-resets-your-restore]]).
3. End the restore with a **verify pass**: compare each restored service value to the captured one and
   log any mismatch. That is how the next unlisted writer shows up.

Related: [[a-path-that-skips-the-menus-skips-what-the-menus-initialise]],
[[jumping-straight-into-a-level-skips-setup-the-restore-needs]].
