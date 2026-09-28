---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "4,5"
question: "Does the capture stop tracking objects when they leave scope (a room change, streaming out, despawn), and could that happen within seconds after the creator presses the highlight key?"
sanitized: true
---

# An object you stop tracking while a highlight is still being made comes back from that Ludeo empty

The capture tracked only the current room's enemies and stopped tracking the old room's on every room change. One
Ludeo came back with all six enemy objects of its room present by object type but with **no attributes at all**
(every read absent, so the restore skipped them as "no key"). The other highlights of the same run were fine.

The run log showed why. The highlight key press starts an SDK task (`MarkHighlight`) that usually finishes in 1–2 s;
that one took **12.7 s**. The player crossed into the next room 11 s after the key press, the enemies' tracking was
stopped, and the task that was still building the highlight kept the objects but not their values. The game gets
no "highlight done" callback (the overlay handles the key), so there is nothing to wait on.

## Fix

Keep scoped-out objects tracked for a while after they leave scope (30 s here; the longest task seen was 12.7 s),
and stop them from a per-frame tick when the time is up. If the scope comes back within that window (the player
steps back into the room), **reuse the same objects** instead of registering new ones, so no duplicate keys appear.

Then re-check the object budget with the linger included: the current scope plus everything left in the last 30 s
(see `the-state-upload-is-lossy-above-a-ceiling`). Here the realistic worst case stayed under 70 of ~100.

## How to spot it

A Ludeo whose objects of one kind all read as empty, while every other bucket is fine, and a scope change within
seconds after the highlight key press in the recording log. Compare the `MarkHighlightTask: Finished` time with the
scope change.
