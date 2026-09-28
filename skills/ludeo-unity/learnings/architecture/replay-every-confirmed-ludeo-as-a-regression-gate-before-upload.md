---
category: architecture
tier: generalizable
sourceGame: RoomActionSample
phase: "5,7"
question: "Are there Ludeos the integrator has already confirmed on screen, a local replay launch option, and a restore that logs its own checks before the viewer's Play click?"
sanitized: true
---

# Replay every confirmed Ludeo as a regression gate before an upload

Each fix to the restore (a new state family, a cutscene filter, a settle rule) can break a level that already
worked, and a human re-testing a dozen levels before every upload does not happen. The restore already checks its
own work after the settle, before the Play click, so a script can do the re-test:

1. Keep a list in the plan of every Ludeo the integrator confirmed on screen, one short name each (level and what
   it covers: "chasing lasers", "boss mid-phase").
2. For each: launch the local build with the replay option and its own log file, wait until the post-settle check
   lines appear (or a timeout), save them, and close the process.
3. Summarize per Ludeo: the checks that ran and any `WRONG`, error or missing check.

Thirteen Ludeos took about seven minutes with no one at the keyboard. It ran twice before one upload and showed
that three restore fixes had broken none of the confirmed levels.

## Pitfalls

- Count the check lines per Ludeo, not only the failures: one replay stalled at the main menu (nothing logged after
  the first scene) and produced **no** check lines, which a grep for `WRONG` would have called a pass. It was a launch
  three seconds after the previous process was force-closed; run it alone again before calling it a regression.
- The checks cover the moment before Play. Something that goes wrong after Play (a restarted boss phase bringing
  parts back) still needs the integrator's eyes on the Ludeo the fix was for.
- Run it on the build you are about to upload, and again after any fix it prompted.
