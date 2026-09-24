---
category: common-mistakes
tier: generalizable
sourceGame: SurvivalSample
phase: "5"
question: "Does your restore plan RE-DRIVE a game trigger (start the event loop, start the level's systems) on the theory that suppressing the run-start also suppressed it? Before you call it, confirm two things from source: whether the loader still calls it on a replay, and what the call RESETS on its way through. Both were wrong here, and the second one undid the restore."
sanitized: true
---

# A "suppressed" trigger may still run - and re-driving it can reset what you just restored

The plan had a clean-looking step near the end of the apply: *re-drive the map's event-loop start*.
The reasoning was sound on paper. The game starts the main fight and the map's event loop back to
back from the same place in its loader; the restore has to suppress the first (it zeroes the wave
cursors and the run clock); so surely the second was suppressed with it, and its "active" flag was
not captured, so the loop had to be started by hand.

Two things were wrong, and only a real replay showed them.

**The loader still called it.** The suppression was a guard around one call, not around the loader.
The event loop was already active by the time the apply ran. The re-drive was redundant.

**Re-driving it zeroed the cursors.** The start call does `_eventIndex = 0;
_objectiveEventIndex = 0;` before it does anything else. The apply had just written the event
cursor a few lines earlier. Net effect: the cursors were restored, then reset, in the same frame - and
the first side objective of the run was offered again, with its accept screen, over a run that had
accepted it a minute before the clip started. That was the first thing the integrator saw.

## The habit

Before re-driving any game trigger from a restore:

1. **Grep for the call in the loader.** If it still runs on your replay path, do not add a second one.
2. **Read the first ten lines of the trigger.** Start methods reset. If it zeroes, clears or
   re-news anything you restore, it is not a trigger you can re-drive after the apply - either write
   your values *after* it (if the loader calls it) or reproduce only the part you need.
3. **Assume the flag it sets is set.** "The flag is not captured" is not the same as "the flag is
   false". Check it live before deciding it needs setting.

This is the restore-side twin of [[write-restored-state-to-whoever-owns-it]]: the start method
*owns* those cursors at start time, and calling it hands ownership back.

## The tell that was missing

The restore's self-check ([[make-the-restore-verify-every-value-it-writes]]) did not catch this,
because the cursors had no read-back registered: they were written and never compared. A cursor
written at 1 and read back at 0 at the click checkpoint would have named the fault before anyone
pressed Play. Anything a start method can reset is worth a check at that checkpoint - it is
precisely the value a re-run start would clobber.
